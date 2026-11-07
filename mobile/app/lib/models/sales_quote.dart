class SalesQuoteLine {
  const SalesQuoteLine(
      {required this.idProducto,
      required this.cantidad,
      required this.precioLista,
      required this.idPromocion,
      required this.descuentoPromocion,
      required this.precioUnitario});

  final int idProducto;
  final int cantidad;
  final double precioLista;
  final int? idPromocion;
  final double descuentoPromocion;
  final double precioUnitario;

  factory SalesQuoteLine.fromJson(Map<String, dynamic> json) => SalesQuoteLine(
        idProducto: _int(json['idProducto']),
        cantidad: _int(json['cantidad']),
        precioLista: _double(json['precio_lista']),
        idPromocion:
            json['idPromocion'] == null ? null : _int(json['idPromocion']),
        descuentoPromocion: _double(json['descuento_promocion']),
        precioUnitario: _double(json['precio_unitario']),
      );
}

class SalesQuoteAccount {
  const SalesQuoteAccount(
      {required this.saldo,
      required this.nivel,
      required this.puntosMaxCanjeables});
  final int saldo;
  final String nivel;
  final int puntosMaxCanjeables;

  factory SalesQuoteAccount.fromJson(Map<String, dynamic> json) =>
      SalesQuoteAccount(
        saldo: _int(json['saldo']),
        nivel: (json['nivel'] ?? '').toString(),
        puntosMaxCanjeables: _int(json['puntos_max_canjeables']),
      );
}

class SalesQuote {
  const SalesQuote(
      {required this.lineas,
      required this.subtotal,
      required this.descuentoPromociones,
      required this.descuentoCupon,
      required this.descuentoPuntos,
      required this.total,
      required this.idCupon,
      required this.puntosCanjeados,
      required this.puntosAGanar,
      required this.avisos,
      required this.cuenta});

  final List<SalesQuoteLine> lineas;
  final double subtotal;
  final double descuentoPromociones;
  final double descuentoCupon;
  final double descuentoPuntos;
  final double total;
  final int? idCupon;
  final int puntosCanjeados;
  final int puntosAGanar;
  final List<String> avisos;
  final SalesQuoteAccount? cuenta;

  factory SalesQuote.fromJson(Map<String, dynamic> json) => SalesQuote(
        lineas: ((json['lineas'] as List?) ?? const [])
            .map((item) =>
                SalesQuoteLine.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList(growable: false),
        subtotal: _double(json['subtotal']),
        descuentoPromociones: _double(json['descuento_promociones']),
        descuentoCupon: _double(json['descuento_cupon']),
        descuentoPuntos: _double(json['descuento_puntos']),
        total: _double(json['total']),
        idCupon: json['idCupon'] == null ? null : _int(json['idCupon']),
        puntosCanjeados: _int(json['puntos_canjeados']),
        puntosAGanar: _int(json['puntos_a_ganar']),
        avisos: ((json['avisos'] as List?) ?? const [])
            .map((e) => e.toString())
            .toList(growable: false),
        cuenta: json['cuenta'] is Map
            ? SalesQuoteAccount.fromJson(
                Map<String, dynamic>.from(json['cuenta'] as Map))
            : null,
      );
}

int _int(Object? value) =>
    value is num ? value.toInt() : int.parse(value.toString());
double _double(Object? value) =>
    value is num ? value.toDouble() : double.parse(value.toString());
