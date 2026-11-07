import '../models/sales_quote.dart';
import 'api_client.dart';

class SalesQuoteService {
  SalesQuoteService(this._api);
  final ApiClient _api;

  Future<SalesQuote> quote(
    List<Map<String, dynamic>> items, {
    String? codigoCupon,
    int? puntos,
  }) async {
    final response = await _api.post('/api/sales/quote', body: {
      'items': items,
      if (codigoCupon != null && codigoCupon.trim().isNotEmpty)
        'codigoCupon': codigoCupon.trim(),
      if (puntos != null && puntos > 0) 'puntos': puntos,
    }) as Map<String, dynamic>;
    return SalesQuote.fromJson(response);
  }
}
