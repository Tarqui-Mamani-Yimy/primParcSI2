import 'package:aether_fashion/data/offline_database.dart';
import 'package:aether_fashion/services/api_client.dart';
import 'package:aether_fashion/services/offline_purchases_service.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter_test/flutter_test.dart';

class _FakeApi implements ApiClient {
  int quotes = 0;
  final List<Map<String, dynamic>> sales = [];
  final List<String> keys = [];
  Object? saleError;
  double quoteTotal = 90;

  @override
  Future<dynamic> post(String path, {Object? body, bool auth = true}) async {
    expect(path, '/api/sales/quote');
    quotes++;
    return {'total': quoteTotal};
  }

  @override
  Future<dynamic> postIdempotent(String path,
      {required String idempotencyKey, Object? body}) async {
    expect(path, '/api/sync/sales');
    keys.add(idempotencyKey);
    sales.add(Map<String, dynamic>.from(body as Map));
    final error = saleError;
    if (error != null) throw error;
    return {'idVenta': 55};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  late OfflineDatabase database;
  late _FakeApi api;

  setUp(() async {
    database = OfflineDatabase.memory(scopeKey: 'empresa-4-user-6');
    api = _FakeApi();
    await database.putRow('cliente', {'idCliente': 2, 'nombre': 'Juan'});
  });

  tearDown(() async => database.close());

  Future<Map<String, dynamic>> createPurchase() =>
      OfflinePurchasesService.create(
        database: database,
        codigoSucursal: 3,
        items: [
          {'idProducto': 10, 'cantidad': 2},
        ],
        totalEstimado: 90,
        now: DateTime.utc(2026, 11, 10, 15),
      );

  test('stores the purchase in SQLite as pending with a local UUID', () async {
    final purchase = await createPurchase();

    final rows = await OfflinePurchasesService.readAll(database);
    expect(rows, hasLength(1));
    expect(rows.single['idLocal'], purchase['idLocal']);
    expect(rows.single['idCliente'], 2);
    expect(rows.single['codigoSucursal'], 3);
    expect(rows.single['syncStatus'], 'pending');
    expect(rows.single['comprobanteLocal'], startsWith('APP-'));
  });

  test('requires the cached customer profile', () async {
    await database.replaceRows('cliente', []);
    expect(createPurchase, throwsStateError);
    expect(await OfflinePurchasesService.readAll(database), isEmpty);
  });

  test('syncs as a cash sale with the UUID as Idempotency-Key', () async {
    final purchase = await createPurchase();

    final answered = await OfflinePurchasesService.pushPending(api, database);

    expect(answered.single['syncStatus'], 'synced');
    expect(answered.single['idVenta'], 55);
    expect(api.keys, [purchase['idLocal']]);
    final body = api.sales.single;
    expect(body['idLocal'], purchase['idLocal']);
    expect(body['idCliente'], 2);
    expect(body['codigoSucursal'], 3);
    expect(body['fechaLocal'], '2026-11-10T15:00:00.000Z');
    expect(body['pago'], {'tipo': 'Efectivo', 'monto': 90.0});
    expect(body.containsKey('codigoCupon'), isFalse);
    expect(body.containsKey('puntos'), isFalse);
    expect(await OfflinePurchasesService.readAll(database), isEmpty);
  });

  test('a network failure keeps it pending and the retry reuses key and amount',
      () async {
    final purchase = await createPurchase();
    api.saleError = Exception('offline');

    await OfflinePurchasesService.pushPending(api, database);

    final pending = await OfflinePurchasesService.readAll(database);
    expect(pending.single['syncStatus'], 'pending');
    expect(pending.single['monto'], 90.0);

    api.saleError = null;
    api.quoteTotal = 75;
    await OfflinePurchasesService.pushPending(api, database);

    expect(api.quotes, 1);
    expect(api.keys, [purchase['idLocal'], purchase['idLocal']]);
    expect(api.sales.last['pago'], {'tipo': 'Efectivo', 'monto': 90.0});
    expect(await OfflinePurchasesService.readAll(database), isEmpty);
  });

  test('a rejected purchase keeps a readable reason and can be discarded',
      () async {
    final purchase = await createPurchase();
    api.saleError = ApiException(422, 'Error del servidor (422).',
        code: 'inventory_not_found');

    await OfflinePurchasesService.pushPending(api, database);

    final rows = await OfflinePurchasesService.readAll(database);
    expect(rows.single['syncStatus'], 'rejected');
    expect(rows.single['syncReason'],
        'La sucursal elegida no tiene uno de los productos.');

    await OfflinePurchasesService.pushPending(api, database);
    expect(api.sales, hasLength(1));

    await OfflinePurchasesService.discard(
        database, purchase['idLocal'] as String);
    expect(await OfflinePurchasesService.readAll(database), isEmpty);
  });

  test('an expired session is rethrown and the purchase stays pending',
      () async {
    await createPurchase();
    api.saleError = ApiException(401, 'No autenticado');

    await expectLater(OfflinePurchasesService.pushPending(api, database),
        throwsA(isA<ApiException>()));

    final rows = await OfflinePurchasesService.readAll(database);
    expect(rows.single['syncStatus'], 'pending');
  });
}
