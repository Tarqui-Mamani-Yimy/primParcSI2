import 'package:flutter_test/flutter_test.dart';
import 'package:aether_fashion/models/sales_quote.dart';

void main() {
  test('parses the S4 quote breakdown including account and lines', () {
    final quote = SalesQuote.fromJson({
      'lineas': [
        {
          'idProducto': 5,
          'cantidad': 2,
          'precio_lista': 100.0,
          'idPromocion': 9,
          'descuento_promocion': 20.0,
          'precio_unitario': 90.0,
        },
      ],
      'subtotal': 200.0,
      'descuento_promociones': 20.0,
      'descuento_cupon': 0.0,
      'descuento_puntos': 0.0,
      'total': 180.0,
      'idCupon': null,
      'puntos_canjeados': 0,
      'puntos_a_ganar': 18,
      'avisos': [],
      'cuenta': {'saldo': 100, 'nivel': 'Bronce', 'puntos_max_canjeables': 900},
    });

    expect(quote.total, 180);
    expect(quote.lineas.single.precioUnitario, 90);
    expect(quote.cuenta!.nivel, 'Bronce');
    expect(quote.puntosAGanar, 18);
  });
}
