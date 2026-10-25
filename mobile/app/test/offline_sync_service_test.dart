import 'package:drift/drift.dart';
import 'package:aether_fashion/data/offline_database.dart';
import 'package:aether_fashion/services/offline_sync_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  late OfflineDatabase database;
  late OfflineSyncService syncService;

  setUp(() {
    database = OfflineDatabase.memory(scopeKey: 'empresa-7-user-3');
    syncService = OfflineSyncService.forDatabase(database);
  });

  tearDown(() async {
    await database.close();
  });

  test('applies pull rows as upserts', () async {
    await syncService.applyPull({
      'serverTime': '2026-10-18T10:00:00Z',
      'full': false,
      'productos': [
        {'idProducto': 1, 'nombre': 'Camisa'},
      ],
      'sucursales': [],
      'inventario': [],
      'reservas': [],
      'ventas': [],
      'cliente': null,
      'deleted': {},
    });

    expect(await database.readRows('productos'), [
      {'idProducto': 1, 'nombre': 'Camisa'},
    ]);

    await syncService.applyPull({
      'serverTime': '2026-10-18T10:05:00Z',
      'full': false,
      'productos': [
        {'idProducto': 1, 'nombre': 'Camisa actualizada'},
      ],
      'deleted': {},
    });

    expect(await database.readRows('productos'), [
      {'idProducto': 1, 'nombre': 'Camisa actualizada'},
    ]);
  });

  test('applies deleted tombstones to matching rows only', () async {
    await syncService.applyPull({
      'serverTime': '2026-10-18T10:00:00Z',
      'full': false,
      'productos': [
        {'idProducto': 1, 'nombre': 'Keep'},
        {'idProducto': 2, 'nombre': 'Delete'},
      ],
      'inventario': [
        {
          'idInv': 101,
          'idProducto': 1,
          'codigoSucursal': 3,
          'cantidad_actual': 4
        },
        {
          'idInv': 102,
          'idProducto': 2,
          'codigoSucursal': 3,
          'cantidad_actual': 1
        },
      ],
      'deleted': {
        'productos': [2],
        'inventario': [102],
      },
    });

    expect(await database.readRows('productos'), [
      {'idProducto': 1, 'nombre': 'Keep'},
    ]);
    expect(await database.readRows('inventario'), [
      {
        'idInv': 101,
        'idProducto': 1,
        'codigoSucursal': 3,
        'cantidad_actual': 4
      },
    ]);
  });

  test('full snapshot replaces cached tables before applying rows', () async {
    await syncService.applyPull({
      'serverTime': '2026-10-18T10:00:00Z',
      'full': false,
      'productos': [
        {'idProducto': 1, 'nombre': 'Stale'},
      ],
      'sucursales': [
        {'codigoSucursal': 9, 'nombre': 'Stale branch'},
      ],
      'inventario': [],
      'reservas': [],
      'ventas': [],
      'cliente': null,
      'deleted': {},
    });

    await syncService.applyPull({
      'serverTime': '2026-10-18T11:00:00Z',
      'full': true,
      'productos': [
        {'idProducto': 2, 'nombre': 'Snapshot'},
      ],
      'sucursales': [],
      'inventario': [],
      'reservas': [],
      'ventas': [],
      'cliente': null,
      'deleted': {},
    });

    expect(await database.readRows('productos'), [
      {'idProducto': 2, 'nombre': 'Snapshot'},
    ]);
    expect(await database.readRows('sucursales'), isEmpty);
    expect(await database.readLastServerTime(), '2026-10-18T11:00:00Z');
  });

  test('applies a delayed pull only to the database captured for its session',
      () async {
    final nextSessionDatabase =
        OfflineDatabase.memory(scopeKey: 'empresa-8-user-4');
    addTearDown(nextSessionDatabase.close);
    final payload = {
      'full': false,
      'productos': [
        {'idProducto': 1, 'nombre': 'Tenant one response'},
      ],
    };

    await syncService.applyPull(payload, database: database);

    expect(await database.readRows('productos'), [
      {'idProducto': 1, 'nombre': 'Tenant one response'},
    ]);
    expect(await nextSessionDatabase.readRows('productos'), isEmpty);
  });

  test('keeps in-memory databases isolated by user and empresa scope',
      () async {
    final otherDatabase = OfflineDatabase.memory(scopeKey: 'empresa-8-user-3');
    addTearDown(otherDatabase.close);

    await database.putRow('productos', {
      'idProducto': 1,
      'nombre': 'Tenant one',
    });

    expect(database.scopeKey, isNot(otherDatabase.scopeKey));
    expect(await otherDatabase.readRows('productos'), isEmpty);
  });
}
