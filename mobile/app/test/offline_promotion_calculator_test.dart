import 'package:flutter_test/flutter_test.dart';
import 'package:aether_fashion/services/offline_promotion_calculator.dart';

void main() {
  final calculator = OfflinePromotionCalculator();
  final now = DateTime.utc(2026, 11, 7);

  test('applies percentage promotion per line', () {
    final quote = calculator.quote(
      [const OfflineCartLine(idProducto: 1, cantidad: 2, precio: 100)],
      [const OfflinePromotion(idPromocion: 7, tipo: 'porcentaje', valor: 10)],
      now: now,
    );

    expect(quote.total, 180);
    expect(quote.lineas.single.idPromocion, 7);
    expect(quote.lineas.single.precioUnitario, 90);
  });

  test('applies fixed amount per unit and caps at list price', () {
    final quote = calculator.quote(
      [const OfflineCartLine(idProducto: 1, cantidad: 2, precio: 100)],
      [const OfflinePromotion(idPromocion: 8, tipo: 'monto_fijo', valor: 15)],
      now: now,
    );
    final capped = calculator.quote(
      [const OfflineCartLine(idProducto: 1, cantidad: 1, precio: 10)],
      [const OfflinePromotion(idPromocion: 9, tipo: 'monto_fijo', valor: 15)],
      now: now,
    );

    expect(quote.total, 170);
    expect(capped.total, 0);
  });

  test('applies nxm free units exactly as the server', () {
    final quote = calculator.quote(
      [const OfflineCartLine(idProducto: 1, cantidad: 3, precio: 100)],
      [const OfflinePromotion(idPromocion: 10, tipo: 'nxm', n: 3, m: 2)],
      now: now,
    );

    expect(quote.lineas.single.descuentoPromocion, 99.99);
    expect(quote.total, 200.01);
  });

  test('chooses only the best promotion for each line', () {
    final quote = calculator.quote(
      [const OfflineCartLine(idProducto: 1, cantidad: 1, precio: 100)],
      [
        const OfflinePromotion(idPromocion: 1, tipo: 'porcentaje', valor: 10),
        const OfflinePromotion(idPromocion: 2, tipo: 'monto_fijo', valor: 15),
      ],
      now: now,
    );

    expect(quote.total, 85);
    expect(quote.lineas.single.idPromocion, 2);
  });

  test('rounds half-cent percentage discounts up like Decimal ROUND_HALF_UP',
      () {
    final quote = calculator.quote(
      [const OfflineCartLine(idProducto: 1, cantidad: 1, precio: 0.05)],
      [const OfflinePromotion(idPromocion: 11, tipo: 'porcentaje', valor: 10)],
      now: now,
    );

    expect(quote.lineas.single.descuentoPromocion, 0.01);
    expect(quote.total, 0.04);
  });

  test('rounds line discount and persisted unit price to cents like pricing.py',
      () {
    final quote = calculator.quote(
      [const OfflineCartLine(idProducto: 1, cantidad: 1, precio: 10.01)],
      [const OfflinePromotion(idPromocion: 3, tipo: 'porcentaje', valor: 10)],
      now: now,
    );

    expect(quote.lineas.single.descuentoPromocion, 1.00);
    expect(quote.lineas.single.precioUnitario, 9.01);
    expect(quote.total, 9.01);
  });

  test('matches backend nxm rounding for seven units at ten currency units', () {
    final quote = calculator.quote(
      [const OfflineCartLine(idProducto: 1, cantidad: 7, precio: 10)],
      [const OfflinePromotion(idPromocion: 12, tipo: 'nxm', n: 3, m: 2)],
      now: now,
    );

    expect(quote.total, 50.05);
    expect(quote.lineas.single.precioUnitario, 7.15);
  });

  test('uses the server-resolved products list as the promotion scope', () {
    final promotion = OfflinePromotion.fromJson({
      'idPromocion': 13,
      'tipo': 'porcentaje',
      'valor': 20,
      'alcance': 'todos',
      'productos': [2],
    });

    final quote = calculator.quote(
      [
        const OfflineCartLine(idProducto: 1, cantidad: 1, precio: 10),
        const OfflineCartLine(idProducto: 2, cantidad: 1, precio: 10),
      ],
      [promotion],
      now: now,
    );

    expect(quote.lineas[0].idPromocion, isNull);
    expect(quote.lineas[1].idPromocion, 13);
    expect(quote.total, 18);
  });
}
