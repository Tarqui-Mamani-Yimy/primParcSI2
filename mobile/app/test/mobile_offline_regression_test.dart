import 'dart:async';
import 'dart:io';

import 'package:aether_fashion/data/offline_cache.dart';
import 'package:aether_fashion/data/offline_database.dart';
import 'package:aether_fashion/services/api_client.dart';
import 'package:aether_fashion/services/auth_service.dart';
import 'package:aether_fashion/services/offline_sync_service.dart';
import 'package:aether_fashion/services/products_service.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeConnectivity implements Connectivity {
  @override
  Future<List<ConnectivityResult>> checkConnectivity() async =>
      [ConnectivityResult.wifi];

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged =>
      const Stream.empty();
}

class _FakeApi implements ApiClient {
  final Map<String, List<Completer<dynamic>>> responses = {};
  final List<String> calls = [];

  @override
  Future<dynamic> get(String path,
      {Map<String, dynamic>? query, bool auth = true}) {
    calls.add(path);
    final completer = Completer<dynamic>();
    responses.putIfAbsent(path, () => []).add(completer);
    return completer.future;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Map<String, dynamic> _fullPull() => {
      'serverTime': '2026-10-18T10:00:00Z',
      'full': true,
      'productos': <Map<String, dynamic>>[],
      'deleted': <String, dynamic>{},
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;

  late Directory documentsDirectory;
  final storage = <String, String>{};

  setUp(() async {
    documentsDirectory = await Directory.systemTemp.createTemp('offline-docs');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (_) async => documentsDirectory.path,
    );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async {
        final args = Map<String, dynamic>.from(call.arguments as Map);
        final key = args['key'] as String?;
        switch (call.method) {
          case 'read':
            return storage[key];
          case 'write':
            storage[key!] = args['value'] as String;
            return null;
          case 'delete':
            storage.remove(key);
            return null;
        }
        return null;
      },
    );
  });

  tearDown(() async {
    await OfflineDatabaseRegistry.closeActiveDatabase();
    await documentsDirectory.delete(recursive: true);
  });

  test('drops an old products response after switching tenant databases',
      () async {
    final syncApi = _FakeApi();
    final sync = OfflineSyncService(syncApi, connectivity: _FakeConnectivity());
    await sync.startForIdentity(idEmpresa: 1, idUser: 10);

    final productsApi = _FakeApi();
    final response = ProductsService(productsApi).getProducts();
    await Future<void>.delayed(Duration.zero);

    await sync.logoutAndWipe();
    await sync.startForIdentity(idEmpresa: 2, idUser: 20);
    productsApi.responses['/api/products']!.first.complete({
      'items': [
        {'idProducto': 90, 'nombre': 'EMPRESA1-PRODUCT', 'venta': 1},
      ],
    });
    await response;

    expect(await OfflineCache.read('productos'), isEmpty);
    await sync.logoutAndWipe();
    sync.dispose();
  });

  test('starts a pull immediately for a new identity while old pull is pending',
      () async {
    final api = _FakeApi();
    final sync = OfflineSyncService(api, connectivity: _FakeConnectivity());
    await sync.startForIdentity(idEmpresa: 1, idUser: 10);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(api.responses['/api/sync/pull'], hasLength(1));

    await sync.startForIdentity(idEmpresa: 2, idUser: 20);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(api.responses['/api/sync/pull'], hasLength(2));

    for (final pending in api.responses['/api/sync/pull']!) {
      pending.complete(_fullPull());
    }
    await sync.logoutAndWipe();
    sync.dispose();
  });

  test('routes a sync 401 to session logout handling', () async {
    final api = _FakeApi();
    var unauthorized = false;
    final sync = OfflineSyncService(
      api,
      connectivity: _FakeConnectivity(),
      onUnauthorized: () async => unauthorized = true,
    );
    await sync.startForIdentity(idEmpresa: 1, idUser: 10);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    api.responses['/api/sync/pull']!.single.completeError(
      ApiException(401, 'expired'),
    );
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(unauthorized, isTrue);
    await sync.logoutAndWipe();
    sync.dispose();
  });

  test('wipes persisted identity cache when session restore receives 401',
      () async {
    storage
      ..['youshop_access_token'] = 'expired'
      ..['youshop_user'] =
          '{"idUser":10,"nombre":"A","correo":"a@example.com","rol":"Cliente","permisos":[],"idEmpresa":1}';
    final databaseFile = File('${documentsDirectory.path}/youshop-1-10.sqlite');
    await databaseFile.writeAsString('cached database');
    final api = _UnauthorizedApi();

    expect(await AuthService(api).tryRestoreSession(), isNull);
    expect(storage, isEmpty);
    expect(await databaseFile.exists(), isFalse);
  });

  test('caches reservation rows keyed by codigoReserva', () async {
    final database = OfflineDatabase.memory(scopeKey: 'empresa-1-user-10');
    addTearDown(database.close);
    final sync = OfflineSyncService.forDatabase(database);

    await sync.applyPull({
      ..._fullPull(),
      'productos': [
        {'idProducto': 1, 'nombre': 'Camisa'},
      ],
      'reservas': [
        {'codigoReserva': 5, 'idCliente': 7, 'estado': 'Pendiente'},
      ],
    });

    expect(await database.readRows('productos'), hasLength(1));
    expect(await database.readRows('reservas'), [
      {'codigoReserva': 5, 'idCliente': 7, 'estado': 'Pendiente'},
    ]);
  });

  test('deletes inventory by its idInv tombstone', () async {
    final database = OfflineDatabase.memory(scopeKey: 'empresa-1-user-10');
    addTearDown(database.close);
    final sync = OfflineSyncService.forDatabase(database);

    await sync.applyPull({
      ..._fullPull(),
      'inventario': [
        {
          'idInv': 10,
          'idProducto': 3,
          'codigoSucursal': 1,
          'cantidad_actual': 4
        },
        {
          'idInv': 11,
          'idProducto': 10,
          'codigoSucursal': 1,
          'cantidad_actual': 9
        },
      ],
    });
    await sync.applyPull({
      'serverTime': '2026-10-18T10:05:00Z',
      'full': false,
      'deleted': {
        'inventario': [10]
      },
    });

    expect(await database.readRows('inventario'), [
      {
        'idInv': 11,
        'idProducto': 10,
        'codigoSucursal': 1,
        'cantidad_actual': 9
      },
    ]);
  });
}

class _UnauthorizedApi implements ApiClient {
  @override
  Future<dynamic> get(String path,
      {Map<String, dynamic>? query, bool auth = true}) async {
    throw ApiException(401, 'expired');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
