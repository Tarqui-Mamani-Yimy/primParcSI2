import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/aether_theme.dart';
import '../providers/app_state.dart';
import '../models/product_model.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Editorial Hero Banner
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: Stack(
                children: [
                  AspectRatio(
                    aspectRatio: 16 / 10,
                    child: CachedNetworkImage(
                      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDWVEjDuUQ_X1l6JvlGJvjXr68r55cZvMqHoC2dCPjlzv-t0nbhrhq4Qt_M_rHaKnhnkmFT9VkhJw7xmdGauzKUYocKh5oT8KKBmmKVpNPtmgqEAlTXR8sVFtg1gPM6FDbsWDApruzAx205g6Z7njnP5tC_1lM3Jy_74UDWgFyxNjMIdyZ6nN-Hvr22utV3vMdZESNVnP_ZSU4cLhu9Ca4obAm09F1M04b9BiLkQp8f03j57smqHSsmVg',
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: const Color(0xFFEAE5DC)),
                    ),
                  ),
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            AetherTheme.charcoalDark.withOpacity(0.85),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 16,
                    left: 16,
                    right: 16,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'OTOÑO / INVIERNO EDIT',
                          style: GoogleFonts.outfit(
                            fontSize: 10,
                            letterSpacing: 2.0,
                            fontWeight: FontWeight.bold,
                            color: AetherTheme.mutedGold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                            'Siluetas Minimalistas y Sastrería Fluida',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.w500,
                            color: AetherTheme.sandLight,
                          ),
                        ),
                        const SizedBox(height: 10),
                        ElevatedButton(
                          onPressed: () => appState.setTabIndex(1),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AetherTheme.sandLight,
                            foregroundColor: AetherTheme.charcoalDark,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                            elevation: 0,
                          ),
                          child: Text(
                            'VER COLECCIÓN',
                            style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // 2. Curated Highlights Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Piezas Destacadas',
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w500, color: AetherTheme.charcoalDark),
                ),
                TextButton(
                  onPressed: () => appState.setTabIndex(1),
                  child: Text(
                    'Ver Todo',
                    style: GoogleFonts.outfit(fontSize: 11, color: AetherTheme.bronze, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),

          // 3. Products Horizontal Strip
          SizedBox(
            height: 250,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              scrollDirection: Axis.horizontal,
              itemCount: appState.products.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final product = appState.products[index];
                return SizedBox(
                  width: 150,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: AspectRatio(
                          aspectRatio: 3 / 4,
                          child: CachedNetworkImage(
                            imageUrl: product.imageUrl,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        product.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.sourceSerif4(fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                      Text(
                        '$${product.price.toInt()}',
                        style: GoogleFonts.sourceSerif4(fontSize: 12, color: const Color(0xFF7B776E)),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 24),

          // 4. Try-On Feature Card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AetherTheme.charcoalDark,
                borderRadius: BorderRadius.circular(2),
              ),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome, color: AetherTheme.mutedGold, size: 28),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Probador Virtual con IA',
                          style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: AetherTheme.sandLight),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Prueba prendas en tiempo real con modelos 3D.',
                          style: GoogleFonts.sourceSerif4(fontSize: 11, color: AetherTheme.sandDark),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () => appState.setTabIndex(2),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AetherTheme.mutedGold,
                      foregroundColor: AetherTheme.charcoalDark,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                    ),
                    child: Text('PROBAR', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
