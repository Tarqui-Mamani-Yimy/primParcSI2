import '../data/offline_cache.dart';
import '../data/offline_database.dart';
import 'api_client.dart';
import 'package:uuid/uuid.dart';

/// Mobile Fase 3: `POST /api/reservations` / `GET /api/reservations`
/// (`backend/app/schemas/fase2.py::ReservaIn`/`ReservaOut`). Nunca se manda
/// `idCliente` — se deriva del JWT para un Cliente autenticado, mismo
/// criterio que `SalesService`.
class ReservationsService {
  static const _uuid = Uuid();
  final ApiClient _api;

  ReservationsService(this._api);

  /// Guarda una reserva sin depósito cuando el cliente está sin conexión.
  /// El UUID se persiste antes de sincronizar y se reutiliza en cada reintento.
  Future<Map<String, dynamic>> crearReservaOffline({
    required String fecha,
    required String horario,
    required int codigoSucursal,
    required int idProducto,
  }) async {
    final database = OfflineDatabaseRegistry.activeDatabase;
    if (database == null) {
      throw StateError('Iniciá sesión para guardar una reserva sin conexión.');
    }
    final clientes = await database.readRows('cliente');
    final idCliente = clientes.isEmpty ? null : clientes.first['idCliente'];
    if (idCliente is! num) {
      throw StateError(
          'Conectate una vez para preparar tus datos de reserva sin conexión.');
    }
    final idLocal = _uuid.v4();
    final reserva = <String, dynamic>{
      'idLocal': idLocal,
      'idCliente': idCliente.toInt(),
      'fecha': fecha,
      'horario': horario,
      'codigoSucursal': codigoSucursal,
      'idProducto': idProducto,
      'estado': 'pendiente_confirmacion',
      'syncStatus': 'pending',
    };
    await database.putRow('reservas', reserva);
    return reserva;
  }

  /// `fecha`: `YYYY-MM-DD`. `horario`: `HH:MM`. `idMetPago` debe venir de un
  /// `PagoIntentVerificadoOut.idMetPago` con `pagado == true` — nunca se
  /// llama esto sin un cobro de deposito ya verificado.
  Future<Map<String, dynamic>> crearReserva({
    required String fecha,
    required String horario,
    required int codigoSucursal,
    required int idProducto,
    required int idMetPago,
  }) async {
    final data = await _api.post(
      '/api/reservations',
      body: {
        'fecha': fecha,
        'horario': horario,
        'codigoSucursal': codigoSucursal,
        'idProducto': idProducto,
        'idMetPago': idMetPago,
      },
    ) as Map<String, dynamic>;
    return data;
  }

  /// Auto-escopado al Cliente autenticado del lado del servidor.
  Future<List<Map<String, dynamic>>> getMisReservas() async {
    final cached = await OfflineCache.read('reservas');
    if (cached.isNotEmpty ||
        (!OfflineCache.isOnline && await OfflineCache.hasSnapshot)) {
      return cached;
    }
    final cacheSession = OfflineCache.captureSession();
    final data = await _api.get('/api/reservations') as List;
    final rows = data.cast<Map<String, dynamic>>();
    await OfflineCache.putAll('reservas', rows, session: cacheSession);
    return rows;
  }
}
