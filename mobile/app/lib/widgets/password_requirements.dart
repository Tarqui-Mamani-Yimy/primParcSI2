import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../theme/aether_theme.dart';
import '../utils/password_policy.dart';

/// Lista de requisitos de la contrasena que se marcan en vivo mientras el
/// usuario escribe, mas una barra de fuerza.
class PasswordRequirements extends StatelessWidget {
  final String password;

  const PasswordRequirements({super.key, required this.password});

  @override
  Widget build(BuildContext context) {
    final fuerza = PasswordPolicy.fuerza(password);
    final colorFuerza = fuerza >= 1.0
        ? const Color(0xFF3F7D58)
        : fuerza >= 0.6
            ? AetherTheme.bronze
            : const Color(0xFFB4413C);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.6),
        border: Border.all(color: const Color(0xFFCCC6BC)),
        borderRadius: BorderRadius.circular(2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'REQUISITOS DE LA CONTRASEÑA',
                style: GoogleFonts.outfit(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.4,
                  color: const Color(0xFF7B776E),
                ),
              ),
              Text(
                PasswordPolicy.etiquetaFuerza(password),
                style: GoogleFonts.outfit(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  color: password.isEmpty ? const Color(0xFF7B776E) : colorFuerza,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: LinearProgressIndicator(
              value: fuerza,
              minHeight: 3,
              backgroundColor: const Color(0xFFE3DED4),
              color: colorFuerza,
            ),
          ),
          const SizedBox(height: 10),
          ...PasswordPolicy.reglas.map((regla) {
            final cumple = regla.cumple(password);
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 2.0),
              child: Row(
                children: [
                  Icon(
                    cumple ? Icons.check_circle : Icons.radio_button_unchecked,
                    size: 14,
                    color: cumple ? const Color(0xFF3F7D58) : const Color(0xFFA9A399),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      regla.descripcion,
                      style: GoogleFonts.sourceSerif4(
                        fontSize: 11.5,
                        color: cumple
                            ? const Color(0xFF3F7D58)
                            : const Color(0xFF4A463F),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
