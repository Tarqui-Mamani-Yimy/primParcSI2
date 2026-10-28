import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { hasDigit, hasLower, hasSpecial, hasUpper, isStrong } from '../../shared/utils/password-rules';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="flex w-full h-screen overflow-hidden bg-[#FAF8F5] text-[#17141A] font-sans selection:bg-[#F5EBF7] selection:text-[#38133E]">
      <section class="w-full flex items-center justify-center p-6 md:p-12 lg:p-16 bg-[#FAF8F5] relative">
        <div class="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl border border-[#E8E2DA] shadow-sm relative z-10">

          <div class="flex flex-col items-center justify-center mb-6">
            <div class="w-10 h-10 bg-[#38133E] rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md mb-2">V</div>
            <span class="text-xl font-bold text-[#17141A] tracking-tight">Voguely</span>
            <span class="text-xs tracking-wider text-[#5A5561] uppercase">Portal de Clientes</span>
          </div>

          <div class="text-center mb-8">
            <h2 class="text-xl font-bold text-[#17141A]">Crear Cuenta</h2>
            <p class="text-xs text-[#5A5561] mt-1">Registrate para reservar prendas y ver el catálogo</p>
          </div>

          <form (ngSubmit)="onSubmit()" class="flex flex-col space-y-5">
            <div class="flex flex-col space-y-1.5">
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider" for="nombre">Nombre Completo</label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                [(ngModel)]="nombre"
                required
                placeholder="Nombre y apellido"
                class="w-full bg-white border border-[#E8E2DA] rounded-lg px-3.5 py-2.5 text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:outline-none focus:ring-2 focus:ring-[#38133E] focus:border-[#38133E] transition-all"
              />
            </div>

            <div class="flex flex-col space-y-1.5">
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider" for="email">Correo Electrónico</label>
              <input
                id="email"
                name="email"
                type="email"
                [(ngModel)]="email"
                (ngModelChange)="emailError.set(null)"
                required
                placeholder="nombre@correo.com"
                class="w-full bg-white border rounded-lg px-3.5 py-2.5 text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:outline-none focus:ring-2 focus:ring-[#38133E] transition-all"
                [class.border-ys-border]="!emailError()"
                [class.border-rose-400]="emailError()"
              />
              <p *ngIf="emailError()" class="text-xs text-rose-600 mt-1">{{ emailError() }}</p>
            </div>

            <div class="flex flex-col space-y-1.5">
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider" for="password">Contraseña</label>
              <div class="relative">
                <input
                  id="password"
                  name="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  [(ngModel)]="password"
                  (ngModelChange)="passwordError.set(null)"
                  required
                  placeholder="••••••••"
                  class="w-full bg-white border border-[#E8E2DA] rounded-lg px-3.5 py-2.5 text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:outline-none focus:ring-2 focus:ring-[#38133E] focus:border-[#38133E] transition-all pr-10"
                />
                <button
                  type="button"
                  (click)="togglePasswordVisibility()"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-[#9B94A3] hover:text-[#17141A] transition-colors p-1 cursor-pointer"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                >
                  <span class="material-symbols-outlined text-[18px]">{{ showPassword() ? 'visibility' : 'visibility_off' }}</span>
                </button>
              </div>
            </div>

            <div class="flex flex-col space-y-1.5">
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider" for="confirmPassword">Confirmar Contraseña</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                [type]="showPassword() ? 'text' : 'password'"
                [(ngModel)]="confirmPassword"
                required
                placeholder="Repita la contraseña"
                class="w-full bg-white border border-[#E8E2DA] rounded-lg px-3.5 py-2.5 text-sm text-[#17141A] placeholder:text-[#9B94A3] focus:outline-none focus:ring-2 focus:ring-[#38133E] focus:border-[#38133E] transition-all"
              />
            </div>

            <!-- Checklist en vivo de reglas de contraseña -->
            <div class="p-3 bg-[#F3EFEA] rounded-lg border border-[#E8E2DA] space-y-1.5">
              <p class="text-[10px] font-bold uppercase tracking-wider text-[#5A5561] mb-2">Requisitos de contraseña:</p>
              <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="password.length >= 10" [class.text-gray-400]="password.length < 10">
                <span>{{ password.length >= 10 ? '✓' : '○' }}</span>
                <span>Mínimo 10 caracteres</span>
              </div>
              <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="hasLower(password)" [class.text-gray-400]="!hasLower(password)">
                <span>{{ hasLower(password) ? '✓' : '○' }}</span>
                <span>Al menos 1 minúscula</span>
              </div>
              <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="hasUpper(password)" [class.text-gray-400]="!hasUpper(password)">
                <span>{{ hasUpper(password) ? '✓' : '○' }}</span>
                <span>Al menos 1 mayúscula</span>
              </div>
              <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="hasDigit(password)" [class.text-gray-400]="!hasDigit(password)">
                <span>{{ hasDigit(password) ? '✓' : '○' }}</span>
                <span>Al menos 1 número</span>
              </div>
              <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="hasSpecial(password)" [class.text-gray-400]="!hasSpecial(password)">
                <span>{{ hasSpecial(password) ? '✓' : '○' }}</span>
                <span>Al menos 1 carácter especial</span>
              </div>
              <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="passwordsMatch()" [class.text-gray-400]="!passwordsMatch()">
                <span>{{ passwordsMatch() ? '✓' : '○' }}</span>
                <span>Las contraseñas coinciden</span>
              </div>
            </div>

            <p *ngIf="passwordError()" class="text-xs text-rose-600">{{ passwordError() }}</p>

            <div class="pt-2">
              <button
                type="submit"
                [disabled]="isLoading() || !canSubmit()"
                class="w-full bg-[#38133E] hover:bg-[#260B2B] text-white py-2.5 px-4 rounded-lg text-xs font-bold tracking-wide uppercase shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <span *ngIf="isLoading()" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{{ isLoading() ? 'CREANDO CUENTA...' : 'CREAR CUENTA' }}</span>
              </button>
            </div>

            <div class="text-center pt-2">
              <span class="text-xs text-[#5A5561]">¿Ya tenés una cuenta?</span>
              <button type="button" (click)="onBackToLogin()" class="ml-1 text-xs font-semibold text-[#38133E] hover:text-[#260B2B] transition-colors cursor-pointer">
                Iniciar sesión
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
  `
})
export class RegisterComponent {
  @Output() registered = new EventEmitter<void>();
  @Output() backToLogin = new EventEmitter<void>();
  @Output() backToLanding = new EventEmitter<void>();

  nombre = '';
  email = '';
  password = '';
  confirmPassword = '';

  showPassword = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  emailError = signal<string | null>(null);
  passwordError = signal<string | null>(null);

  constructor(private authService: AuthService) {}

  togglePasswordVisibility() {
    this.showPassword.update((v) => !v);
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

  passwordsMatch(): boolean {
    return this.password.length > 0 && this.password === this.confirmPassword;
  }

  canSubmit(): boolean {
    return (
      this.nombre.trim().length > 0 &&
      this.email.trim().length > 0 &&
      isStrong(this.password) &&
      this.passwordsMatch()
    );
  }

  onSubmit() {
    if (!this.canSubmit()) return;

    this.emailError.set(null);
    this.passwordError.set(null);
    this.isLoading.set(true);

    this.authService
      .register({ nombre: this.nombre, email: this.email, password: this.password })
      .then((result) => {
        this.isLoading.set(false);
        if (result.ok) {
          this.registered.emit();
          return;
        }
        if (result.field === 'email') {
          this.emailError.set(result.message || 'El correo ya está registrado');
        } else if (result.field === 'password') {
          this.passwordError.set(result.message || 'No se pudo completar el registro');
        }
        // Sin campo específico (network error, timeout, 5xx): el toast de
        // NotificationService ya informó el error, no se atribuye a un campo.
      });
  }

  onBackToLogin() {
    this.backToLogin.emit();
  }

  onBackToLanding() {
    this.backToLanding.emit();
  }
}
