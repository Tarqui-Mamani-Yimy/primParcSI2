import 'package:flutter_test/flutter_test.dart';
import 'package:aether_fashion/models/size_recommendation_model.dart';

void main() {
  group('SizeRecommendation.fromJson', () {
    test('parses the backend recommendation, sizes and feedback summary', () {
      final recommendation = SizeRecommendation.fromJson({
        'idProducto': 42,
        'fuente': 'propia',
        'sin_medidas': false,
        'medidas_cliente': {'pecho': 92, 'cintura': 76},
        'talla_recomendada': 'M',
        'ajuste': 'justa',
        'mensaje': 'La talla M te quedará justa.',
        'aviso_talla': null,
        'tallas': [
          {'talla': 'S', 'ajuste': 'ajustada'},
          {'talla': 'M', 'ajuste': 'justa'},
        ],
        'retroalimentacion': {
          'total': 4,
          'pequena': 3,
          'bien': 1,
          'grande': 0,
          'nota': 'El 75% de los clientes indica que esta prenda queda pequeña',
        },
      });

      expect(recommendation.productId, 42);
      expect(recommendation.source, 'propia');
      expect(recommendation.measurements.chest, 92);
      expect(recommendation.recommendedSize, 'M');
      expect(recommendation.fit, 'justa');
      expect(recommendation.sizes.map((size) => size.size), ['S', 'M']);
      expect(recommendation.sizes.last.fit, 'justa');
      expect(recommendation.feedback.total, 4);
      expect(recommendation.feedback.note, contains('75%'));
    });

    test('parses recommendations without measurements or suggested size', () {
      final recommendation = SizeRecommendation.fromJson({
        'idProducto': 8,
        'fuente': 'generica',
        'sin_medidas': true,
        'medidas_cliente': {'pecho': null, 'cintura': null},
        'talla_recomendada': null,
        'ajuste': null,
        'mensaje': 'Registra tus medidas en tu perfil para recibir una recomendación de talla',
        'aviso_talla': null,
        'tallas': [],
        'retroalimentacion': {
          'total': 0,
          'pequena': 0,
          'bien': 0,
          'grande': 0,
          'nota': null,
        },
      });

      expect(recommendation.hasNoMeasurements, isTrue);
      expect(recommendation.measurements.chest, isNull);
      expect(recommendation.recommendedSize, isNull);
      expect(recommendation.sizes, isEmpty);
      expect(recommendation.feedback.note, isNull);
    });
  });
}
