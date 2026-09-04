import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';
import { PasswordRequirementsComponent } from '../../shared/components/password-requirements.component';
import { MAX_INTENTOS_LOGIN, esPasswordValida } from '../../core/password-policy';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, PasswordRequirementsComponent],
  template: `
    <main class="flex w-full h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">

      <!-- Panel izquierdo: presentacion de marca (oculto en movil) -->
      <section class="hidden md:flex md:w-5/12 lg:w-1/2 bg-gray-900 relative flex-col justify-between p-10 lg:p-14 overflow-hidden">
        <div class="absolute inset-0 z-0 pointer-events-none">
          <img
            alt="Arquitectura de operaciones AETHER"
            class="w-full h-full object-cover opacity-25 mix-blend-luminosity scale-105"
            src="https://images.unsplash.com/photo-1544441893-675973e31985?w=1600&auto=format&fit=crop&q=80"
          />
          <div class="absolute inset-0 bg-gradient-to-b from-gray-900/60 via-gray-900/80 to-gray-900/95"></div>
        </div>

        <div class="relative z-10">
          <div class="flex items-center space-x-3">
            <div class="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
              A
            </div>
            <div>
              <span class="text-2xl font-bold text-white tracking-tight block">AETHER</span>
              <span class="text-xs uppercase tracking-widest text-indigo-300 font-semibold">Nodo de Operaciones</span>
            </div>
          </div>
        </div>

        <div class="relative z-10 max-w-md">
          <div class="inline-block px-3 py-1 mb-4 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-200 text-xs font-bold tracking-wide uppercase">
            Versión 2026.4
          </div>
          <h1 class="text-2xl lg:text-3xl font-bold leading-snug text-white mb-3 tracking-tight">
            Gestión integral de prendas esenciales
          </h1>
          <p class="text-sm text-gray-300 leading-relaxed">
            Acceso administrativo seguro al archivo AETHER, la plataforma de operaciones y la red global de inventario de boutiques.
          </p>

          <div class="mt-8 pt-6 border-t border-gray-800">
            <p class="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3">Identidades de demostración:</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                (click)="selectDemoPersona('manager@aether.com', 'admin')"
                class="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-xs font-medium text-white transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Administrador (Helena)</span>
              </button>
              <button
                type="button"
                (click)="selectDemoPersona('curator@aether.com', 'vendedor')"
                class="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-xs font-medium text-white transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Vendedor (Kenji)</span>
              </button>
              <button
                type="button"
                (click)="selectDemoPersona('logistics@aether.com', 'admin')"
                class="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-xs font-medium text-white transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>Logística (Astrid)</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Panel derecho: formulario de acceso -->
      <section class="w-full md:w-7/12 lg:w-1/2 flex items-center justify-center p-6 md:p-12 lg:p-16 bg-gray-50 relative">
        <div class="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl border border-gray-200 shadow-sm relative z-10">

          <div class="md:hidden flex flex-col items-center justify-center mb-6">
            <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md mb-2">A</div>
            <span class="text-xl font-bold text-gray-900 tracking-tight">AETHER</span>
            <span class="text-xs tracking-wider text-gray-500 uppercase">Nodo de Operaciones y Archivo</span>
          </div>

          <div class="text-center mb-8">
            <h2 class="text-xl font-bold text-gray-900">Acceso Administrativo</h2>
            <p class="text-xs text-gray-500 mt-1">Autentícate con tus credenciales corporativas</p>
          </div>

          <!-- Aviso de cuenta bloqueada tras 3 intentos fallidos -->
          <div
            *ngIf="authService.cuentaBloqueada()"
            class="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3 flex items-start space-x-2"
          >
            <span class="material-symbols-outlined text-[18px] text-rose-600 shrink-0">lock</span>
            <div>
              <p class="text-xs font-bold text-rose-900">Cuenta bloqueada</p>
              <p class="text-xs text-rose-700 mt-0.5 leading-snug">
                Se superaron los {{ maxIntentos }} intentos fallidos permitidos. Restablece tu
                contraseña para recuperar el acceso, o contacta al administrador.
              </p>
              <button
                type="button"
                (click)="openForgotPassword()"
                class="text-xs font-bold text-rose-800 underline mt-1.5 cursor-pointer"
              >
                Restablecer contraseña
              </button>
            </div>
          </div>

          <!-- Aviso de intentos restantes -->
          <div
            *ngIf="!authService.cuentaBloqueada() && authService.intentosRestantes() !== null"
            class="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3"
          >
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-[18px] text-amber-600 shrink-0">warning</span>
              <p class="text-xs text-amber-900">
                Credenciales incorrectas. Te queda(n)
                <strong>{{ authService.intentosRestantes() }}</strong>
                intento(s) antes de que la cuenta se bloquee.
              </p>
            </div>
            <div class="flex space-x-1 mt-2">
              <span
                *ngFor="let i of intentosSlots"
                class="h-1 flex-1 rounded-full"
                [ngClass]="i < (maxIntentos - (authService.intentosRestantes() ?? 0)) ? 'bg-amber-500' : 'bg-amber-200'"
              ></span>
            </div>
          </div>

          <form (ngSubmit)="onSubmit()" class="flex flex-col space-y-5">
            <div class="flex flex-col space-y-1.5">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider" for="email">Correo electrónico</label>
              <input
                id="email"
                name="email"
                type="email"
                [(ngModel)]="email"
                required
                [disabled]="authService.cuentaBloqueada()"
                placeholder="manager@aether.com"
                class="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>

            <div class="flex flex-col space-y-1.5">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider" for="password">Contraseña</label>
              <div class="relative">
                <input
                  id="password"
                  name="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  [(ngModel)]="password"
                  required
                  [disabled]="authService.cuentaBloqueada()"
                  placeholder="••••••••"
                  class="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all pr-10 disabled:bg-gray-100 disabled:text-gray-400"
                />
                <button
                  type="button"
                  (click)="togglePasswordVisibility()"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                  aria-label="Mostrar u ocultar la contraseña"
                >
                  <span class="material-symbols-outlined text-[18px]">{{ showPassword() ? 'visibility' : 'visibility_off' }}</span>
                </button>
              </div>
              <p class="text-[11px] text-gray-400">
                Tras {{ maxIntentos }} intentos fallidos la cuenta se bloquea por seguridad.
              </p>
            </div>

            <div class="pt-2">
              <button
                type="submit"
                [disabled]="isLoading() || authService.cuentaBloqueada()"
                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-lg text-xs font-bold tracking-wide uppercase shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span *ngIf="isLoading()" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{{ authService.cuentaBloqueada() ? 'CUENTA BLOQUEADA' : (isLoading() ? 'AUTENTICANDO...' : 'INICIAR SESIÓN') }}</span>
              </button>
            </div>

            <div class="flex justify-between items-center pt-2">
              <button type="button" (click)="openForgotPassword()" class="text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer">
                ¿Olvidaste tu contraseña?
              </button>
              <button type="button" (click)="openRequestAccess()" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">
                Solicitar acceso
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>

    <!-- Modal: recuperacion de contrasena (2 pasos) -->
    <div *ngIf="showForgotModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-md w-full p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xl relative max-h-[90vh] overflow-y-auto">
        <button (click)="closeForgotModal()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-5">
          <span class="text-[10px] font-bold tracking-wider text-indigo-600 uppercase">Recuperación de seguridad</span>
          <h3 class="text-lg font-bold text-gray-900 mt-1">Restablecer contraseña</h3>
          <p class="text-xs text-gray-500 mt-1">
            {{ recoveryStep() === 1
              ? 'Indica tu correo verificado para recibir un código de recuperación.'
              : 'Define tu contraseña nueva. Debe cumplir todos los requisitos.' }}
          </p>
        </div>

        <!-- Indicador de pasos -->
        <div class="flex items-center space-x-2 mb-5">
          <div class="flex items-center space-x-1.5">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  [ngClass]="recoveryStep() >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'">1</span>
            <span class="text-[11px] font-medium" [ngClass]="recoveryStep() >= 1 ? 'text-gray-900' : 'text-gray-400'">Verificación</span>
          </div>
          <div class="flex-1 h-px" [ngClass]="recoveryStep() >= 2 ? 'bg-indigo-600' : 'bg-gray-200'"></div>
          <div class="flex items-center space-x-1.5">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  [ngClass]="recoveryStep() >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'">2</span>
            <span class="text-[11px] font-medium" [ngClass]="recoveryStep() >= 2 ? 'text-gray-900' : 'text-gray-400'">Nueva contraseña</span>
          </div>
        </div>

        <!-- Paso 1: correo -->
        <div *ngIf="recoveryStep() === 1" class="space-y-4">
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Correo registrado</label>
            <input
              type="email"
              [(ngModel)]="recoveryEmail"
              class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="manager@aether.com"
            />
          </div>
          <button
            (click)="sendPasswordRecovery()"
            [disabled]="isRecovering() || !recoveryEmail"
            class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isRecovering() ? 'ENVIANDO...' : 'ENVIAR CÓDIGO DE RECUPERACIÓN' }}
          </button>
        </div>

        <!-- Paso 2: contrasena nueva con validaciones en vivo -->
        <div *ngIf="recoveryStep() === 2" class="space-y-4">
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Código de recuperación</label>
            <input
              type="text"
              [(ngModel)]="recoveryToken"
              class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Pega aquí el código recibido"
            />
            <p class="text-[11px] text-gray-400 mt-1">
              El código vence en 15 minutos.
            </p>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Contraseña nueva</label>
            <div class="relative">
              <input
                [type]="showNewPassword() ? 'text' : 'password'"
                [(ngModel)]="newPassword"
                class="w-full mt-1 px-3.5 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                (click)="showNewPassword.set(!showNewPassword())"
                class="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-gray-400 hover:text-gray-700 p-1"
                aria-label="Mostrar u ocultar la contraseña"
              >
                <span class="material-symbols-outlined text-[18px]">{{ showNewPassword() ? 'visibility' : 'visibility_off' }}</span>
              </button>
            </div>
          </div>

          <app-password-requirements [password]="newPassword"></app-password-requirements>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Confirmar contraseña</label>
            <input
              type="password"
              [(ngModel)]="confirmPassword"
              class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="••••••••••••"
            />
            <p *ngIf="confirmPassword && confirmPassword !== newPassword" class="text-[11px] text-rose-600 mt-1">
              Las contraseñas no coinciden.
            </p>
          </div>

          <button
            (click)="confirmNewPassword()"
            [disabled]="!puedeGuardarPassword() || isRecovering()"
            class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isRecovering() ? 'GUARDANDO...' : 'GUARDAR CONTRASEÑA NUEVA' }}
          </button>

          <button
            type="button"
            (click)="recoveryStep.set(1)"
            class="w-full text-xs text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
          >
            Volver al paso anterior
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: solicitud de acceso -->
    <div *ngIf="showRequestModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-lg w-full p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xl relative max-h-[90vh] overflow-y-auto">
        <button (click)="showRequestModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div class="mb-5">
          <span class="text-[10px] font-bold tracking-wider text-indigo-600 uppercase">Alta de personal</span>
          <h3 class="text-lg font-bold text-gray-900 mt-1">Solicitar acceso</h3>
          <p class="text-xs text-gray-500 mt-1">Las solicitudes las revisa el Director de Operaciones Globales.</p>
        </div>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Nombre completo</label>
              <input type="text" [(ngModel)]="reqName" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="ej. Marc Dubois" />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Correo corporativo</label>
              <input type="email" [(ngModel)]="reqEmail" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="marc.d@aether.com" />
            </div>
          </div>
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Departamento</label>
            <select [(ngModel)]="reqHub" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <option value="ventas">Ventas</option>
              <option value="logistica">Logística</option>
              <option value="inventario">Inventario</option>
              <option value="admin">Administración</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Justificación del acceso</label>
            <textarea [(ngModel)]="reqReason" rows="3" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="ej. Asignado a operaciones de reposición en boutique."></textarea>
          </div>
          <button (click)="submitAccessRequest()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs">
            Enviar solicitud
          </button>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  @Output() loggedIn = new EventEmitter<void>();

  readonly maxIntentos = MAX_INTENTOS_LOGIN;

  email = '';
  password = '';
  showPassword = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  showForgotModal = signal<boolean>(false);
  showRequestModal = signal<boolean>(false);

  /** 1 = pedir correo, 2 = definir la contrasena nueva. */
  recoveryStep = signal<1 | 2>(1);
  isRecovering = signal<boolean>(false);
  showNewPassword = signal<boolean>(false);

  recoveryEmail = '';
  recoveryToken = '';
  newPassword = '';
  confirmPassword = '';

  reqName = '';
  reqEmail = '';
  reqHub = 'ventas';
  reqReason = '';

  constructor(public authService: AuthService) {}

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  /** Indicadores de intentos; es un campo fijo para no recrear el array en cada ciclo. */
  readonly intentosSlots: number[] = Array.from({ length: MAX_INTENTOS_LOGIN }, (_, i) => i);

  selectDemoPersona(email: string, _role: UserRole) {
    this.email = email;
    this.password = 'demo1234';
    this.onSubmit();
  }

  onSubmit() {
    this.isLoading.set(true);
    this.authService.login(this.email, this.password).then((ok) => {
      this.isLoading.set(false);
      if (ok) {
        this.loggedIn.emit();
      }
    });
  }

  openForgotPassword() {
    this.recoveryStep.set(1);
    this.recoveryToken = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.recoveryEmail = this.recoveryEmail || this.email;
    this.showForgotModal.set(true);
  }

  closeForgotModal() {
    this.showForgotModal.set(false);
    this.recoveryStep.set(1);
  }

  /** Paso 1: pide el codigo y avanza al paso 2. */
  sendPasswordRecovery() {
    this.isRecovering.set(true);
    this.authService.solicitarRecuperacion(this.recoveryEmail).then((token) => {
      this.isRecovering.set(false);
      if (token) {
        // En desarrollo el backend devuelve el token directamente porque no
        // hay envio de correo montado.
        this.recoveryToken = token;
      }
      this.recoveryStep.set(2);
    });
  }

  /** Habilita el boton solo si la contrasena cumple la politica y coincide. */
  puedeGuardarPassword(): boolean {
    return (
      !!this.recoveryToken &&
      esPasswordValida(this.newPassword) &&
      this.newPassword === this.confirmPassword
    );
  }

  /** Paso 2: guarda la contrasena nueva y cierra el modal. */
  confirmNewPassword() {
    if (!this.puedeGuardarPassword()) return;

    this.isRecovering.set(true);
    this.authService.confirmarNuevaPassword(this.recoveryToken, this.newPassword).then((ok) => {
      this.isRecovering.set(false);
      if (ok) {
        this.password = '';
        this.email = this.recoveryEmail || this.email;
        this.closeForgotModal();
      }
    });
  }

  openRequestAccess() {
    this.showRequestModal.set(true);
  }

  submitAccessRequest() {
    this.authService.requestAccess(this.reqEmail || 'staff@aether.com', this.reqName, this.reqHub, this.reqReason);
    this.showRequestModal.set(false);
  }
}
