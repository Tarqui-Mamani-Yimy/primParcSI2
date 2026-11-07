import '../models/size_recommendation_model.dart';
import 'api_client.dart';

/// Reads size recommendations and stores the authenticated client's fit feedback.
class SizeRecommendationService {
  final ApiClient _api;

  SizeRecommendationService(this._api);

  Future<SizeRecommendation> getRecommendation(int productId) async {
    final json = await _api.get(
      '/api/products/$productId/size-recommendation',
    ) as Map<String, dynamic>;
    return SizeRecommendation.fromJson(json);
  }

  Future<List<FitFeedbackEntry>> getMyFeedback() async {
    final json = await _api.get('/api/fit-feedback/mine') as List<dynamic>;
    return json
        .map((item) => FitFeedbackEntry.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<FitFeedbackResponse> submitFeedback({
    required int productId,
    required String result,
  }) async {
    final json = await _api.post(
      '/api/products/$productId/fit-feedback',
      body: {'resultado': result},
    ) as Map<String, dynamic>;
    return FitFeedbackResponse.fromJson(json);
  }
}
