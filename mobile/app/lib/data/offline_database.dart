import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';

part 'offline_database.g.dart';

class ProductosCache extends Table {
  TextColumn get id => text()();
  TextColumn get payload => text()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class SucursalesCache extends Table {
  TextColumn get id => text()();
  TextColumn get payload => text()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class InventarioCache extends Table {
  TextColumn get id => text()();
  TextColumn get payload => text()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class ReservasCache extends Table {
  TextColumn get id => text()();
  TextColumn get payload => text()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class VentasCache extends Table {
  TextColumn get id => text()();
  TextColumn get payload => text()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class ClienteCache extends Table {
  TextColumn get id => text()();
  TextColumn get payload => text()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class ComprasCache extends Table {
  TextColumn get id => text()();
  TextColumn get payload => text()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class OfflineMeta extends Table {
  TextColumn get key => text()();
  TextColumn get value => text()();

  @override
  Set<Column<Object>> get primaryKey => {key};
}

@DriftDatabase(
  tables: [
    ProductosCache,
    SucursalesCache,
    InventarioCache,
    ReservasCache,
    VentasCache,
    ClienteCache,
    ComprasCache,
    OfflineMeta,
  ],
)
class OfflineDatabase extends _$OfflineDatabase {
  OfflineDatabase._(super.e, {required this.scopeKey, this.filePath});

  factory OfflineDatabase.memory({required String scopeKey}) =>
      OfflineDatabase._(NativeDatabase.memory(), scopeKey: scopeKey);

  final String scopeKey;
  final String? filePath;

  static Future<OfflineDatabase> openForIdentity({
    required int idEmpresa,
    required int idUser,
  }) async {
    final directory = await getApplicationDocumentsDirectory();
    final file = File('${directory.path}/youshop-$idEmpresa-$idUser.sqlite');
    return OfflineDatabase._(
      NativeDatabase.createInBackground(file),
      scopeKey: '$idEmpresa-$idUser',
      filePath: file.path,
    );
  }

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onUpgrade: (migrator, from, to) async {
          if (from < 2) {
            await transaction(() async {
              final inventoryRows = await select(inventarioCache).get();
              await delete(inventarioCache).go();
              for (final row in inventoryRows) {
                final payload =
                    Map<String, dynamic>.from(jsonDecode(row.payload) as Map);
                final id = payload['idInv'];
                if (id != null) {
                  await into(inventarioCache).insert(
                    InventarioCacheCompanion.insert(
                      id: id.toString(),
                      payload: row.payload,
                    ),
                  );
                }
              }

              final reservationRows = await select(reservasCache).get();
              await delete(reservasCache).go();
              for (final row in reservationRows) {
                final payload =
                    Map<String, dynamic>.from(jsonDecode(row.payload) as Map);
                final id = payload['codigoReserva'];
                if (id != null) {
                  await into(reservasCache).insert(
                    ReservasCacheCompanion.insert(
                      id: id.toString(),
                      payload: row.payload,
                    ),
                  );
                }
              }
            });
          }
        },
      );

  Future<List<Map<String, dynamic>>> readRows(String collection) async {
    final rows = switch (collection) {
      'productos' =>
        (await select(productosCache).get()).map((row) => row.payload).toList(),
      'sucursales' => (await select(sucursalesCache).get())
          .map((row) => row.payload)
          .toList(),
      'inventario' => (await select(inventarioCache).get())
          .map((row) => row.payload)
          .toList(),
      'reservas' =>
        (await select(reservasCache).get()).map((row) => row.payload).toList(),
      'ventas' =>
        (await select(ventasCache).get()).map((row) => row.payload).toList(),
      'cliente' =>
        (await select(clienteCache).get()).map((row) => row.payload).toList(),
      'compras' =>
        (await select(comprasCache).get()).map((row) => row.payload).toList(),
      _ => throw ArgumentError.value(
          collection, 'collection', 'Unknown cache collection'),
    };
    return rows
        .map((row) => Map<String, dynamic>.from(jsonDecode(row) as Map))
        .toList();
  }

  Future<void> putRow(String collection, Map<String, dynamic> row) async {
    final id = _rowId(collection, row);
    final payload = jsonEncode(row);
    switch (collection) {
      case 'productos':
        await into(productosCache).insertOnConflictUpdate(
            ProductosCacheCompanion.insert(id: id, payload: payload));
      case 'sucursales':
        await into(sucursalesCache).insertOnConflictUpdate(
            SucursalesCacheCompanion.insert(id: id, payload: payload));
      case 'inventario':
        await into(inventarioCache).insertOnConflictUpdate(
            InventarioCacheCompanion.insert(id: id, payload: payload));
      case 'reservas':
        await into(reservasCache).insertOnConflictUpdate(
            ReservasCacheCompanion.insert(id: id, payload: payload));
      case 'ventas':
        await into(ventasCache).insertOnConflictUpdate(
            VentasCacheCompanion.insert(id: id, payload: payload));
      case 'cliente':
        await into(clienteCache).insertOnConflictUpdate(
            ClienteCacheCompanion.insert(id: id, payload: payload));
      case 'compras':
        await into(comprasCache).insertOnConflictUpdate(
            ComprasCacheCompanion.insert(id: id, payload: payload));
      default:
        throw ArgumentError.value(
            collection, 'collection', 'Unknown cache collection');
    }
  }

  Future<void> deleteRows(String collection, Iterable<Object?> ids) async {
    final keys = ids.map((id) => id.toString()).toSet();
    switch (collection) {
      case 'productos':
        await (delete(productosCache)..where((row) => row.id.isIn(keys))).go();
      case 'sucursales':
        await (delete(sucursalesCache)..where((row) => row.id.isIn(keys))).go();
      case 'inventario':
        await (delete(inventarioCache)..where((row) => row.id.isIn(keys))).go();
      case 'reservas':
        await (delete(reservasCache)..where((row) => row.id.isIn(keys))).go();
      case 'ventas':
        await (delete(ventasCache)..where((row) => row.id.isIn(keys))).go();
      case 'cliente':
        await (delete(clienteCache)..where((row) => row.id.isIn(keys))).go();
      case 'compras':
        await (delete(comprasCache)..where((row) => row.id.isIn(keys))).go();
      default:
        throw ArgumentError.value(
            collection, 'collection', 'Unknown cache collection');
    }
  }

  Future<void> clearCachedTables() async {
    await delete(productosCache).go();
    await delete(sucursalesCache).go();
    await delete(inventarioCache).go();
    await delete(reservasCache).go();
    await delete(ventasCache).go();
    await delete(clienteCache).go();
    await delete(comprasCache).go();
  }

  Future<void> replaceRows(
      String collection, List<Map<String, dynamic>> rows) async {
    await transaction(() async {
      switch (collection) {
        case 'compras':
          await delete(comprasCache).go();
        case 'cliente':
          await delete(clienteCache).go();
        default:
          throw ArgumentError.value(
              collection, 'collection', 'Collection cannot be replaced');
      }
      for (final row in rows) {
        await putRow(collection, row);
      }
    });
  }

  Future<void> writeLastServerTime(String value) async {
    await into(offlineMeta).insertOnConflictUpdate(
      OfflineMetaCompanion.insert(key: 'lastServerTime', value: value),
    );
  }

  Future<String?> readLastServerTime() async {
    final row = await (select(offlineMeta)
          ..where((meta) => meta.key.equals('lastServerTime')))
        .getSingleOrNull();
    return row?.value;
  }

  String _rowId(String collection, Map<String, dynamic> row) {
    Object? value = switch (collection) {
      'productos' => row['idProducto'],
      'sucursales' => row['codigoSucursal'],
      'inventario' => row['idInv'],
      'reservas' => row['codigoReserva'],
      'ventas' => row['idVenta'],
      'cliente' => row['idCliente'] ?? 'profile',
      'compras' =>
        row['codigoHistorial'] ?? '${row['idVenta']}:${row['idProducto']}',
      _ => null,
    };
    if (value == null) {
      throw FormatException('Missing primary key for $collection cache row');
    }
    return value.toString();
  }
}

class OfflineDatabaseRegistry {
  OfflineDatabaseRegistry._();

  static OfflineDatabase? _activeDatabase;
  static OfflineDatabase? get activeDatabase => _activeDatabase;
  static int _sessionGeneration = 0;
  static int get sessionGeneration => _sessionGeneration;

  static bool isCurrentSession(OfflineCacheSession session) =>
      session.generation == _sessionGeneration &&
      identical(session.database, _activeDatabase);
  static bool isOnline = true;

  static Future<OfflineDatabase> openForIdentity({
    required int idEmpresa,
    required int idUser,
  }) async {
    final scopeKey = '$idEmpresa-$idUser';
    if (_activeDatabase?.scopeKey == scopeKey) return _activeDatabase!;
    _sessionGeneration++;
    await _activeDatabase?.close();
    _activeDatabase = await OfflineDatabase.openForIdentity(
        idEmpresa: idEmpresa, idUser: idUser);
    return _activeDatabase!;
  }

  static Future<void> wipeActiveDatabase() async {
    _sessionGeneration++;
    final database = _activeDatabase;
    if (database == null) return;
    _activeDatabase = null;
    final path = database.filePath;
    await database.close();
    if (path != null) {
      final file = File(path);
      if (await file.exists()) await file.delete();
    }
  }

  static Future<void> closeActiveDatabase() async {
    _sessionGeneration++;
    final database = _activeDatabase;
    _activeDatabase = null;
    await database?.close();
  }

  static Future<void> wipeForIdentity({
    required int idEmpresa,
    required int idUser,
  }) async {
    final scopeKey = '$idEmpresa-$idUser';
    if (_activeDatabase?.scopeKey == scopeKey) {
      await wipeActiveDatabase();
      return;
    }
    final directory = await getApplicationDocumentsDirectory();
    final file = File('${directory.path}/youshop-$idEmpresa-$idUser.sqlite');
    if (await file.exists()) await file.delete();
  }
}

class OfflineCacheSession {
  const OfflineCacheSession({required this.database, required this.generation});

  final OfflineDatabase database;
  final int generation;
}
