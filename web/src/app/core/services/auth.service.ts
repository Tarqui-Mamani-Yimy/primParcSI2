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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSignal = signal<AuthUser | null>(null);
  private isAuthenticatedSignal = signal<boolean>(false);
  private accessTokenSignal = signal<string | null>(null);

  public currentUser = this.currentUserSignal.asReadonly();
  public isAuthenticated = this.isAuthenticatedSignal.asReadonly();

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
      this.notificationService.success('Acceso concedido', `Bienvenido, ${res.user.nombre}`);
      return true;
    }).catch((err) => {
      const msg = err.error?.detail || 'Credenciales inválidas';
      this.notificationService.error('Error de autenticación', msg);
      return false;
    });
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

  resetPassword(email: string): void {
    firstValueFrom(
      this.http.post(`${API_URL}/api/auth/forgot-password`, { email })
    ).then(() => {
      this.notificationService.info('Enlace de recuperación enviado', `Instrucciones enviadas a ${email}.`);
    }).catch(() => {
      this.notificationService.info('Enlace de recuperación enviado', `Instrucciones enviadas a ${email}.`);
    });
  }

  resetPasswordGetToken(email: string): Promise<string | null> {
    return firstValueFrom(
      this.http.post<{ reset_token_dev?: string }>(`${API_URL}/api/auth/forgot-password`, { email })
    ).then((res) => {
      if (res.reset_token_dev) {
        this.notificationService.success('Correo enviado', `Se encontró una cuenta asociada a ${email}.`);
        return res.reset_token_dev;
      } else {
        this.notificationService.info('Recuperación', `Si el correo existe, se ha enviado un enlace de recuperación.`);
        return null;
      }
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo procesar la solicitud de recuperación.');
      return null;
    });
  }

  resetPasswordConfirm(token: string, newPassword: string): Promise<boolean> {
    return firstValueFrom(
      this.http.post(`${API_URL}/api/auth/reset-password`, { token, new_password: newPassword })
    ).then(() => {
      this.notificationService.success('Contraseña actualizada', 'Su contraseña ha sido restablecida exitosamente.');
      return true;
    }).catch((err) => {
      const msg = err.error?.detail || 'Token inválido o expirado.';
      this.notificationService.error('Error', msg);
      return false;
    });
  }

  changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    return firstValueFrom(
      this.http.patch(`${API_URL}/api/auth/password`, { current_password: currentPassword, new_password: newPassword })
    ).then(() => {
      this.notificationService.success('Contraseña actualizada', 'Su contraseña ha sido cambiada exitosamente.');
      return true;
    }).catch((err) => {
      const msg = err.error?.detail || 'No se pudo cambiar la contraseña.';
      this.notificationService.error('Error', msg);
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
