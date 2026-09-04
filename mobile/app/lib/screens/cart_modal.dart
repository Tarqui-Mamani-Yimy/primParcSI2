import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/aether_theme.dart';
import '../providers/app_state.dart';

class CartModal extends StatelessWidget {
  const CartModal({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: AetherTheme.sandLight,
        borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Bolsa de Compras (${appState.totalCartCount})', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600)),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFCCC6BC)),

          // Items list
          Expanded(
            child: appState.cart.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.shopping_bag_outlined, size: 48, color: Color(0xFFCCC6BC)),
                        const SizedBox(height: 12),
                        Text('Tu bolsa está vacía.', style: GoogleFonts.sourceSerif4(fontSize: 14, color: const Color(0xFF7B776E))),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: appState.cart.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final item = appState.cart[index];
                      return Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: SizedBox(
                              width: 60,
                              height: 75,
                              child: CachedNetworkImage(imageUrl: item.product.imageUrl, fit: BoxFit.cover),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.product.name, style: GoogleFonts.sourceSerif4(fontSize: 13, fontWeight: FontWeight.w600)),
                                Text('Talla: ${item.size} • Color: ${item.product.colorName}', style: GoogleFonts.outfit(fontSize: 10, color: const Color(0xFF7B776E))),
                                const SizedBox(height: 4),
                                Text('$${item.product.price.toInt()}', style: GoogleFonts.sourceSerif4(fontSize: 12, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                          Row(
                            children: [
                              IconButton(
                                icon: const Icon(Icons.remove, size: 16),
                                onPressed: () => appState.updateCartQuantity(index, -1),
                              ),
                              Text('${item.quantity}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.add, size: 16),
                                onPressed: () => appState.updateCartQuantity(index, 1),
                              ),
                            ],
                          ),
                        ],
                      );
                    },
                  ),
          ),

          // Footer
          if (appState.cart.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFFCCC6BC), width: 0.5)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Subtotal', style: GoogleFonts.outfit(fontSize: 14)),
                      Text('$${appState.cartSubtotal.toInt()}', style: GoogleFonts.sourceSerif4(fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AetherTheme.charcoalDark,
                        foregroundColor: AetherTheme.sandLight,
                        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                      ),
                      onPressed: () {
                        Navigator.of(context).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Procesando tu pedido en AETHER…')),
                        );
                      },
                      child: Text('FINALIZAR COMPRA', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
