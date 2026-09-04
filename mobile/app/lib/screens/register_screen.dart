import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../providers/app_state.dart';
import '../theme/aether_theme.dart';
import '../utils/password_policy.dart';
import '../widgets/password_requirements.dart';
import 'main_navigation_shell.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nombreController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmarController = TextEditingController();

  bool _ocultarPassword = true;
  bool _ocultarConfirmar = true;

  @override
  void initState() {
    super.initState();
    // Repinta la lista de requisitos en cada tecla.
    _passwordController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _nombreController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmarController.dispose();
    super.dispose();
  }

  Future<void> _registrar() async {
    if (!_formKey.currentState!.validate()) return;

    final appState = context.read<AppState>();
    final ok = await appState.registrar(
      nombre: _nombreController.text.trim(),
      correo: _emailController.text.trim(),
      password: _passwordController.text,
    );

    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cuenta creada correctamente. ¡Bienvenido a AETHER!')),
      );
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainNavigationShell()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return Scaffold(
      backgroundColor: AetherTheme.sandLight,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AetherTheme.charcoalDark),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 12.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Crear cuenta.',
                  style: GoogleFonts.outfit(
                    fontSize: 30,
                    fontWeight: FontWeight.w500,
                    color: AetherTheme.charcoalDark,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Regístrate para guardar tus medidas, tus looks y tus citas.',
                  style: GoogleFonts.sourceSerif4(
                    fontSize: 14,
                    color: const Color(0xFF4A463F),
                  ),
                ),
                const SizedBox(height: 28),

                if (appState.authError != null) ...[
                  _BannerError(mensaje: appState.authError!),
                  const SizedBox(height: 16),
                ],

                _Etiqueta('NOMBRE COMPLETO'),
                TextFormField(
                  controller: _nombreController,
                  textInputAction: TextInputAction.next,
                  style: GoogleFonts.sourceSerif4(fontSize: 14),
                  decoration: _decoracion('Ada Lovelace'),
                  validator: (v) {
                    final valor = (v ?? '').trim();
                    if (valor.isEmpty) return 'Ingresa tu nombre';
                    if (valor.length < 3) return 'El nombre debe tener al menos 3 caracteres';
                    return null;
                  },
                ),
                const SizedBox(height: 22),

                _Etiqueta('CORREO ELECTRÓNICO'),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autocorrect: false,
                  style: GoogleFonts.sourceSerif4(fontSize: 14),
                  decoration: _decoracion('tucorreo@ejemplo.com'),
                  validator: (v) {
                    final valor = (v ?? '').trim();
                    if (valor.isEmpty) return 'Ingresa tu correo electrónico';
                    final patron = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
                    if (!patron.hasMatch(valor)) return 'Ingresa un correo válido';
                    return null;
                  },
                ),
                const SizedBox(height: 22),

                _Etiqueta('CONTRASEÑA'),
                TextFormField(
                  controller: _passwordController,
                  obscureText: _ocultarPassword,
                  textInputAction: TextInputAction.next,
                  style: GoogleFonts.sourceSerif4(fontSize: 14),
                  decoration: _decoracion(
                    'Mínimo ${PasswordPolicy.minLength} caracteres',
                    sufijo: IconButton(
                      icon: Icon(
                        _ocultarPassword ? Icons.visibility_off : Icons.visibility,
                        size: 18,
                        color: const Color(0xFF7B776E),
                      ),
                      onPressed: () => setState(() => _ocultarPassword = !_ocultarPassword),
                    ),
                  ),
                  validator: PasswordPolicy.validar,
                ),
                const SizedBox(height: 12),
                PasswordRequirements(password: _passwordController.text),
                const SizedBox(height: 22),

                _Etiqueta('CONFIRMAR CONTRASEÑA'),
                TextFormField(
                  controller: _confirmarController,
                  obscureText: _ocultarConfirmar,
                  textInputAction: TextInputAction.done,
                  style: GoogleFonts.sourceSerif4(fontSize: 14),
                  decoration: _decoracion(
                    'Repite tu contraseña',
                    sufijo: IconButton(
                      icon: Icon(
                        _ocultarConfirmar ? Icons.visibility_off : Icons.visibility,
                        size: 18,
                        color: const Color(0xFF7B776E),
                      ),
                      onPressed: () => setState(() => _ocultarConfirmar = !_ocultarConfirmar),
                    ),
                  ),
                  validator: (v) {
                    if ((v ?? '').isEmpty) return 'Confirma tu contraseña';
                    if (v != _passwordController.text) return 'Las contraseñas no coinciden';
                    return null;
                  },
                  onFieldSubmitted: (_) => _registrar(),
                ),
                const SizedBox(height: 28),

                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: appState.authCargando ? null : _registrar,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AetherTheme.charcoalDark,
                      foregroundColor: AetherTheme.sandLight,
                      disabledBackgroundColor: const Color(0xFFA9A399),
                      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                    ),
                    child: appState.authCargando
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AetherTheme.sandLight,
                            ),
                          )
                        : Text(
                            'CREAR CUENTA',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 2.0,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 14),
                Center(
                  child: TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: Text(
                      '¿Ya tienes cuenta? Inicia sesión',
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        color: const Color(0xFF7B776E),
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _decoracion(String hint, {Widget? sufijo}) => InputDecoration(
        hintText: hint,
        hintStyle: GoogleFonts.sourceSerif4(fontSize: 13, color: const Color(0xFFA9A399)),
        suffixIcon: sufijo,
        border: const UnderlineInputBorder(
          borderSide: BorderSide(color: AetherTheme.outline),
        ),
        focusedBorder: const UnderlineInputBorder(
          borderSide: BorderSide(color: AetherTheme.charcoalDark, width: 1.5),
        ),
        errorStyle: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFFB4413C)),
      );
}

class _Etiqueta extends StatelessWidget {
  final String texto;
  const _Etiqueta(this.texto);

  @override
  Widget build(BuildContext context) => Text(
        texto,
        style: GoogleFonts.outfit(
          fontSize: 10,
          letterSpacing: 1.8,
          fontWeight: FontWeight.w600,
          color: const Color(0xFF7B776E),
        ),
      );
}

class _BannerError extends StatelessWidget {
  final String mensaje;
  const _BannerError({required this.mensaje});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFB4413C).withOpacity(0.08),
        border: Border.all(color: const Color(0xFFB4413C).withOpacity(0.5)),
        borderRadius: BorderRadius.circular(2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, size: 16, color: Color(0xFFB4413C)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              mensaje,
              style: GoogleFonts.sourceSerif4(
                fontSize: 12,
                height: 1.4,
                color: const Color(0xFF8A2F2B),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
