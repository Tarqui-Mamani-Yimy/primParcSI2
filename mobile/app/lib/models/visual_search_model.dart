import 'product_model.dart';

class VisualSearchResponse {
  final List<VisualSearchResult> results;
  final int indexedCount;

  const VisualSearchResponse({
    required this.results,
    required this.indexedCount,
  });

  factory VisualSearchResponse.fromJson(Map<String, dynamic> json) {
    return VisualSearchResponse(
      results: (json['resultados'] as List<dynamic>)
          .map((item) => VisualSearchResult.fromJson(
                Map<String, dynamic>.from(item as Map),
              ))
          .toList(growable: false),
      indexedCount: (json['indexados'] as num).toInt(),
    );
  }
}

class VisualSearchResult {
  final int productId;
  final String name;
  final String? size;
  final String? color;
  final double price;
  final String? imageUrl;
  final double similarity;
  final int stockTotal;

  const VisualSearchResult({
    required this.productId,
    required this.name,
    required this.size,
    required this.color,
    required this.price,
    required this.imageUrl,
    required this.similarity,
    required this.stockTotal,
  });

  factory VisualSearchResult.fromJson(Map<String, dynamic> json) {
    return VisualSearchResult(
      productId: (json['idProducto'] as num).toInt(),
      name: json['nombre'] as String,
      size: json['talla'] as String?,
      color: json['color'] as String?,
      price: (json['venta'] as num).toDouble(),
      imageUrl: json['imagen_url'] as String?,
      similarity: (json['similitud'] as num).toDouble(),
      stockTotal: (json['stock_total'] as num).toInt(),
    );
  }

  Product toProduct() {
    final image = imageUrl;
    final productSize = size;
    return Product(
      id: productId.toString(),
      name: name,
      price: price,
      colorName: color ?? '',
      colorHex: '#9CA3AF',
      category: '',
      imageUrl: image != null && image.isNotEmpty
          ? image
          : 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80',
      description: '',
      details: const [],
      sizes: productSize != null && productSize.isNotEmpty
          ? [productSize]
          : const [],
      inStock: stockTotal > 0,
    );
  }
}
