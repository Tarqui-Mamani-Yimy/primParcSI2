import 'dart:async';
import 'dart:io';

import 'package:aether_fashion/data/offline_database.dart';
import 'package:aether_fashion/services/api_client.dart';
import 'package:aether_fashion/services/offline_sync_service.dart';
import 'package:aether_fashion/services/reservations_service.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeConnectivity implements Connectivity {
  final changes = StreamController<List<ConnectivityResult>>.broadcast();
  List<ConnectivityResult> current = [ConnectivityResult.none];

  @override
  Future<List<ConnectivityResult>> checkConnectivity() async => current;

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged => changes.stream;
}

class _FakeApi implements ApiClient {
  final List<Map<String, dynamic>> pushes = [];
  final responses = <Completer<dynamic>>[];

  @override
  Future<dynamic> get(String path,
      {Map<String, dynamic>? query, bool auth = true}) {
    if (path == '/api/sync/pull') {
      return Future.value({
        'serverTime': '2026-10-25T10:00:00Z',
        'full': true,
        'reservas': <Map<String, dynamic>>[],
        'deleted': <String, dynamic>{},
      });
    }
    return Future.value(<dynamic>[]);
  }

  @override
  Future<dynamic> post(String path, {Object? body, bool auth = true}) {
    pushes.add(Map<String, dynamic>.from(body as Map));
    final completer = Completer<dynamic>();
    responses.add(completer);
    return completer.future;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _waitForSync(OfflineSyncService sync) async {
  while (sync.isSyncing) {
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

Future<void> _waitForPush(_FakeApi api) async {
  final deadline = DateTime.now().add(const Duration(seconds: 3));
  while (api.pushes.isEmpty && DateTime.now().isBefore(deadline)) {
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  expect(api.pushes, isNotEmpty);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;

  late Directory documentsDirectory;
  late _FakeConnectivity connectivity;
  late _FakeApi api;
  late OfflineSyncService sync;
  late ReservationsService reservations;

  setUp(() async {
    documentsDirectory =
        await Directory.systemTemp.createTemp('offline-reservations');
    connectivity = _FakeConnectivity();
    api = _FakeApi();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (_) async => documentsDirectory.path,
    );
    await OfflineDatabaseRegistry.openForIdentity(idEmpresa: 1, idUser: 10);
    OfflineDatabaseRegistry.isOnline = false;
    await OfflineDatabaseRegistry.activeDatabase!.putRow('cliente', {
      'idCliente': 7,
      'idUser': 10,
      'nombre': 'Cliente',
    });
    sync = OfflineSyncService(api, connectivity: connectivity);
    reservations = ReservationsService(api);
  });

  tearDown(() async {
    sync.dispose();
    await connectivity.changes.close();
    await OfflineDatabaseRegistry.closeActiveDatabase();
    await documentsDirectory.delete(recursive: true);
  });

  test('saves an offline reservation with a stable UUID and pending state',
      () async {
    final result = await reservations.crearReservaOffline(
      fecha: '2026-11-01',
      horario: '10:30',
      codigoSucursal: 3,
      idProducto: 12,
    );

    expect(result['idLocal'], matches(RegExp(r'^[0-9a-f-]{36}$')));
    expect(result['estado'], 'pendiente_confirmacion');
    expect(await OfflineDatabaseRegistry.activeDatabase!.readRows('reservas'),
        [result]);
  });

  test('pushes a pending reservation after connectivity returns', () async {
    await reservations.crearReservaOffline(
      fecha: '2026-11-01',
      horario: '10:30',
      codigoSucursal: 3,
      idProducto: 12,
    );
    await sync.startForIdentity(idEmpresa: 1, idUser: 10);
    connectivity.current = [ConnectivityResult.wifi];
    connectivity.changes.add(connectivity.current);
    await _waitForPush(api);

    expect(api.pushes, hasLength(1));
    final operation = (api.pushes.single['operations'] as List).single as Map;
    expect(operation['tipo'], 'reserva');
    expect(operation['idLocal'], isNotEmpty);
    expect((operation['payload'] as Map)['idCliente'], 7);
    api.responses.single.complete({
      'results': [
        {
          'idLocal': operation['idLocal'],
          'status': 'synced',
          'reserva': {
            'codigoReserva': 55,
            'estado': 'Pendiente',
            'fecha': '2026-11-01',
            'horario': '10:30',
            'codigoSucursal': 3,
            'idProducto': 12,
          }
        }
      ]
    });
    await _waitForSync(sync);

    final saved =
        (await OfflineDatabaseRegistry.activeDatabase!.readRows('reservas'))
            .single;
    expect(saved['syncStatus'], 'synced');
    expect(saved['estado'], 'confirmada');
    expect(saved['codigoReserva'], 55);
  });

  test('retries an unacknowledged push using the same idLocal', () async {
    await reservations.crearReservaOffline(
      fecha: '2026-11-01',
      horario: '10:30',
      codigoSucursal: 3,
      idProducto: 12,
    );
    await sync.startForIdentity(idEmpresa: 1, idUser: 10);
    connectivity.current = [ConnectivityResult.wifi];
    connectivity.changes.add(connectivity.current);
    await _waitForPush(api);
    final first = api.pushes.single;
    api.responses.single.complete({'results': []});
    while (sync.isSyncing) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
    final saved =
        (await OfflineDatabaseRegistry.activeDatabase!.readRows('reservas'))
            .single;
    expect(saved['syncStatus'], 'pending');
    await sync.syncNow();
    while (api.responses.length < 2) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }

    expect(api.pushes, hasLength(2));
    expect((api.pushes[1]['operations'] as List).single['idLocal'],
        (first['operations'] as List).single['idLocal']);
    api.responses[1].complete({'results': []});
    await _waitForSync(sync);
  });

  test('records conflicts without deleting the reservation payload', () async {
    final pending = await reservations.crearReservaOffline(
      fecha: '2026-11-01',
      horario: '10:30',
      codigoSucursal: 3,
      idProducto: 12,
    );
    await sync.startForIdentity(idEmpresa: 1, idUser: 10);
    connectivity.current = [ConnectivityResult.wifi];
    connectivity.changes.add(connectivity.current);
    await _waitForPush(api);
    api.responses.single.complete({
      'results': [
        {
          'idLocal': pending['idLocal'],
          'status': 'conflict',
          'conflict': {'code': 'stock_insufficient'}
        }
      ]
    });
    await _waitForSync(sync);

    final saved =
        (await OfflineDatabaseRegistry.activeDatabase!.readRows('reservas'))
            .single;
    expect(saved['idLocal'], pending['idLocal']);
    expect(saved['fecha'], '2026-11-01');
    expect(saved['syncStatus'], 'conflict');
    expect(saved['syncReason'], contains('stock_insufficient'));
  });

  test('records rejected operations and preserves their reservation data',
      () async {
    final pending = await reservations.crearReservaOffline(
      fecha: '2026-11-01',
      horario: '10:30',
      codigoSucursal: 3,
      idProducto: 12,
    );
    await sync.startForIdentity(idEmpresa: 1, idUser: 10);
    connectivity.current = [ConnectivityResult.wifi];
    connectivity.changes.add(connectivity.current);
    await _waitForPush(api);
    api.responses.single.complete({
      'results': [
        {
          'idLocal': pending['idLocal'],
          'status': 'rejected',
          'error': {'code': 'permission_denied'}
        }
      ]
    });
    await _waitForSync(sync);

    final saved =
        (await OfflineDatabaseRegistry.activeDatabase!.readRows('reservas'))
            .single;
    expect(saved['idLocal'], pending['idLocal']);
    expect(saved['idProducto'], 12);
    expect(saved['estado'], 'rechazada');
    expect(saved['syncStatus'], 'rejected');
    expect(saved['syncReason'], contains('permission_denied'));
  });

  test(
      'incremental pull updates a synced local reservation without duplicating it',
      () async {
    final database = OfflineDatabaseRegistry.activeDatabase!;
    await database.putRow('reservas', {
      'idLocal': 'aaaa-aaaa-aaaa-aaaa',
      'codigoReserva': 55,
      'estado': 'confirmada',
      'syncStatus': 'synced',
      'fecha': '2026-11-01',
    });

    await sync.applyPull({
      'full': false,
      'serverTime': '2026-10-25T11:00:00Z',
      'reservas': [
        {'codigoReserva': 55, 'estado': 'Pendiente'},
      ],
      'deleted': <String, dynamic>{},
    });

    final rows = await database.readRows('reservas');
    expect(rows, hasLength(1));
    expect(rows.single['idLocal'], 'aaaa-aaaa-aaaa-aaaa');
    expect(rows.single['syncStatus'], 'synced');
    expect(rows.single['estado'], 'Pendiente');
  });

  test('incremental pull refreshes synced reservation state from the server',
      () async {
    final database = OfflineDatabaseRegistry.activeDatabase!;
    await database.putRow('reservas', {
      'idLocal': 'aaaa-aaaa-aaaa-aaaa',
      'codigoReserva': 55,
      'estado': 'confirmada',
      'syncStatus': 'synced',
      'syncReason': null,
      'fecha': '2026-11-01',
    });

    await sync.applyPull({
      'full': false,
      'reservas': [
        {'codigoReserva': 55, 'estado': 'Cancelada'},
      ],
      'deleted': <String, dynamic>{},
    });

    final rows = await database.readRows('reservas');
    expect(rows, hasLength(1));
    expect(rows.single['idLocal'], 'aaaa-aaaa-aaaa-aaaa');
    expect(rows.single['estado'], 'Cancelada');
  });

  test('incremental reservation tombstone removes the local UUID-keyed row',
      () async {
    final database = OfflineDatabaseRegistry.activeDatabase!;
    await database.putRow('reservas', {
      'idLocal': 'aaaa-aaaa-aaaa-aaaa',
      'codigoReserva': 55,
      'estado': 'confirmada',
      'syncStatus': 'synced',
      'fecha': '2026-11-01',
    });

    await sync.applyPull({
      'full': false,
      'serverTime': '2026-10-25T11:00:00Z',
      'deleted': {
        'reservas': [55],
      },
    });

    expect(await database.readRows('reservas'), isEmpty);
  });
}
