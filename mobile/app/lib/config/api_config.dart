/// Configuracion de conexion con el backend FastAPI.
///
/// El valor se puede sobreescribir al compilar sin tocar el codigo:
///   flutter run --dart-define=API_BASE_URL=http://192.168.0.10:8000
///
/// Valores utiles segun donde se ejecute la app:
///   - Emulador Android : http://10.0.2.2:8000   (alias del localhost del host)
///   - Simulador iOS    : http://localhost:8000
///   - Dispositivo fisico: http://<IP-de-tu-PC>:8000
class ApiConfig {
  const ApiConfig._();

  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );

  static Uri endpoint(String path) => Uri.parse('$baseUrl$path');

  /// Tiempo maximo de espera de cada peticion HTTP.
  static const Duration timeout = Duration(seconds: 15);
}
