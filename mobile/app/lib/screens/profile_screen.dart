import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/aether_theme.dart';
import '../providers/app_state.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  void _showRecalibrateDialog(BuildContext context, AppState appState) {
    final m = appState.userProfile.measurements;
    final hCtrl = TextEditingController(text: '${m.height}');
    final cCtrl = TextEditingController(text: '${m.chest}');
    final wCtrl = TextEditingController(text: '${m.waist}');
    final iCtrl = TextEditingController(text: '${m.inseam}');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AetherTheme.sandLight,
        title: Text('Recalibrar Medidas', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: hCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Altura (cm)')),
              TextField(controller: cCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Pecho (cm)')),
              TextField(controller: wCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Cintura (cm)')),
              TextField(controller: iCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Tiro (cm)')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('CANCELAR')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AetherTheme.charcoalDark, foregroundColor: AetherTheme.sandLight),
            onPressed: () {
              appState.updateMeasurements(
                int.tryParse(hCtrl.text) ?? m.height,
                int.tryParse(cCtrl.text) ?? m.chest,
                int.tryParse(wCtrl.text) ?? m.waist,
                int.tryParse(iCtrl.text) ?? m.inseam,
              );
              Navigator.of(ctx).pop();
            },
            child: const Text('GUARDAR'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final profile = appState.userProfile;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // User Header
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundImage: NetworkImage(profile.avatarUrl),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(profile.name, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w600, color: AetherTheme.charcoalDark)),
                  Text(profile.email, style: GoogleFonts.sourceSerif4(fontSize: 12, color: const Color(0xFF7B776E))),
                ],
              ),
            ],
          ),

          const SizedBox(height: 20),

          // 1. Biometric Measurements Block
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.7),
              border: Border.all(color: const Color(0xFFCCC6BC).withOpacity(0.6)),
              borderRadius: BorderRadius.circular(2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.straighten, size: 16, color: AetherTheme.charcoalDark),
                        const SizedBox(width: 6),
                        Text('Medidas Biométricas', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600)),
                      ],
                    ),
                    Row(
                      children: [
                        const Icon(Icons.lock, size: 12, color: Color(0xFF7B776E)),
                        const SizedBox(width: 4),
                        Text('PRIVADO', style: GoogleFonts.outfit(fontSize: 8.5, color: const Color(0xFF7B776E), fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _measureItem('ALTURA', '${profile.measurements.height} cm'),
                    _measureItem('PECHO', '${profile.measurements.chest} cm'),
                    _measureItem('CINTURA', '${profile.measurements.waist} cm'),
                    _measureItem('TIRO', '${profile.measurements.inseam} cm'),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 34,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.tune, size: 14),
                    label: Text('RECALIBRAR MEDIDAS', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AetherTheme.charcoalDark,
                      side: const BorderSide(color: AetherTheme.charcoalDark),
                      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                    ),
                    onPressed: () => _showRecalibrateDialog(context, appState),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // 2. AI Style Insights
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.7),
              border: Border.all(color: const Color(0xFFCCC6BC).withOpacity(0.6)),
              borderRadius: BorderRadius.circular(2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.auto_awesome, size: 16, color: AetherTheme.bronze),
                    const SizedBox(width: 6),
                    Text('AI Style Insights', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  profile.styleInsights,
                  style: GoogleFonts.sourceSerif4(fontSize: 11.5, height: 1.5, color: const Color(0xFF4A463F)),
                ),
                const SizedBox(height: 12),
                Text('PALETA RECOMENDADA', style: GoogleFonts.outfit(fontSize: 9, fontWeight: FontWeight.bold, color: const Color(0xFF7B776E))),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  children: profile.recommendedPalette.map((c) {
                    final hexColor = Color(int.parse(c.hex.replaceFirst('#', '0xFF')));
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF7F4EF),
                        border: Border.all(color: const Color(0xFFCCC6BC)),
                        borderRadius: BorderRadius.circular(2),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(width: 10, height: 10, color: hexColor),
                          const SizedBox(width: 4),
                          Text(c.name, style: GoogleFonts.outfit(fontSize: 9)),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // 3. Saved Outfits
          Text('LOOKS GUARDADOS (${profile.savedOutfits.length})', style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.5, color: const Color(0xFF7B776E))),
          const SizedBox(height: 8),
          SizedBox(
            height: 180,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: profile.savedOutfits.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final look = profile.savedOutfits[index];
                return Container(
                  width: 120,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFCCC6BC)),
                    borderRadius: BorderRadius.circular(2),
                  ),
                  padding: const EdgeInsets.all(6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(2),
                          child: CachedNetworkImage(imageUrl: look.imageUrl, fit: BoxFit.cover, width: double.infinity),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(look.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: GoogleFonts.outfit(fontSize: 9, fontWeight: FontWeight.bold)),
                      Text(look.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: GoogleFonts.sourceSerif4(fontSize: 8.5, color: const Color(0xFF7B776E))),
                    ],
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  Widget _measureItem(String label, String val) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 2),
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F4EF),
          borderRadius: BorderRadius.circular(2),
          border: Border.all(color: const Color(0xFFCCC6BC).withOpacity(0.4)),
        ),
        child: Column(
          children: [
            Text(label, style: GoogleFonts.outfit(fontSize: 7.5, color: const Color(0xFF7B776E), fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(val, style: GoogleFonts.sourceSerif4(fontSize: 11, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}
