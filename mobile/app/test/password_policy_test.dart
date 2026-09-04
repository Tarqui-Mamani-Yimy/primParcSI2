import 'package:flutter_test/flutter_test.dart';

import 'package:aether_fashion/utils/password_policy.dart';

void main() {
  group('PasswordPolicy', () {
    test('acepta una contraseña que cumple todas las reglas', () {
      expect(PasswordPolicy.esValida('Aether2024!seg'), isTrue);
      expect(PasswordPolicy.validar('Aether2024!seg'), isNull);
    });

    test('exige al menos una minúscula', () {
      final faltantes = PasswordPolicy.reglasFaltantes('SINMINUS12345!');
      expect(faltantes.map((r) => r.codigo), contains('minuscula'));
    });

    test('exige al menos una mayúscula', () {
      final faltantes = PasswordPolicy.reglasFaltantes('todominuscula1!');
      expect(faltantes.map((r) => r.codigo), contains('mayuscula'));
    });

    test('exige al menos un carácter especial', () {
      final faltantes = PasswordPolicy.reglasFaltantes('SinEspecial123456');
      expect(faltantes.map((r) => r.codigo), contains('especial'));
    });

    test('exige la longitud mínima', () {
      final faltantes = PasswordPolicy.reglasFaltantes('Ab1!');
      expect(faltantes.map((r) => r.codigo), contains('longitud'));
    });

    test('una contraseña vacía devuelve un mensaje de error', () {
      expect(PasswordPolicy.validar(''), isNotNull);
      expect(PasswordPolicy.validar(null), isNotNull);
    });

    test('la fuerza va de 0 a 1 según las reglas cumplidas', () {
      expect(PasswordPolicy.fuerza(''), 0);
      expect(PasswordPolicy.fuerza('Aether2024!seg'), 1.0);
      expect(PasswordPolicy.etiquetaFuerza('Aether2024!seg'), 'Fuerte');
    });

    test('el bloqueo de cuenta se declara a los 3 intentos', () {
      expect(PasswordPolicy.maxIntentosLogin, 3);
    });
  });
}
