/// Politica de contrasenas del sistema.
///
/// Refleja exactamente las reglas que valida el backend en
/// `backend/app/security.py` (`PASSWORD_RULES`). El backend tambien las expone
/// en `GET /api/auth/password-policy`, asi que si alli cambian, hay que
/// actualizar esta lista.
class PasswordRule {
  final String codigo;
  final String descripcion;
  final RegExp patron;

  const PasswordRule({
    required this.codigo,
    required this.descripcion,
    required this.patron,
  });

  bool cumple(String password) => patron.hasMatch(password);
}

class PasswordPolicy {
  const PasswordPolicy._();

  /// Longitud minima exigida.
  static const int minLength = 12;

  /// Intentos fallidos consecutivos antes de que el backend bloquee la cuenta.
  static const int maxIntentosLogin = 3;

  static final List<PasswordRule> reglas = [
    PasswordRule(
      codigo: 'longitud',
      descripcion: 'Al menos $minLength caracteres',
      patron: RegExp('.{$minLength,}'),
    ),
    PasswordRule(
      codigo: 'minuscula',
      descripcion: 'Al menos una letra minúscula (a-z)',
      patron: RegExp(r'[a-z]'),
    ),
    PasswordRule(
      codigo: 'mayuscula',
      descripcion: 'Al menos una letra mayúscula (A-Z)',
      patron: RegExp(r'[A-Z]'),
    ),
    PasswordRule(
      codigo: 'numero',
      descripcion: 'Al menos un número (0-9)',
      patron: RegExp(r'\d'),
    ),
    PasswordRule(
      codigo: 'especial',
      descripcion: 'Al menos un carácter especial (!, @, #, \$…)',
      patron: RegExp(r'[^A-Za-z0-9]'),
    ),
  ];

  /// Reglas que la contrasena todavia NO cumple.
  static List<PasswordRule> reglasFaltantes(String password) =>
      reglas.where((r) => !r.cumple(password)).toList();

  static bool esValida(String password) => reglasFaltantes(password).isEmpty;

  /// Mensaje de error para un `TextFormField`; `null` si la contrasena es valida.
  static String? validar(String? password) {
    final valor = password ?? '';
    if (valor.isEmpty) return 'Ingresa una contraseña';
    final faltantes = reglasFaltantes(valor);
    if (faltantes.isEmpty) return null;
    return 'Falta: ${faltantes.map((r) => r.descripcion.toLowerCase()).join(', ')}';
  }

  /// Fuerza aproximada de la contrasena, entre 0.0 y 1.0.
  static double fuerza(String password) {
    if (password.isEmpty) return 0;
    final cumplidas = reglas.where((r) => r.cumple(password)).length;
    return cumplidas / reglas.length;
  }

  static String etiquetaFuerza(String password) {
    final f = fuerza(password);
    if (f < 0.4) return 'Débil';
    if (f < 0.8) return 'Media';
    if (f < 1.0) return 'Buena';
    return 'Fuerte';
  }
}
