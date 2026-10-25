import '../data/offline_cache.dart';
import 'api_client.dart';
import '../models/purchase_history_model.dart';

/// Mobile Fase 5: `GET /api/purchase-history`
/// (`backend/app/routers/purchase_history.py`). Auto-escopado al Cliente
/// autenticado del lado del servidor — no recibe parametros.
class PurchaseHistoryService {
  final ApiClient _api;

  PurchaseHistoryService(this._api);

  Future<List<PurchaseHistoryItem>> getHistorialCompras() async {
    final cached = await OfflineCache.read('compras');
    if (cached.isNotEmpty ||
        (!OfflineCache.isOnline && await OfflineCache.hasSnapshot)) {
      return cached.map(PurchaseHistoryItem.fromJson).toList();
    }
    final cacheSession = OfflineCache.captureSession();
    final data = await _api.get('/api/purchase-history') as List;
    final rows = data.cast<Map<String, dynamic>>();
    await OfflineCache.replaceAll('compras', rows, session: cacheSession);
    return rows.map(PurchaseHistoryItem.fromJson).toList();
  }
}
