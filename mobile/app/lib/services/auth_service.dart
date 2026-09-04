import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';

/// Usuario autenticado devuelto por el backend.
class AuthUser {
  final int idUser;
  final String nombre;
  final String correo;
  final String rol;
  final List<String> permisos;

  const AuthUser({
    required this.idUser,
    required this.nombre,
    required this.correo,
    required this.rol,
    required this.permisos,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        idUser: json['idUser'] as int,
        nombre: json['nombre'] as String? ?? '',
        correo: json['correo'] as String? ?? '',
        rol: json['rol'] as String? ?? '',
        permisos: (json['permisos'] as List?)?.cast<String>() ?? const [],
      );
}

/// Resultado exitoso de `/api/auth/login` o `/api/auth/register`.
class AuthSession {
  final String accessToken;
  final String refreshToken;
  final AuthUser usuario;

  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.usuario,
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
        accessToken: json['access_token'] as String,
        refreshToken: json['refresh_token'] as String? ?? '',
        usuario: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
      );
}

/// Error de autenticacion ya traducido a algo mostrable en pantalla.
class AuthException implements Exception {
  /// `credenciales_invalidas`, `cuenta_bloqueada`, `correo_registrado`,
  /// `password_invalida`, `red` o `desconocido`.
  final String code;
  final String message;

  /// Intentos que le quedan al usuario antes de que se bloquee la cuenta.
  /// `null` cuando el backend no lo informa (por ejemplo, correo inexistente).
  final int? intentosRestantes;

  const AuthException({
    required this.code,
    required this.message,
    this.intentosRestantes,
  });

  bool get cuentaBloqueada => code == 'cuenta_bloqueada';

  @override
  String toString() => message;
}

class AuthService {
  final http.Client _client;

  AuthService({http.Client? client}) : _client = client ?? http.Client();

  static const Map<String, String> _headers = {
    'Content-Type': 'application/json; charset=utf-8',
  };

  Future<AuthSession> login({
    required String correo,
    required String password,
  }) async {
    final body = await _post('/api/auth/login', {
      'email': correo,
      'password': password,
    });
    return AuthSession.fromJson(body);
  }

  Future<AuthSession> register({
    required String nombre,
    required String correo,
    required String password,
  }) async {
    final body = await _post('/api/auth/register', {
      'nombre': nombre,
      'email': correo,
      'password': password,
    });
    return AuthSession.fromJson(body);
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> payload) async {
    http.Response response;
    try {
      response = await _client
          .post(
            ApiConfig.endpoint(path),
            headers: _headers,
            body: jsonEncode(payload),
          )
          .timeout(ApiConfig.timeout);
    } on TimeoutException {
      throw const AuthException(
        code: 'red',
        message: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
      );
    } catch (_) {
      throw const AuthException(
        code: 'red',
        message: 'No se pudo conectar con el servidor. Revisa tu conexión.',
      );
    }

    final decoded = _decode(response);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded;
    }
    throw _mapError(response.statusCode, decoded);
  }

  Map<String, dynamic> _decode(http.Response response) {
    if (response.body.isEmpty) return const {};
    try {
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      return decoded is Map<String, dynamic> ? decoded : {'detail': decoded};
    } catch (_) {
      return {'detail': response.body};
    }
  }

  /// Traduce la respuesta de error del backend a un `AuthException`.
  ///
  /// `detail` puede ser:
  ///  - un mapa `{code, message, intentos_restantes}` (login),
  ///  - un texto plano (409 correo ya registrado),
  ///  - la lista de errores de validacion de Pydantic (422 contrasena debil).
  AuthException _mapError(int statusCode, Map<String, dynamic> body) {
    final detail = body['detail'];

    if (detail is Map) {
      return AuthException(
        code: detail['code'] as String? ?? 'desconocido',
        message: detail['message'] as String? ?? 'No se pudo iniciar sesión.',
        intentosRestantes: detail['intentos_restantes'] as int?,
      );
    }

    if (detail is List) {
      // 422 de Pydantic: se toma el primer mensaje de validacion.
      final primero = detail.isNotEmpty ? detail.first : null;
      final msg = primero is Map ? primero['msg']?.toString() : null;
      return AuthException(
        code: 'password_invalida',
        message: _limpiarMensajePydantic(msg) ?? 'Los datos enviados no son válidos.',
      );
    }

    final texto = detail?.toString();

    if (statusCode == 423) {
      return AuthException(
        code: 'cuenta_bloqueada',
        message: texto ?? 'Cuenta bloqueada.',
        intentosRestantes: 0,
      );
    }
    if (statusCode == 409) {
      return AuthException(
        code: 'correo_registrado',
        message: texto ?? 'El correo ya está registrado.',
      );
    }
    if (statusCode == 401) {
      return AuthException(
        code: 'credenciales_invalidas',
        message: texto ?? 'Credenciales inválidas.',
      );
    }
    return AuthException(
      code: 'desconocido',
      message: texto ?? 'Ocurrió un error inesperado (HTTP $statusCode).',
    );
  }

  String? _limpiarMensajePydantic(String? msg) {
    if (msg == null) return null;
    // Pydantic prefija los ValueError con "Value error, ".
    return msg.replaceFirst(RegExp(r'^Value error,\s*'), '');
  }

  void dispose() => _client.close();
}
