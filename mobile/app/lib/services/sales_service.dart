import 'api_client.dart';

/// Paso 3 del checkout (Mobile Fase 2): `POST /api/sales`
/// (`backend/app/schemas/fase2.py::VentaIn`/`VentaOut`). Nunca se manda
/// `idCliente` (se deriva del JWT para un Cliente autenticado) ni
/// `codigoSucursal` (compra online, el backend resuelve la sucursal).
class SalesService {
  final ApiClient _api;

  SalesService(this._api);

  /// `items`: `[{'idProducto': int, 'cantidad': int}, ...]`. `idMetPago`
  /// debe venir de un `PagoIntentVerificadoOut.idMetPago` con
  /// `pagado == true` — nunca se llama esto sin un cobro ya verificado.
  Future<Map<String, dynamic>> crearVenta(
    int idMetPago,
    List<Map<String, dynamic>> items, {
    String? codigoCupon,
    int? puntos,
  }) async {
    final data = await _api.post(
      '/api/sales',
      body: {
        'idMetPago': idMetPago,
        'items': items,
        if (codigoCupon != null && codigoCupon.isNotEmpty)
          'codigoCupon': codigoCupon,
        if (puntos != null && puntos > 0) 'puntos': puntos,
      },
    ) as Map<String, dynamic>;
    return data;
  }
}
