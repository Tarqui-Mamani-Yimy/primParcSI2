import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AetherTheme {
  // Voguely palette. Keep this class name because it is an internal identifier.
  static const Color primary = Color(0xFF38133E);
  static const Color primarySoft = Color(0xFFF5EBF7);
  static const Color canvas = Color(0xFFFAF8F5);
  static const Color surface = Color(0xFFF3EFEA);
  static const Color border = Color(0xFFE8E2DA);
  static const Color textMain = Color(0xFF17141A);
  static const Color muted = Color(0xFF5A5561);
  static const Color subtle = Color(0xFF9B94A3);
  static const Color success = Color(0xFF16A34A);
  static const Color successSoft = Color(0xFFDCFCE7);
  static const Color error = Color(0xFFB3261E);
  static const Color white = Color(0xFFFFFFFF);

  // Existing internal names retained for the mobile screens.
  static const Color sand = surface;
  static const Color sandLight = canvas;
  static const Color sandDark = primarySoft;
  static const Color charcoal = textMain;
  static const Color charcoalDark = textMain;
  static const Color bronze = primary;
  static const Color mutedGold = primarySoft;
  static const Color olive = muted;
  static const Color outline = border;

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: canvas,
      primaryColor: primary,
      colorScheme: const ColorScheme.light(
        primary: primary,
        onPrimary: primarySoft,
        secondary: primary,
        onSecondary: primarySoft,
        surface: canvas,
        onSurface: textMain,
        error: error,
        onError: white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: canvas,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: IconThemeData(color: textMain),
      ),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.outfit(
          fontSize: 36,
          fontWeight: FontWeight.w300,
          letterSpacing: 8.0,
          color: charcoalDark,
        ),
        headlineLarge: GoogleFonts.outfit(
          fontSize: 26,
          fontWeight: FontWeight.w400,
          letterSpacing: 1.5,
          color: charcoalDark,
        ),
        headlineMedium: GoogleFonts.outfit(
          fontSize: 20,
          fontWeight: FontWeight.w500,
          letterSpacing: 1.0,
          color: charcoalDark,
        ),
        titleMedium: GoogleFonts.outfit(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
          color: charcoalDark,
        ),
        bodyLarge: GoogleFonts.sourceSerif4(
          fontSize: 15,
          fontWeight: FontWeight.w400,
          height: 1.6,
          color: charcoalDark,
        ),
        bodyMedium: GoogleFonts.sourceSerif4(
          fontSize: 13,
          fontWeight: FontWeight.w400,
          height: 1.5,
          color: textMain,
        ),
        labelLarge: GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.8,
          color: charcoalDark,
        ),
      ),
    );
  }
}
