class OfflineCartLine {
  const OfflineCartLine({
    required this.idProducto,
    required this.cantidad,
    required this.precio,
    this.idColeccion,
    this.idTemporada,
    this.tipo,
  });

  final int idProducto;
  final int cantidad;
  final double precio;
  final int? idColeccion;
  final int? idTemporada;
  final String? tipo;
}

class OfflinePromotion {
  const OfflinePromotion({
    required this.idPromocion,
    required this.tipo,
    this.valor,
    this.n,
    this.m,
    this.alcance = 'todos',
    this.alcanceRef,
    this.productos,
    this.hasProductos = false,
    this.fechaInicio,
    this.fechaFin,
    this.activa = true,
  });

  final int idPromocion;
  final String tipo;
  final double? valor;
  final int? n;
  final int? m;
  final String alcance;
  final String? alcanceRef;
  final List<int>? productos;
  final bool hasProductos;
  final DateTime? fechaInicio;
  final DateTime? fechaFin;
  final bool activa;

  factory OfflinePromotion.fromJson(Map<String, dynamic> json) {
    DateTime? date(Object? value) =>
        value == null ? null : DateTime.tryParse(value.toString());
    return OfflinePromotion(
      idPromocion: _integer(json['idPromocion'] ?? json['id_promocion']),
      tipo: (json['tipo'] ?? '').toString(),
      valor: _number(json['valor']),
      n: json['n'] == null ? null : _integer(json['n']),
      m: json['m'] == null ? null : _integer(json['m']),
      alcance: (json['alcance'] ?? 'todos').toString(),
      alcanceRef: (json['alcance_ref'] ?? json['alcanceRef'])?.toString(),
      productos: json['productos'] is List
          ? (json['productos'] as List).map(_integer).toList(growable: false)
          : null,
      hasProductos: json.containsKey('productos'),
      fechaInicio: date(json['fecha_inicio'] ?? json['fechaInicio']),
      fechaFin: date(json['fecha_fin'] ?? json['fechaFin']),
      activa: json['activa'] == false ? false : json['activa'] != 0,
    );
  }
}

class OfflinePromotionLineQuote {
  const OfflinePromotionLineQuote({
    required this.idProducto,
    required this.cantidad,
    required this.precioLista,
    required this.idPromocion,
    required this.descuentoPromocion,
    required this.precioUnitario,
  });

  final int idProducto;
  final int cantidad;
  final double precioLista;
  final int? idPromocion;
  final double descuentoPromocion;
  final double precioUnitario;

  double get total => _cents(precioUnitario) * cantidad / 100;
}

class OfflinePromotionQuote {
  const OfflinePromotionQuote(
      {required this.lineas,
      required this.subtotal,
      required this.descuentoPromociones,
      required this.total});

  final List<OfflinePromotionLineQuote> lineas;
  final double subtotal;
  final double descuentoPromociones;
  final double total;
}

class OfflinePromotionCalculator {
  OfflinePromotionQuote quote(
    List<OfflineCartLine> items,
    List<OfflinePromotion> promotions, {
    required DateTime now,
  }) {
    final lines = <OfflinePromotionLineQuote>[];
    var subtotalCents = 0;
    var totalCents = 0;

    for (final item in items) {
      if (item.cantidad <= 0) {
        throw ArgumentError.value(
            item.cantidad, 'cantidad', 'must be positive');
      }
      final priceCents = _cents(item.precio);
      final listedCents = priceCents * item.cantidad;
      subtotalCents += listedCents;
      final eligible = promotions.where((p) => _matches(p, item, now)).toList();
      final candidates = eligible
          .map((p) =>
              (promotion: p, discount: _discount(p, priceCents, item.cantidad)))
          .toList();
      candidates.sort((a, b) {
        final byDiscount = b.discount.compareTo(a.discount);
        return byDiscount != 0
            ? byDiscount
            : a.promotion.idPromocion.compareTo(b.promotion.idPromocion);
      });
      final selected = candidates.isEmpty ? null : candidates.first;
      final discountCents = selected?.discount ?? 0;
      final targetCents = (listedCents - discountCents).clamp(0, listedCents);
      // pricing.py persists per-unit prices at cent precision, rounding upward.
      final unitCents =
          targetCents == 0 ? 0 : (targetCents / item.cantidad).ceil();
      final persistedTotalCents = unitCents * item.cantidad;
      totalCents += persistedTotalCents;
      lines.add(OfflinePromotionLineQuote(
        idProducto: item.idProducto,
        cantidad: item.cantidad,
        precioLista: priceCents / 100,
        idPromocion: selected?.promotion.idPromocion,
        descuentoPromocion: (listedCents - persistedTotalCents) / 100,
        precioUnitario: unitCents / 100,
      ));
    }
    return OfflinePromotionQuote(
      lineas: List.unmodifiable(lines),
      subtotal: subtotalCents / 100,
      descuentoPromociones: (subtotalCents - totalCents) / 100,
      total: totalCents / 100,
    );
  }

  bool _matches(
      OfflinePromotion promotion, OfflineCartLine item, DateTime now) {
    if (!promotion.activa ||
        (promotion.fechaInicio != null &&
            now.isBefore(promotion.fechaInicio!)) ||
        (promotion.fechaFin != null && now.isAfter(promotion.fechaFin!))) {
      return false;
    }
    if (promotion.hasProductos) {
      return promotion.productos == null ||
          promotion.productos!.contains(item.idProducto);
    }
    final ref = promotion.alcanceRef?.toLowerCase();
    switch (promotion.alcance) {
      case 'todos':
        return true;
      case 'producto':
        return ref == item.idProducto.toString();
      case 'coleccion':
        return ref == item.idColeccion?.toString();
      case 'temporada':
        return ref == item.idTemporada?.toString();
      case 'tipo':
        return ref == item.tipo?.toLowerCase();
      default:
        return false;
    }
  }

  int _discount(OfflinePromotion promotion, int priceCents, int quantity) {
    int amount;
    switch (promotion.tipo) {
      case 'porcentaje':
        final percentageBasisPoints = ((promotion.valor ?? 0) * 100).round();
        final numerator = priceCents * quantity * percentageBasisPoints;
        amount = (numerator + 5000) ~/ 10000;
        break;
      case 'monto_fijo':
        amount = (priceCents < _cents(promotion.valor ?? 0)
                ? priceCents
                : _cents(promotion.valor ?? 0)) *
            quantity;
        break;
      case 'nxm':
        final n = promotion.n ?? 0;
        final m = promotion.m ?? 0;
        if (n <= m || m < 1) return 0;
        amount = priceCents * (quantity ~/ n) * (n - m);
        break;
      default:
        return 0;
    }
    return amount.clamp(0, priceCents * quantity);
  }
}

int _cents(num value) => (value * 100).round();
int _integer(Object? value) =>
    value is num ? value.toInt() : int.parse(value.toString());
double? _number(Object? value) =>
    value == null ? null : (value as num).toDouble();
