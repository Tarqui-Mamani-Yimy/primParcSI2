import 'offline_database.dart';

class OfflineCache {
  OfflineCache._();

  static OfflineCacheSession? captureSession() {
    final database = OfflineDatabaseRegistry.activeDatabase;
    if (database == null) return null;
    return OfflineCacheSession(
      database: database,
      generation: OfflineDatabaseRegistry.sessionGeneration,
    );
  }

  static Future<List<Map<String, dynamic>>> read(String collection) async {
    final database = OfflineDatabaseRegistry.activeDatabase;
    if (database == null) return [];
    return database.readRows(collection);
  }

  static bool get isOnline => OfflineDatabaseRegistry.isOnline;

  static Future<bool> get hasSnapshot async =>
      await OfflineDatabaseRegistry.activeDatabase?.readLastServerTime() !=
      null;

  static Future<void> putAll(
      String collection, Iterable<Map<String, dynamic>> rows,
      {OfflineCacheSession? session}) async {
    if (session == null || !OfflineDatabaseRegistry.isCurrentSession(session)) {
      return;
    }
    final database = session.database;
    await database.transaction(() async {
      for (final row in rows) {
        await database.putRow(collection, row);
      }
    });
  }

  static Future<void> replaceAll(
      String collection, List<Map<String, dynamic>> rows,
      {OfflineDatabase? database, OfflineCacheSession? session}) async {
    final target = session == null
        ? database
        : OfflineDatabaseRegistry.isCurrentSession(session)
            ? session.database
            : null;
    if (target == null) return;
    await target.replaceRows(collection, rows);
  }
}
