import 'package:flutter_test/flutter_test.dart';

import 'package:aether_fashion/services/auth_service.dart';

void main() {
  AuthUser userWithPlan(
    String role,
    List<String> features, {
    String planCode = 'basico',
  }) =>
      AuthUser.fromJson({
        'idUser': 12,
        'nombre': 'Cliente',
        'correo': 'cliente@example.com',
        'rol': role,
        'permisos': <String>[],
        'empresa': {'idEmpresa': 3},
        'plan': {'codigo': planCode, 'features': features},
      });

  test('reads plan feature keys from the backend login payload', () {
    final user = userWithPlan('Cliente', ['app_movil', 'tallas']);

    expect(user.planFeatures, containsAll(['app_movil', 'tallas']));
    expect(user.hasFeature('app_movil'), isTrue);
    expect(user.hasFeature('ia'), isFalse);
    for (final unavailableFeature in [
      'probador',
      'ia',
      'promociones',
      'fidelizacion',
    ]) {
      expect(user.hasFeature(unavailableFeature), isFalse,
          reason: unavailableFeature);
    }
  });

  test('keeps tenant features when the mobile session is persisted', () {
    final original = userWithPlan('Cliente', ['app_movil', 'fidelizacion']);
    final restored = AuthUser.fromJson(original.toJson());

    expect(restored.planFeatures, original.planFeatures);
    expect(restored.hasFeature('fidelizacion'), isTrue);
  });

  test('does not restrict SuperAdmin with a tenant feature list', () {
    final admin = userWithPlan('SuperAdmin', []);

    expect(admin.hasFeature('app_movil'), isTrue);
    expect(admin.hasFeature('probador'), isTrue);
    expect(admin.hasFeature('ia'), isTrue);
  });

  test('preserves existing access when a legacy session has no plan payload',
      () {
    final legacyUser = AuthUser.fromJson({
      'idUser': 12,
      'nombre': 'Cliente',
      'correo': 'cliente@example.com',
      'rol': 'Cliente',
      'permisos': <String>[],
      'idEmpresa': 3,
    });

    expect(legacyUser.hasFeature('app_movil'), isTrue);
    expect(legacyUser.hasFeature('probador'), isTrue);
  });

  test('keeps all Profesional features available', () {
    final professional = userWithPlan(
      'Cliente',
      [
        'pos',
        'inventario',
        'ventas',
        'reportes',
        'despachos',
        'reservas',
        'pagos_online',
        'app_movil',
        'reportes_avanzados',
        'reportes_export',
        'ia',
        'probador',
        'promociones',
        'fidelizacion',
        'tallas',
      ],
      planCode: 'avanzado',
    );

    for (final feature in [
      'app_movil',
      'probador',
      'tallas',
      'ia',
      'promociones',
      'fidelizacion',
    ]) {
      expect(professional.hasFeature(feature), isTrue, reason: feature);
    }
  });
}
