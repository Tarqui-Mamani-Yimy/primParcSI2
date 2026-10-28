import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';
import { hasDigit, hasLower, hasSpecial, hasUpper, isStrong } from '../../shared/utils/password-rules';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="flex w-full h-screen overflow-hidden bg-[#FAF8F5] text-[#17141A] font-sans selection:bg-[#F5EBF7] selection:text-[#38133E]">

      <!-- Panel izquierdo: Presentación de marca (oculto en móvil) -->
      <section class="hidden md:flex md:w-5/12 lg:w-1/2 bg-[#260B2B] relative flex-col justify-between p-10 lg:p-14 overflow-hidden">
        <div class="absolute inset-0 z-0 pointer-events-none">
          <img
            alt="Arquitectura de operaciones Voguely"
            class="w-full h-full object-cover opacity-20 mix-blend-luminosity scale-105"
            src="https://images.unsplash.com/photo-1544441893-675973e31985?w=1600&auto=format&fit=crop&q=80"
          />
          <div class="absolute inset-0 bg-gradient-to-b from-[#260B2B]/70 via-[#38133E]/80 to-[#260B2B]/95"></div>
        </div>

        <div class="relative z-10">
          <div class="flex items-center space-x-3">
            <div class="w-9 h-9 bg-[#38133E] border border-white/20 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
              A
            </div>
            <div>
              <span class="text-2xl font-bold text-white tracking-tight block">Voguely</span>
              <span class="text-xs uppercase tracking-widest text-[#F5EBF7] font-semibold">Nodo de Operaciones</span>
            </div>
          </div>
        </div>

        <div class="relative z-10 max-w-md">
          <div class="inline-block px-3 py-1 mb-4 bg-white/10 border border-white/20 rounded-full text-[#F5EBF7] text-xs font-bold tracking-wide uppercase">
            Versión 2026.4
          </div>
          <h1 class="text-2xl lg:text-3xl font-bold leading-snug text-white mb-3 tracking-tight">
            Excelencia en Gestión de Vestimenta Esencial
          </h1>
          <p class="text-sm text-gray-200 leading-relaxed">
            Acceso administrativo seguro al archivo Voguely, plataforma de operaciones y red global de inventario de boutiques.
          </p>

          <div class="mt-8 pt-6 border-t border-white/15">
            <p class="text-xs uppercase tracking-widest text-gray-300 font-bold mb-3">Identidades de demostración rápidas:</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                (click)="selectDemoPersona('manager@voguely.com', 'Administrador')"
                class="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-xs font-medium text-white transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full bg-[#16A34A]"></span>
                <span>Admin (Helena)</span>
              </button>
              <button
                type="button"
                (click)="selectDemoPersona('curator@voguely.com', 'Cajero')"
                class="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-xs font-medium text-white transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Vendedor (Kenji)</span>
              </button>
              <button
                type="button"
                (click)="selectDemoPersona('logistics@voguely.com', 'Administrador')"
                class="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-xs font-medium text-white transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>Logística (Astrid)</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Panel derecho: Interfaz de inicio de sesión -->
      <section class="w-full md:w-7/12 lg:w-1/2 flex items-center justify-center p-6 md:p-12 lg:p-16 bg-[#FAF8F5] relative">
        <div class="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl border border-[#E8E2DA] shadow-sm relative z-10">

          <div class="md:hidden flex flex-col items-center justify-center mb-6">
            <div class="w-10 h-10 bg-[#38133E] rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md mb-2">A</div>
            <span class="text-xl font-bold text-[#17141A] tracking-tight">Voguely</span>
            <span class="text-xs tracking-wider text-[#5A5561] uppercase">Nodo de Operaciones y Archivo</span>
          </div>

          <div class="text-center mb-8">
            <h2 class="text-xl font-bold text-[#17141A]">Acceso Administrativo</h2>
            <p class="text-xs text-[#5A5561] mt-1">Autentíquese con sus credenciales corporativas</p>
          </div>

          <form (ngSubmit)="onSubmit()" class="flex flex-col space-y-5">
            <div class="flex flex-col space-y-1.5">
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider" for="email">Correo Electrónico</label>
              <input
                id="email"
                name="email"
                type="email"
                [(ngModel)]="email"
                required
                placeholder="gerente@voguely.com"
                class="w-full bg-white border border-[#E8E2DA] rounded-lg px-3.5 py-2.5 text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:outline-none focus:ring-2 focus:ring-[#38133E] focus:border-[#38133E] transition-all"
              />
            </div>

            <div class="flex flex-col space-y-1.5">
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider" for="password">Contraseña</label>
              <div class="relative">
                <input
                  id="password"
                  name="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  [(ngModel)]="password"
                  required
                  placeholder="••••••••"
                  class="w-full bg-white border border-[#E8E2DA] rounded-lg px-3.5 py-2.5 text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:outline-none focus:ring-2 focus:ring-[#38133E] focus:border-[#38133E] transition-all pr-10"
                />
                <button
                  type="button"
                  (click)="togglePasswordVisibility()"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-[#9B94A3] hover:text-[#17141A] transition-colors p-1"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                >
                  <span class="material-symbols-outlined text-[18px]">{{ showPassword() ? 'visibility' : 'visibility_off' }}</span>
                </button>
              </div>
            </div>

            <div class="pt-2">
              <button
                type="submit"
                [disabled]="isLoading()"
                class="w-full bg-[#38133E] hover:bg-[#260B2B] text-white py-2.5 px-4 rounded-lg text-xs font-bold tracking-wide uppercase shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <span *ngIf="isLoading()" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{{ isLoading() ? 'AUTENTICANDO...' : 'INICIAR SESIÓN' }}</span>
              </button>
            </div>

            <div class="flex justify-between items-center pt-2">
              <button type="button" (click)="openForgotPassword()" class="text-xs font-medium text-[#5A5561] hover:text-[#38133E] transition-colors cursor-pointer">
                ¿Olvidó su contraseña?
              </button>
              <button type="button" (click)="openRequestAccess()" class="text-xs font-semibold text-[#38133E] hover:text-[#260B2B] transition-colors cursor-pointer">
                Solicitar Acceso
              </button>
            </div>

            <div class="pt-1 text-center">
              <span class="text-xs text-[#5A5561]">¿Sos cliente y no tenés cuenta?</span>
              <button type="button" (click)="onShowRegister()" class="ml-1 text-xs font-semibold text-[#38133E] hover:text-[#260B2B] transition-colors cursor-pointer">
                Crear cuenta
              </button>
            </div>

            <div class="pt-2 text-center border-t border-[#E8E2DA]">
              <button type="button" (click)="onBackToLanding()" class="text-xs text-[#5A5561] hover:text-[#17141A] transition-colors inline-flex items-center gap-1 cursor-pointer">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Volver a Voguely</span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>

    <!-- Modal: Recuperar contraseña -->
    <div *ngIf="showForgotModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-md w-full p-6 sm:p-8 rounded-2xl border border-[#E8E2DA] shadow-xl relative">
        <button (click)="showForgotModal.set(false)" class="absolute top-4 right-4 text-[#9B94A3] hover:text-[#17141A] p-1 cursor-pointer">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <!-- Paso 1: Ingresar email -->
        <div *ngIf="recoveryStep() === 1">
          <div class="mb-5">
            <span class="text-[10px] font-bold tracking-wider text-[#38133E] uppercase">Recuperación de Seguridad</span>
            <h3 class="text-lg font-bold text-[#17141A] mt-1">Restablecer Contraseña</h3>
            <p class="text-xs text-[#5A5561] mt-1">Ingrese su correo registrado para recibir un enlace de recuperación.</p>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Correo Electrónico</label>
              <input type="email" [(ngModel)]="recoveryEmail" class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:ring-2 focus:ring-[#38133E] focus:outline-none" placeholder="gerente@voguely.com" />
            </div>
            <button (click)="sendPasswordRecovery()" class="w-full bg-[#38133E] hover:bg-[#260B2B] text-white py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs cursor-pointer">
              Enviar Enlace Seguro
            </button>
          </div>
        </div>

        <!-- Paso 2: Ingresar nueva contraseña -->
        <div *ngIf="recoveryStep() === 2">
          <div class="mb-5">
            <span class="text-[10px] font-bold tracking-wider text-[#38133E] uppercase">
              {{ isWelcomeFlow() ? 'Bienvenido a Voguely' : 'Nueva Contraseña' }}
            </span>
            <h3 class="text-lg font-bold text-[#17141A] mt-1">
              {{ isWelcomeFlow() ? 'Crea tu Contraseña' : 'Establezca su Contraseña' }}
            </h3>
            <p class="text-xs text-[#5A5561] mt-1">
              {{ isWelcomeFlow() ? 'Establece tu contraseña de administrador para activar tu cuenta y comenzar a operar.' : 'Ingrese y confirme su nueva contraseña.' }}
            </p>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Nueva Contraseña</label>
              <input type="password" [(ngModel)]="recoveryNewPassword" class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:ring-2 focus:ring-[#38133E] focus:outline-none" placeholder="Mínimo 10 caracteres" />
            </div>
            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Confirmar Contraseña</label>
              <input type="password" [(ngModel)]="recoveryConfirmPassword" class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:ring-2 focus:ring-[#38133E] focus:outline-none" placeholder="Repita la contraseña" />
            </div>

            <!-- Reglas de contraseña -->
            <div class="p-3 bg-[#F3EFEA] rounded-lg border border-[#E8E2DA] space-y-1.5">
              <p class="text-[10px] font-bold uppercase tracking-wider text-[#5A5561] mb-2">Requisitos de contraseña:</p>
              <div class="flex items-center space-x-2 text-xs" [class.text-emerald-600]="recoveryNewPassword.length >= 10" [class.text-gray-400]="recoveryNewPassword.length < 10">
                <span>{{ recoveryNewPassword.length >= 10 ? '✓' : '○' }}</span>
                <span>Mínimo 10 caracteres</span>
              </div>
              <div class="flex items-center space-x-2 text-xs" [class.text-emerald-600]="hasLower(recoveryNewPassword)" [class.text-gray-400]="!hasLower(recoveryNewPassword)">
                <span>{{ hasLower(recoveryNewPassword) ? '✓' : '○' }}</span>
                <span>Al menos 1 minúscula</span>
              </div>
              <div class="flex items-center space-x-2 text-xs" [class.text-emerald-600]="hasUpper(recoveryNewPassword)" [class.text-gray-400]="!hasUpper(recoveryNewPassword)">
                <span>{{ hasUpper(recoveryNewPassword) ? '✓' : '○' }}</span>
                <span>Al menos 1 mayúscula</span>
              </div>
              <div class="flex items-center space-x-2 text-xs" [class.text-emerald-600]="hasDigit(recoveryNewPassword)" [class.text-gray-400]="!hasDigit(recoveryNewPassword)">
                <span>{{ hasDigit(recoveryNewPassword) ? '✓' : '○' }}</span>
                <span>Al menos 1 número</span>
              </div>
              <div class="flex items-center space-x-2 text-xs" [class.text-emerald-600]="hasSpecial(recoveryNewPassword)" [class.text-gray-400]="!hasSpecial(recoveryNewPassword)">
                <span>{{ hasSpecial(recoveryNewPassword) ? '✓' : '○' }}</span>
                <span>Al menos 1 carácter especial</span>
              </div>
              <div class="flex items-center space-x-2 text-xs" [class.text-emerald-600]="recoveryNewPassword === recoveryConfirmPassword && recoveryConfirmPassword.length > 0" [class.text-gray-400]="recoveryNewPassword !== recoveryConfirmPassword || recoveryConfirmPassword.length === 0">
                <span>{{ recoveryNewPassword === recoveryConfirmPassword && recoveryConfirmPassword.length > 0 ? '✓' : '○' }}</span>
                <span>Las contraseñas coinciden</span>
              </div>
            </div>

            <button
              (click)="submitNewPassword()"
              [disabled]="!isRecoveryPasswordValid()"
              class="w-full bg-[#38133E] hover:bg-[#260B2B] text-white py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {{ isWelcomeFlow() ? 'Activar Cuenta' : 'Establecer Contraseña' }}
            </button>
          </div>
        </div>

        <!-- Paso 3: Éxito -->
        <div *ngIf="recoveryStep() === 3">
          <div class="text-center py-4">
            <div class="w-14 h-14 rounded-full bg-[#DCFCE7] flex items-center justify-center mx-auto mb-4">
              <span class="material-symbols-outlined text-[28px] text-[#16A34A]">check_circle</span>
            </div>
            <h3 class="text-lg font-bold text-[#17141A]">
              {{ isWelcomeFlow() ? '¡Cuenta Activada con Éxito!' : 'Contraseña Actualizada' }}
            </h3>
            <p class="text-xs text-[#5A5561] mt-2">
              {{ isWelcomeFlow() ? 'Tu contraseña ha sido establecida correctamente. Ya puedes iniciar sesión con tus credenciales corporativas.' : 'Su contraseña ha sido restablecida exitosamente. Ahora puede iniciar sesión con su nueva contraseña.' }}
            </p>
            <button (click)="showForgotModal.set(false)" class="mt-5 w-full bg-[#38133E] hover:bg-[#260B2B] text-white py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs cursor-pointer">
              {{ isWelcomeFlow() ? 'Iniciar Sesión' : 'Cerrar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Solicitar acceso -->
    <div *ngIf="showRequestModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-lg w-full p-6 sm:p-8 rounded-2xl border border-[#E8E2DA] shadow-xl relative max-h-[90vh] overflow-y-auto">
        <button (click)="showRequestModal.set(false)" class="absolute top-4 right-4 text-[#9B94A3] hover:text-[#17141A] p-1 cursor-pointer">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div class="mb-5">
          <span class="text-[10px] font-bold tracking-wider text-[#38133E] uppercase">Provisión de Personal</span>
          <h3 class="text-lg font-bold text-[#17141A] mt-1">Solicitar Acceso al Nodo</h3>
          <p class="text-xs text-[#5A5561] mt-1">Las solicitudes son revisadas por el Director Global de Operaciones.</p>
        </div>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Nombre Completo</label>
              <input type="text" [(ngModel)]="reqName" class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:ring-2 focus:ring-[#38133E] focus:outline-none" placeholder="ej. Marc Dubois" />
            </div>
            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Correo Corporativo</label>
              <input type="email" [(ngModel)]="reqEmail" class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:ring-2 focus:ring-[#38133E] focus:outline-none" placeholder="marc.d@voguely.com" />
            </div>
          </div>
          <div>
            <label class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Departamento</label>
            <select [(ngModel)]="reqHub" class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-sm text-[#17141A] bg-white focus:ring-2 focus:ring-[#38133E] focus:outline-none">
              <option value="ventas">Ventas</option>
              <option value="logistica">Logística</option>
              <option value="inventario">Inventario</option>
              <option value="admin">Administración</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Justificación del Acceso</label>
            <textarea [(ngModel)]="reqReason" rows="3" class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:ring-2 focus:ring-[#38133E] focus:outline-none" placeholder="ej. Asignado a operaciones de reabastecimiento de boutique."></textarea>
          </div>
          <button (click)="submitAccessRequest()" class="w-full bg-[#38133E] hover:bg-[#260B2B] text-white py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs cursor-pointer">
            Enviar Solicitud
          </button>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  @Output() loggedIn = new EventEmitter<void>();
  @Output() showRegister = new EventEmitter<void>();
  @Output() backToLanding = new EventEmitter<void>();

  email = '';
  password = '';
  showPassword = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  showForgotModal = signal<boolean>(false);
  showRequestModal = signal<boolean>(false);
  isWelcomeFlow = signal<boolean>(false);

  recoveryStep = signal<number>(1);
  recoveryEmail = '';
  recoveryToken = '';
  recoveryNewPassword = '';
  recoveryConfirmPassword = '';

  reqName = '';
  reqEmail = '';
  reqHub = 'ventas';
  reqReason = '';

  constructor(private authService: AuthService) {}

  ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    const bienvenida = params.get('bienvenida') === '1';
    if (token) {
      this.isWelcomeFlow.set(bienvenida);
      this.recoveryToken = token;
      this.recoveryNewPassword = '';
      this.recoveryConfirmPassword = '';
      this.recoveryStep.set(2);
      this.showForgotModal.set(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

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
    this.isWelcomeFlow.set(false);
    this.recoveryStep.set(1);
    this.recoveryEmail = '';
    this.recoveryNewPassword = '';
    this.recoveryConfirmPassword = '';
    this.recoveryToken = '';
    this.showForgotModal.set(true);
  }

  sendPasswordRecovery() {
    this.authService.resetPasswordGetToken(this.recoveryEmail).then((token) => {
      if (token) {
        this.recoveryToken = token;
        this.recoveryStep.set(2);
      }
    });
  }

  hasLower(value: string): boolean {
    return hasLower(value);
  }

  hasUpper(value: string): boolean {
    return hasUpper(value);
  }

  hasDigit(value: string): boolean {
    return hasDigit(value);
  }

  hasSpecial(value: string): boolean {
    return hasSpecial(value);
  }

  isRecoveryPasswordValid(): boolean {
    return (
      isStrong(this.recoveryNewPassword) &&
      this.recoveryNewPassword === this.recoveryConfirmPassword
    );
  }

  onShowRegister() {
    this.showRegister.emit();
  }

  onBackToLanding() {
    this.backToLanding.emit();
  }

  submitNewPassword() {
    if (!this.isRecoveryPasswordValid() || !this.recoveryToken) return;
    this.authService.resetPasswordConfirm(this.recoveryToken, this.recoveryNewPassword).then((ok) => {
      if (ok) {
        this.recoveryStep.set(3);
      }
    });
  }

  openRequestAccess() {
    this.showRequestModal.set(true);
  }

  submitAccessRequest() {
    this.authService.requestAccess(this.reqEmail || 'staff@voguely.com', this.reqName, this.reqHub, this.reqReason);
    this.showRequestModal.set(false);
  }
}
