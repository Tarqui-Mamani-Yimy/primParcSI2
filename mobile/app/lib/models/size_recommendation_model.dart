class ClientMeasurements {
  final double? chest;
  final double? waist;

  const ClientMeasurements({this.chest, this.waist});

  factory ClientMeasurements.fromJson(Map<String, dynamic> json) =>
      ClientMeasurements(
        chest: (json['pecho'] as num?)?.toDouble(),
        waist: (json['cintura'] as num?)?.toDouble(),
      );
}

class RecommendedSizeFit {
  final String size;
  final String fit;

  const RecommendedSizeFit({required this.size, required this.fit});

  factory RecommendedSizeFit.fromJson(Map<String, dynamic> json) =>
      RecommendedSizeFit(
        size: json['talla'] as String,
        fit: json['ajuste'] as String,
      );
}

class FitFeedbackSummary {
  final int total;
  final int small;
  final int good;
  final int large;
  final String? note;

  const FitFeedbackSummary({
    required this.total,
    required this.small,
    required this.good,
    required this.large,
    this.note,
  });

  factory FitFeedbackSummary.fromJson(Map<String, dynamic> json) =>
      FitFeedbackSummary(
        total: (json['total'] as num).toInt(),
        small: (json['pequena'] as num).toInt(),
        good: (json['bien'] as num).toInt(),
        large: (json['grande'] as num).toInt(),
        note: json['nota'] as String?,
      );
}

class SizeRecommendation {
  final int productId;
  final String source;
  final bool hasNoMeasurements;
  final ClientMeasurements measurements;
  final String? recommendedSize;
  final String? fit;
  final String message;
  final String? sizeWarning;
  final List<RecommendedSizeFit> sizes;
  final FitFeedbackSummary feedback;

  const SizeRecommendation({
    required this.productId,
    required this.source,
    required this.hasNoMeasurements,
    required this.measurements,
    required this.recommendedSize,
    required this.fit,
    required this.message,
    required this.sizeWarning,
    required this.sizes,
    required this.feedback,
  });

  factory SizeRecommendation.fromJson(Map<String, dynamic> json) =>
      SizeRecommendation(
        productId: (json['idProducto'] as num).toInt(),
        source: json['fuente'] as String,
        hasNoMeasurements: json['sin_medidas'] as bool,
        measurements: ClientMeasurements.fromJson(
          json['medidas_cliente'] as Map<String, dynamic>,
        ),
        recommendedSize: json['talla_recomendada'] as String?,
        fit: json['ajuste'] as String?,
        message: json['mensaje'] as String,
        sizeWarning: json['aviso_talla'] as String?,
        sizes: (json['tallas'] as List<dynamic>)
            .map((item) => RecommendedSizeFit.fromJson(
                  item as Map<String, dynamic>,
                ))
            .toList(growable: false),
        feedback: FitFeedbackSummary.fromJson(
          json['retroalimentacion'] as Map<String, dynamic>,
        ),
      );

  String? fitFor(String size) {
    for (final item in sizes) {
      if (item.size == size) return item.fit;
    }
    return null;
  }
}

class FitFeedbackEntry {
  final int productId;
  final String productName;
  final String? size;
  final String? imageUrl;
  final String? result;
  final String? date;

  const FitFeedbackEntry({
    required this.productId,
    required this.productName,
    this.size,
    this.imageUrl,
    this.result,
    this.date,
  });

  factory FitFeedbackEntry.fromJson(Map<String, dynamic> json) =>
      FitFeedbackEntry(
        productId: (json['idProducto'] as num).toInt(),
        productName: json['nombre'] as String,
        size: json['talla'] as String?,
        imageUrl: json['imagen_url'] as String?,
        result: json['resultado'] as String?,
        date: json['fecha'] as String?,
      );
}

class FitFeedbackResponse {
  final int productId;
  final String? size;
  final String result;
  final String? comment;
  final String? date;

  const FitFeedbackResponse({
    required this.productId,
    this.size,
    required this.result,
    this.comment,
    this.date,
  });

  factory FitFeedbackResponse.fromJson(Map<String, dynamic> json) =>
      FitFeedbackResponse(
        productId: (json['idProducto'] as num).toInt(),
        size: json['talla'] as String?,
        result: json['resultado'] as String,
        comment: json['comentario'] as String?,
        date: json['fecha'] as String?,
      );
}
