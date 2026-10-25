import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

import '../data/offline_database.dart';
import '../data/offline_cache.dart';
import 'api_client.dart';

class OfflineSyncService extends ChangeNotifier {
  OfflineSyncService(this._api,
      {Connectivity? connectivity, this.onUnauthorized})
      : _connectivity = connectivity ?? Connectivity();

  OfflineSyncService.forDatabase(OfflineDatabase database)
      : _api = null,
        _connectivity = Connectivity(),
        onUnauthorized = null,
        _database = database;

  static const syncInterval = Duration(minutes: 3);
  static const _collections = [
    'productos',
    'sucursales',
    'inventario',
    'reservas',
    'ventas',
    'cliente',
  ];

  final ApiClient? _api;
  final Connectivity _connectivity;
  final Future<void> Function()? onUnauthorized;
  OfflineDatabase? _database;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  Timer? _periodicTimer;
  bool _isOnline = true;
  bool _isSyncing = false;
  DateTime? _lastSyncTime;
  int _sessionGeneration = 0;
  final Set<int> _syncingGenerations = {};

  bool get isOnline => _isOnline;
  bool get isSyncing => _isSyncing;
  DateTime? get lastSyncTime => _lastSyncTime;

  Future<void> startForIdentity(
      {required int idEmpresa, required int idUser}) async {
    final generation = ++_sessionGeneration;
    _database = await OfflineDatabaseRegistry.openForIdentity(
      idEmpresa: idEmpresa,
      idUser: idUser,
    );
    if (generation != _sessionGeneration) return;
    _isSyncing = _syncingGenerations.contains(generation);
    final result = await _connectivity.checkConnectivity();
    _setOnline(_hasConnection(result));
    await _restoreLastSyncTime();
    await _connectivitySubscription?.cancel();
    _connectivitySubscription =
        _connectivity.onConnectivityChanged.listen((result) {
      final wasOnline = _isOnline;
      _setOnline(_hasConnection(result));
      if (!wasOnline && _isOnline) unawaited(syncNow());
    });
    _periodicTimer?.cancel();
    _periodicTimer = Timer.periodic(syncInterval, (_) {
      if (_isOnline) unawaited(syncNow());
    });
    if (_isOnline) unawaited(syncNow());
  }

  Future<void> syncNow() async {
    final api = _api;
    final database = _database ?? OfflineDatabaseRegistry.activeDatabase;
    final generation = _sessionGeneration;
    if (!_isOnline ||
        _syncingGenerations.contains(generation) ||
        api == null ||
        database == null) {
      return;
    }

    _syncingGenerations.add(generation);
    _isSyncing = true;
    notifyListeners();
    try {
      await _pushPendingReservations(api, database);
      if (generation != _sessionGeneration ||
          !identical(
              database, _database ?? OfflineDatabaseRegistry.activeDatabase)) {
        return;
      }
      final since = await database.readLastServerTime();
      final payload = await api.get('/api/sync/pull', query: {
        if (since != null) 'since': since
      }).timeout(const Duration(seconds: 15)) as Map<String, dynamic>;
      if (generation != _sessionGeneration ||
          !identical(
              database, _database ?? OfflineDatabaseRegistry.activeDatabase)) {
        return;
      }
      await applyPull(payload, database: database);
      try {
        final history = await api.get('/api/purchase-history') as List;
        if (generation != _sessionGeneration ||
            !identical(database,
                _database ?? OfflineDatabaseRegistry.activeDatabase)) {
          return;
        }
        await OfflineCache.replaceAll(
          'compras',
          history.cast<Map<String, dynamic>>(),
          database: database,
        );
      } catch (_) {
        // Purchase history is an optional extension to the common pull contract.
      }
      _lastSyncTime =
          DateTime.tryParse(payload['serverTime'] as String? ?? '')?.toLocal();
      _setOnline(true);
    } on ApiException catch (error) {
      if (error.statusCode == 401 && generation == _sessionGeneration) {
        try {
          await onUnauthorized?.call();
        } catch (_) {
          // Auth cleanup is best effort; the failed response is never cached.
        }
        return;
      }
      try {
        final result = await _connectivity.checkConnectivity();
        _setOnline(_hasConnection(result));
      } catch (_) {
        _setOnline(false);
      }
    } catch (_) {
      try {
        final result = await _connectivity.checkConnectivity();
        _setOnline(_hasConnection(result));
      } catch (_) {
        _setOnline(false);
      }
    } finally {
      _syncingGenerations.remove(generation);
      _isSyncing = _syncingGenerations.contains(_sessionGeneration);
      notifyListeners();
    }
  }

  Future<void> _pushPendingReservations(
      ApiClient api, OfflineDatabase database) async {
    final reservations = await database.readRows('reservas');
    final pending = reservations
        .where(
            (row) => row['syncStatus'] == 'pending' && row['idLocal'] is String)
        .toList();
    if (pending.isEmpty) return;

    try {
      final response = await api.post('/api/sync/push', body: {
        'operations': pending
            .map((row) => {
                  'idLocal': row['idLocal'],
                  'tipo': 'reserva',
                  'payload': {
                    'idLocal': row['idLocal'],
                    'idCliente': row['idCliente'],
                    'fecha': row['fecha'],
                    'horario': row['horario'],
                    'codigoSucursal': row['codigoSucursal'],
                    'idProducto': row['idProducto'],
                  },
                })
            .toList(),
      }).timeout(const Duration(seconds: 15)) as Map<String, dynamic>;
      final results = response['results'];
      if (results is! List) return;
      for (final item in results) {
        if (item is! Map) continue;
        final result = Map<String, dynamic>.from(item);
        final idLocal = result['idLocal'];
        if (idLocal is! String) continue;
        Map<String, dynamic>? local;
        for (final row in pending) {
          if (row['idLocal'] == idLocal) {
            local = row;
            break;
          }
        }
        if (local == null) continue;

        final status = result['status'];
        if (status == 'synced') {
          final serverReservation = result['reserva'] is Map
              ? Map<String, dynamic>.from(result['reserva'] as Map)
              : <String, dynamic>{};
          await database.putRow('reservas', {
            ...local,
            ...serverReservation,
            'idLocal': idLocal,
            'estado': 'confirmada',
            'syncStatus': 'synced',
            'syncReason': null,
          });
        } else if (status == 'conflict' || status == 'rejected') {
          final reason = status == 'rejected'
              ? result['error'] ?? {'code': 'unknown'}
              : result['conflict'] ?? {'code': 'unknown'};
          await database.putRow('reservas', {
            ...local,
            'estado': status == 'conflict' ? 'conflicto' : 'rechazada',
            'syncStatus': status,
            'syncReason': reason is String ? reason : jsonEncode(reason),
          });
        }
      }
    } catch (_) {
      // Conserva la operación pendiente; el próximo ciclo reusa el mismo UUID.
    }
  }

  Future<void> applyPull(Map<String, dynamic> payload,
      {OfflineDatabase? database}) async {
    final target =
        database ?? _database ?? OfflineDatabaseRegistry.activeDatabase;
    if (target == null) throw StateError('Offline database is not active');
    final localReservations = (await target.readRows('reservas'))
        .where((row) => row['idLocal'] != null)
        .toList();

    await target.transaction(() async {
      if (payload['full'] == true) {
        await target.clearCachedTables();
        for (final reservation in localReservations) {
          await target.putRow('reservas', reservation);
        }
      }

      for (final collection in _collections) {
        final rows = payload[collection];
        if (collection == 'cliente') {
          if (rows is Map<String, dynamic>) {
            await target.putRow(collection, rows);
          }
          continue;
        }
        if (rows is List) {
          for (final row in rows) {
            if (row is Map<String, dynamic>) {
              if (collection == 'reservas') {
                final serverId = row['codigoReserva'];
                Map<String, dynamic>? matchingLocal;
                for (final local in localReservations) {
                  if (local['codigoReserva'] == serverId) {
                    matchingLocal = local;
                    break;
                  }
                }
                if (matchingLocal != null) {
                  await target.putRow('reservas', {
                    ...matchingLocal,
                    ...row,
                    'idLocal': matchingLocal['idLocal'],
                    'estado': matchingLocal['estado'] ?? row['estado'],
                    'syncStatus': matchingLocal['syncStatus'] ?? 'synced',
                    'syncReason': matchingLocal['syncReason'],
                  });
                  continue;
                }
              }
              await target.putRow(collection, row);
            }
          }
        }
      }

      if (payload['full'] != true && payload['deleted'] is Map) {
        final deleted = Map<String, dynamic>.from(payload['deleted'] as Map);
        for (final collection in ['productos', 'inventario', 'reservas']) {
          final ids = deleted[collection];
          if (ids is List && ids.isNotEmpty) {
            await target.deleteRows(collection, ids);
          }
        }
      }

      final serverTime = payload['serverTime'];
      if (serverTime is String && serverTime.isNotEmpty) {
        await target.writeLastServerTime(serverTime);
      }
    });
  }

  Future<void> _restoreLastSyncTime() async {
    final value = await _database?.readLastServerTime();
    _lastSyncTime = value == null ? null : DateTime.tryParse(value)?.toLocal();
  }

  bool _hasConnection(List<ConnectivityResult> result) =>
      result.any((type) => type != ConnectivityResult.none);

  void _setOnline(bool value) {
    OfflineDatabaseRegistry.isOnline = value;
    if (_isOnline == value) return;
    _isOnline = value;
    notifyListeners();
  }

  Future<void> logoutAndWipe() async {
    _sessionGeneration++;
    _isSyncing = _syncingGenerations.contains(_sessionGeneration);
    _periodicTimer?.cancel();
    _periodicTimer = null;
    await _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
    _database = null;
    _lastSyncTime = null;
    await OfflineDatabaseRegistry.wipeActiveDatabase();
    notifyListeners();
  }

  @override
  void dispose() {
    _periodicTimer?.cancel();
    unawaited(_connectivitySubscription?.cancel());
    super.dispose();
  }
}
