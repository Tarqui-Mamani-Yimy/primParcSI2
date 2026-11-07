import 'package:image_picker/image_picker.dart';

import '../models/visual_search_model.dart';
import 'api_client.dart';

class VisualSearchService {
  final ApiClient _api;

  VisualSearchService(this._api);

  Future<VisualSearchResponse> search(XFile image) async {
    final json = await _api.postMultipart(
      '/api/products/visual-search',
      fieldName: 'imagen',
      fileName: image.name,
      bytes: await image.readAsBytes(),
    ) as Map<String, dynamic>;
    return VisualSearchResponse.fromJson(json);
  }
}
