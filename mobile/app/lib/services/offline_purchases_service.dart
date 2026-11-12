import 'dart:convert';

import 'package:uuid/uuid.dart';

import '../data/offline_database.dart';
import 'api_client.dart';

/// Offline purchases for customers: the purchase is stored in SQLite
/// (`OfflineMeta`, key [metadataKey]) and sent to `POST /api/sync/sales`
/// with the local UUID as `Idempotency-Key` once the device is back online.
///
/// The backend only accepts cash (`Efectivo`) for offline sales and no
/// coupons or points, so an offline purchase is always paid in cash at the
/// branch.
class OfflinePurchasesService {
  OfflinePurchasesService._();

  static const metadataKey = 'pending_purchases';
  static const statusPending = 'pending';
  static const statusRejected = 'rejected';
  static const _uuid = Uuid();

  /// Error codes that mean the server will never accept this purchase as is.
  static const _rejectionMessages = {
    'offline_payment_amount_mismatch':
        'El precio cambió desde que hiciste la compra. Volvé a comprar con conexión.',
    'inventory_not_found': 'La sucursal elegida no tiene uno de los productos.',
    'product_not_found': 'Uno de los productos ya no está disponible.',
    'customer_not_found': 'No encontramos tu cuenta de cliente.',
    'walk_in_customer_unavailable': 'No encontramos tu cuenta de cliente.',
  };

  static Future<List<Map<String, dynamic>>> readAll(
      OfflineDatabase database) async {
    final raw = await database.readMetadata(metadataKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      return (jsonDecode(raw) as List)
          .map((row) => Map<String, dynamic>.from(row as Map))
          .toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> _writeAll(
      OfflineDatabase database, List<Map<String, dynamic>> rows) async {
    await database.writeMetadata(metadataKey, jsonEncode(rows));
  }

  /// Saves a cash purchase made without connection. The UUID is persisted
  /// before any sync attempt and reused on every retry.
  static Future<Map<String, dynamic>> create({
    required OfflineDatabase database,
    required int codigoSucursal,
    required List<Map<String, dynamic>> items,
    required double totalEstimado,
    DateTime? now,
  }) async {
    if (items.isEmpty) {
      throw StateError('La bolsa está vacía.');
    }
    final clientes = await database.readRows('cliente');
    final idCliente = clientes.isEmpty ? null : clientes.first['idCliente'];
    if (idCliente is! num) {
      throw StateError(
          'Conectate una vez para preparar tus datos de compra sin conexión.');
    }
    final idLocal = _uuid.v4();
    final purchase = <String, dynamic>{
      'idLocal': idLocal,
      'comprobanteLocal': 'APP-${idLocal.substring(0, 8).toUpperCase()}',
      'fechaLocal': (now ?? DateTime.now()).toUtc().toIso8601String(),
      'codigoSucursal': codigoSucursal,
      'idCliente': idCliente.toInt(),
      'items': items
          .map((item) => {
                'idProducto': item['idProducto'],
                'cantidad': item['cantidad'],
              })
          .toList(),
      'totalEstimado': totalEstimado,
      'monto': null,
      'syncStatus': statusPending,
      'syncReason': null,
    };
    final rows = await readAll(database);
    rows.add(purchase);
    await _writeAll(database, rows);
    return purchase;
  }

  /// Removes a purchase the server rejected, once the customer has seen it.
  static Future<void> discard(OfflineDatabase database, String idLocal) async {
    final rows = await readAll(database);
    rows.removeWhere((row) =>
        row['idLocal'] == idLocal && row['syncStatus'] == statusRejected);
    await _writeAll(database, rows);
  }

  /// Sends every pending purchase. Synced purchases are removed (the real
  /// sale arrives with the next purchase-history pull); purchases the server
  /// rejects stay with a reason; network or server errors keep them pending.
  /// A 401 is rethrown so the caller can close the session.
  ///
  /// Returns the purchases answered in this run (synced or rejected), so the
  /// caller can notify the customer.
  static Future<List<Map<String, dynamic>>> pushPending(
      ApiClient api, OfflineDatabase database) async {
    final rows = await readAll(database);
    final answered = <Map<String, dynamic>>[];
    if (!rows.any((row) => row['syncStatus'] == statusPending)) return answered;

    for (var index = 0; index < rows.length; index++) {
      final row = rows[index];
      if (row['syncStatus'] != statusPending) continue;
      try {
        var monto = (row['monto'] as num?)?.toDouble();
        if (monto == null) {
          final quote = await api.post('/api/sales/quote', body: {
            'items': row['items'],
          }).timeout(const Duration(seconds: 15)) as Map<String, dynamic>;
          monto = (quote['total'] as num).toDouble();
          rows[index] = {...row, 'monto': monto};
          await _writeAll(database, rows);
        }
        final sale = await api.postIdempotent(
          '/api/sync/sales',
          idempotencyKey: row['idLocal'] as String,
          body: {
            'idLocal': row['idLocal'],
            'comprobanteLocal': row['comprobanteLocal'],
            'fechaLocal': row['fechaLocal'],
            'codigoSucursal': row['codigoSucursal'],
            'idCliente': row['idCliente'],
            'pago': {'tipo': 'Efectivo', 'monto': monto},
            'items': row['items'],
          },
        ).timeout(const Duration(seconds: 15));
        rows[index] = {
          ...rows[index],
          'syncStatus': 'synced',
          'idVenta': sale is Map ? sale['idVenta'] : null,
        };
        answered.add(rows[index]);
      } on ApiException catch (error) {
        if (error.statusCode == 401) {
          await _writeAll(database, _withoutSynced(rows));
          rethrow;
        }
        if (error.statusCode >= 400 &&
            error.statusCode < 500 &&
            error.statusCode != 408 &&
            error.statusCode != 429) {
          rows[index] = {
            ...rows[index],
            'syncStatus': statusRejected,
            'syncReason': _rejectionMessages[error.code] ?? error.message,
          };
          answered.add(rows[index]);
          continue;
        }
        break;
      } catch (_) {
        // Network failure: keep it pending, the next cycle reuses the UUID.
        break;
      }
    }
    await _writeAll(database, _withoutSynced(rows));
    return answered;
  }

  static List<Map<String, dynamic>> _withoutSynced(
          List<Map<String, dynamic>> rows) =>
      rows.where((row) => row['syncStatus'] != 'synced').toList();
}
