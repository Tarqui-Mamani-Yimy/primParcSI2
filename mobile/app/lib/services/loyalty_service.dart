import 'api_client.dart';

class LoyaltyService {
  LoyaltyService(this._api);
  final ApiClient _api;

  Future<Map<String, dynamic>> getMine() async =>
      await _api.get('/api/loyalty/me') as Map<String, dynamic>;
}
