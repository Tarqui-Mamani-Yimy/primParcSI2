import 'package:flutter_test/flutter_test.dart';
import 'package:aether_fashion/models/visual_search_model.dart';

void main() {
  test('parses the S7 response and ranked product fields', () {
    final response = VisualSearchResponse.fromJson({
      'resultados': [
        {
          'idProducto': 42,
          'nombre': 'Camisa de lino',
          'talla': 'M',
          'color': 'Azul',
          'venta': 125.5,
          'imagen_url': 'https://example.test/camisa.jpg',
          'similitud': 0.927,
          'stock_total': 3,
        },
      ],
      'indexados': 6,
    });

    expect(response.indexedCount, 6);
    expect(response.results, hasLength(1));
    final product = response.results.single;
    expect(product.productId, 42);
    expect(product.name, 'Camisa de lino');
    expect(product.size, 'M');
    expect(product.color, 'Azul');
    expect(product.price, 125.5);
    expect(product.imageUrl, 'https://example.test/camisa.jpg');
    expect(product.similarity, 0.927);
    expect(product.stockTotal, 3);
  });

  test('accepts nullable variant and image fields in S7 results', () {
    final result = VisualSearchResult.fromJson({
      'idProducto': 43,
      'nombre': 'Abrigo',
      'talla': null,
      'color': null,
      'venta': 400,
      'imagen_url': null,
      'similitud': 0.8,
      'stock_total': 1,
    });

    expect(result.size, isNull);
    expect(result.color, isNull);
    expect(result.imageUrl, isNull);
  });
}
