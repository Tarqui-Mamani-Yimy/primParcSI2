import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthUser, LoginResponse } from '../models';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

interface LoginBackendResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    idUser: string;
    nombre: string;
    correo: string;
    rol: string;
    permisos: string[];
  };
}

interface ForgotPasswordBackendResponse {
  message: string;
  reset_token_dev: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSignal = signal<AuthUser | null>(null);
  private isAuthenticatedSignal = signal<boolean>(false);
  private accessTokenSignal = signal<string | null>(null);

  // Estado del bloqueo de cuenta por intentos fallidos (3 seguidos).
  private cuentaBloqueadaSignal = signal<boolean>(false);
  private intentosRestantesSignal = signal<number | null>(null);

  public currentUser = this.currentUserSignal.asReadonly();
  public isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  public cuentaBloqueada = this.cuentaBloqueadaSignal.asReadonly();
  public intentosRestantes = this.intentosRestantesSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService,
  ) {
    this.loadTokenFromStorage();
  }

  private loadTokenFromStorage() {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.accessTokenSignal.set(token);
      this.isAuthenticatedSignal.set(true);
      this.fetchCurrentUser();
    }
  }

  private mapBackendUser(u: LoginBackendResponse['user']): AuthUser {
    return {
      id: u.idUser,
      nombre: u.nombre,
      email: u.correo,
      rol: u.rol as AuthUser['rol'],
      permisos: u.permisos,
    };
  }

  login(email: string, password: string): Promise<boolean> {
    return firstValueFrom(
      this.http.post<LoginBackendResponse>(`${API_URL}/api/auth/login`, { email, password })
    ).then((res) => {
      this.accessTokenSignal.set(res.access_token);
      localStorage.setItem('access_token', res.access_token);
      localStorage.setItem('refresh_token', res.refresh_token);
      this.currentUserSignal.set(this.mapBackendUser(res.user));
      this.isAuthenticatedSignal.set(true);
      this.cuentaBloqueadaSignal.set(false);
      this.intentosRestantesSignal.set(null);
      this.notificationService.success('Acceso concedido', `Bienvenido, ${res.user.nombre}`);
      return true;
    }).catch((err) => {
      const detalle = this.parseAuthError(err);

      this.cuentaBloqueadaSignal.set(detalle.code === 'cuenta_bloqueada');
      this.intentosRestantesSignal.set(detalle.intentosRestantes);

      this.notificationService.error(
        detalle.code === 'cuenta_bloqueada' ? 'Cuenta bloqueada' : 'Error de autenticación',
        detalle.message,
      );
      return false;
    });
  }

  /**
   * Normaliza el error del backend.
   *
   * `detail` llega como objeto `{code, message, intentos_restantes}` en el
   * login, pero como texto plano o como lista de errores de Pydantic (422) en
   * el resto de endpoints.
   */
  private parseAuthError(err: any): { code: string; message: string; intentosRestantes: number | null } {
    const detail = err?.error?.detail;

    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      return {
        code: detail.code ?? 'desconocido',
        message: detail.message ?? 'No se pudo completar la operación.',
        intentosRestantes: detail.intentos_restantes ?? null,
      };
    }

    if (Array.isArray(detail)) {
      // 422 de Pydantic: se toma el primer mensaje de validación.
      const msg = detail[0]?.msg as string | undefined;
      return {
        code: 'validacion',
        message: (msg ?? 'Los datos enviados no son válidos.').replace(/^Value error,\s*/, ''),
        intentosRestantes: null,
      };
    }

    if (typeof detail === 'string') {
      return { code: 'desconocido', message: detail, intentosRestantes: null };
    }

    return {
      code: 'red',
      message: 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.',
      intentosRestantes: null,
    };
  }

  fetchCurrentUser(): Promise<void> {
    return firstValueFrom(
      this.http.get<{ idUser: string; nombre: string; correo: string; rol: string; permisos: string[] }>(`${API_URL}/api/auth/me`)
    ).then((u) => {
      this.currentUserSignal.set({
        id: u.idUser,
        nombre: u.nombre,
        email: u.correo,
        rol: u.rol as AuthUser['rol'],
        permisos: u.permisos,
      });
      this.isAuthenticatedSignal.set(true);
    }).catch(() => {
      this.logout();
    });
  }

  /**
   * Paso 1 de la recuperación: pide el token para restablecer la contraseña.
   *
   * El backend responde siempre lo mismo exista o no el correo, para no
   * revelar qué cuentas están registradas. En desarrollo devuelve el token en
   * `reset_token_dev` porque el proyecto no tiene envío de correo montado.
   */
  solicitarRecuperacion(email: string): Promise<string | null> {
    return firstValueFrom(
      this.http.post<ForgotPasswordBackendResponse>(
        `${API_URL}/api/auth/forgot-password`,
        { email },
      )
    ).then((res) => {
      this.notificationService.info('Verificación enviada', res.message);
      return res.reset_token_dev ?? null;
    }).catch((err) => {
      this.notificationService.error('Error', this.parseAuthError(err).message);
      return null;
    });
  }

  /**
   * Paso 2 de la recuperación: fija la contraseña nueva.
   *
   * El backend vuelve a validar la política de contraseñas y responde 422 si
   * no se cumple, así que la validación del formulario es solo una ayuda
   * visual, no la única defensa. Al restablecerla se desbloquea la cuenta.
   */
  confirmarNuevaPassword(token: string, newPassword: string): Promise<boolean> {
    return firstValueFrom(
      this.http.post<{ message: string }>(`${API_URL}/api/auth/reset-password`, {
        token,
        new_password: newPassword,
      })
    ).then((res) => {
      this.cuentaBloqueadaSignal.set(false);
      this.intentosRestantesSignal.set(null);
      this.notificationService.success('Contraseña actualizada', res.message);
      return true;
    }).catch((err) => {
      this.notificationService.error(
        'No se pudo actualizar la contraseña',
        this.parseAuthError(err).message,
      );
      return false;
    });
  }

  requestAccess(email: string, fullName: string, department: string, justification: string): void {
    firstValueFrom(
      this.http.post(`${API_URL}/api/auth/request-access`, { email, nombre: fullName, department, justification })
    ).then(() => {
      this.notificationService.success('Solicitud enviada', `Solicitud de acceso para ${email} registrada.`);
    }).catch(() => {
      this.notificationService.success('Solicitud enviada', `Solicitud de acceso para ${email} registrada.`);
    });
  }

  logout(): void {
    this.currentUserSignal.set(null);
    this.isAuthenticatedSignal.set(false);
    this.accessTokenSignal.set(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.notificationService.info('Sesión cerrada', 'Tu sesión administrativa ha terminado de forma segura.');
  }

  getToken(): string | null {
    return this.accessTokenSignal();
  }
}
