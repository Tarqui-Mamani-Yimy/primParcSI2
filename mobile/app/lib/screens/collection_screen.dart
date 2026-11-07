import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/aether_theme.dart';
import '../models/product_model.dart';
import '../models/visual_search_model.dart';
import '../providers/app_state.dart';
import '../services/api_client.dart';
import '../services/visual_search_service.dart';

class CollectionScreen extends StatefulWidget {
  const CollectionScreen({super.key});

  @override
  State<CollectionScreen> createState() => _CollectionScreenState();
}

class _CollectionScreenState extends State<CollectionScreen> {
  String selectedFilter = 'Todos';
  final List<String> filters = [
    'Todos',
    'Oversized',
    'Regular',
    'Sastrería',
    'Abrigos'
  ];
  final ImagePicker _imagePicker = ImagePicker();
  final VisualSearchService _visualSearchService =
      VisualSearchService(ApiClient());
  bool _searchingByPhoto = false;

  Future<void> _openPhotoSearch() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Tomar una foto'),
              onTap: () => Navigator.pop(sheetContext, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Elegir de la galería'),
              onTap: () => Navigator.pop(sheetContext, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (!mounted || source == null) return;

    try {
      final image = await _imagePicker.pickImage(
        source: source,
        imageQuality: 85,
      );
      if (image == null || !mounted) return;

      setState(() => _searchingByPhoto = true);
      final response = await _visualSearchService.search(image);
      if (!mounted) return;
      final selected = await showModalBottomSheet<VisualSearchResult>(
        context: context,
        isScrollControlled: true,
        backgroundColor: AetherTheme.sandLight,
        builder: (sheetContext) => _SearchResultsSheet(response: response),
      );
      if (!mounted || selected == null) return;

      final appState = context.read<AppState>();
      final product = appState.products.cast<Product?>().firstWhere(
                (candidate) => candidate?.id == selected.productId.toString(),
                orElse: () => null,
              ) ??
          selected.toProduct();
      appState.selectTryOnProduct(product);
      appState.setTabIndex(2);
    } on ApiException catch (error) {
      if (mounted) _showSearchError(error.message);
    } catch (_) {
      if (mounted) {
        _showSearchError('No pudimos buscar prendas con esa foto.');
      }
    } finally {
      if (mounted) setState(() => _searchingByPhoto = false);
    }
  }

  void _showSearchError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    final filteredProducts = selectedFilter == 'Todos'
        ? appState.products
        : appState.products
            .where(
                (p) => p.category.toLowerCase() == selectedFilter.toLowerCase())
            .toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 2),
          child: SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _searchingByPhoto ? null : _openPhotoSearch,
              icon: _searchingByPhoto
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.image_search_outlined, size: 18),
              label: Text(
                  _searchingByPhoto ? 'Buscando prendas…' : 'Buscar por foto'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AetherTheme.charcoalDark,
                side: const BorderSide(color: AetherTheme.border),
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.zero,
                ),
              ),
            ),
          ),
        ),
        // Filter Chips Bar
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: filters.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final f = filters[index];
              final isSel = f == selectedFilter;
              return ChoiceChip(
                label: Text(f,
                    style: GoogleFonts.outfit(
                        fontSize: 11,
                        fontWeight: isSel ? FontWeight.bold : FontWeight.w500)),
                selected: isSel,
                selectedColor: AetherTheme.charcoalDark,
                backgroundColor: Colors.white.withValues(alpha: 0.6),
                side: const BorderSide(color: AetherTheme.border, width: 0.6),
                labelStyle: TextStyle(
                    color: isSel
                        ? AetherTheme.sandLight
                        : AetherTheme.charcoalDark),
                shape: const RoundedRectangleBorder(
                    borderRadius: BorderRadius.zero),
                showCheckmark: false,
                onSelected: (_) => setState(() => selectedFilter = f),
              );
            },
          ),
        ),

        // Product Grid (catalogo real — Mobile Fase 1)
        if (appState.productsLoading && appState.products.isEmpty)
          const Expanded(
            child: Center(
                child: CircularProgressIndicator(
                    color: AetherTheme.bronze, strokeWidth: 2)),
          )
        else if (appState.productsError != null && appState.products.isEmpty)
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      appState.productsError!,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.sourceSerif4(
                          fontSize: 12, color: AetherTheme.muted),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => appState.loadProducts(),
                      child: Text('Reintentar',
                          style: GoogleFonts.outfit(
                              fontSize: 11,
                              color: AetherTheme.bronze,
                              fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
            ),
          )
        else if (filteredProducts.isEmpty)
          Expanded(
            child: Center(
              child: Text(
                'No hay productos en esta categoría.',
                style: GoogleFonts.sourceSerif4(
                    fontSize: 12, color: AetherTheme.muted),
              ),
            ),
          )
        else
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.58,
                crossAxisSpacing: 12,
                mainAxisSpacing: 16,
              ),
              itemCount: filteredProducts.length,
              itemBuilder: (context, index) {
                final product = filteredProducts[index];
                return Container(
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.5),
                    border: Border.all(
                        color: AetherTheme.border.withValues(alpha: 0.5)),
                    borderRadius: BorderRadius.circular(2),
                  ),
                  padding: const EdgeInsets.all(8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Product Image
                      Expanded(
                        child: Stack(
                          children: [
                            Positioned.fill(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(2),
                                child: CachedNetworkImage(
                                  imageUrl: product.imageUrl,
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                            Positioned(
                              top: 4,
                              left: 4,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 5, vertical: 2),
                                color: AetherTheme.sandLight
                                    .withValues(alpha: 0.9),
                                child: Text(
                                  product.category.toUpperCase(),
                                  style: GoogleFonts.outfit(
                                      fontSize: 7.5,
                                      fontWeight: FontWeight.bold),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        product.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.sourceSerif4(
                            fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '\$${product.price.toInt()}',
                        style: GoogleFonts.sourceSerif4(
                            fontSize: 12, color: AetherTheme.muted),
                      ),
                      const SizedBox(height: 8),
                      // Probar IA Button
                      SizedBox(
                        width: double.infinity,
                        height: 30,
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.face_retouching_natural,
                              size: 13, color: AetherTheme.bronze),
                          label: Text('PROBAR IA',
                              style: GoogleFonts.outfit(
                                  fontSize: 9, fontWeight: FontWeight.bold)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AetherTheme.charcoalDark,
                            side: const BorderSide(color: AetherTheme.border),
                            padding: EdgeInsets.zero,
                            shape: const RoundedRectangleBorder(
                                borderRadius: BorderRadius.zero),
                          ),
                          onPressed: () {
                            appState.selectTryOnProduct(product);
                            appState.setTabIndex(2);
                          },
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _SearchResultsSheet extends StatelessWidget {
  final VisualSearchResponse response;

  const _SearchResultsSheet({required this.response});

  @override
  Widget build(BuildContext context) {
    final message = response.indexedCount == 0
        ? 'El catálogo todavía no tiene prendas indexadas.'
        : 'No encontramos prendas parecidas con stock.';

    return SafeArea(
      child: FractionallySizedBox(
        heightFactor: 0.86,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Resultados similares',
                      style: GoogleFonts.sourceSerif4(
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                    tooltip: 'Cerrar',
                  ),
                ],
              ),
            ),
            if (response.results.isEmpty)
              Expanded(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(message, textAlign: TextAlign.center),
                  ),
                ),
              )
            else
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                  itemCount: response.results.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final result = response.results[index];
                    return Card(
                      color: Colors.white,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.zero,
                      ),
                      child: ListTile(
                        contentPadding: const EdgeInsets.all(10),
                        leading: SizedBox(
                          width: 58,
                          height: 68,
                          child: CachedNetworkImage(
                            imageUrl: result.imageUrl ?? '',
                            fit: BoxFit.cover,
                            placeholder: (_, __) => const ColoredBox(
                              color: AetherTheme.border,
                            ),
                            errorWidget: (_, __, ___) => const Icon(
                              Icons.checkroom_outlined,
                              color: AetherTheme.muted,
                            ),
                          ),
                        ),
                        title: Text(
                          result.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(
                          [
                            if (result.size?.isNotEmpty == true)
                              'Talla ${result.size}',
                            if (result.color?.isNotEmpty == true) result.color!,
                            '${(result.similarity * 100).round()}% de similitud',
                            '${result.stockTotal} disponibles',
                          ].join(' · '),
                        ),
                        trailing: Text('\$${result.price.toInt()}'),
                        onTap: () => Navigator.pop(context, result),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
