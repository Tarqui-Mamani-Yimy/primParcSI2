import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/aether_theme.dart';
import 'main_navigation_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController(text: 'jane@example.com');
  final _passwordController = TextEditingController(text: '••••••••');

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _proceed() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const MainNavigationShell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AetherTheme.sandLight,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AetherTheme.charcoalDark),
          onPressed: _proceed,
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Bienvenido.',
                style: GoogleFonts.outfit(
                  fontSize: 30,
                  fontWeight: FontWeight.w500,
                  color: AetherTheme.charcoalDark,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Accede a tu perfil biométrico y colecciones exclusivas.',
                style: GoogleFonts.sourceSerif4(
                  fontSize: 14,
                  color: const Color(0xFF4A463F),
                ),
              ),
              const SizedBox(height: 36),
              Text(
                'CORREO ELECTRÓNICO',
                style: GoogleFonts.outfit(
                  fontSize: 10,
                  letterSpacing: 1.8,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF7B776E),
                ),
              ),
              TextField(
                controller: _emailController,
                style: GoogleFonts.sourceSerif4(fontSize: 14),
                decoration: const InputDecoration(
                  border: UnderlineInputBorder(
                    borderSide: BorderSide(color: AetherTheme.outline),
                  ),
                  focusedBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: AetherTheme.charcoalDark, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 28),
              Text(
                'CONTRASEÑA',
                style: GoogleFonts.outfit(
                  fontSize: 10,
                  letterSpacing: 1.8,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF7B776E),
                ),
              ),
              TextField(
                controller: _passwordController,
                obscureText: true,
                style: GoogleFonts.sourceSerif4(fontSize: 14),
                decoration: const InputDecoration(
                  border: UnderlineInputBorder(
                    borderSide: BorderSide(color: AetherTheme.outline),
                  ),
                  focusedBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: AetherTheme.charcoalDark, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _proceed,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AetherTheme.charcoalDark,
                    foregroundColor: AetherTheme.sandLight,
                    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                  ),
                  child: Text(
                    'INICIAR SESIÓN',
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2.0,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: _proceed,
                  child: Text(
                    'Continuar como Invitado',
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      color: const Color(0xFF7B776E),
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
