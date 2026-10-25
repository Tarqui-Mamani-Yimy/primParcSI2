import '../models/sucursal_model.dart';
import '../data/offline_cache.dart';
import 'api_client.dart';

/// `GET /api/inventory/locations` — publico, sin auth (mismo criterio que
/// usa la web para listar sucursales al armar una reserva/traspaso).
class LocationsService {
  final ApiClient _api;

  LocationsService(this._api);

  Future<List<Sucursal>> getSucursales() async {
    final cached = await OfflineCache.read('sucursales');
    if (cached.isNotEmpty ||
        (!OfflineCache.isOnline && await OfflineCache.hasSnapshot)) {
      return cached.map(Sucursal.fromJson).toList();
    }
    final cacheSession = OfflineCache.captureSession();
    final data =
        await _api.get('/api/inventory/locations', auth: false) as List;
    final rows = data.cast<Map<String, dynamic>>();
    await OfflineCache.putAll('sucursales', rows, session: cacheSession);
    return rows.map(Sucursal.fromJson).toList();
  }
}
