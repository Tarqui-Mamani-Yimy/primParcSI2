import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="h-16 bg-white border-b border-[#E8E2DA] px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">

      <!-- Izquierda: Menú móvil y breadcrumb -->
      <div class="flex items-center space-x-3">
        <button
          (click)="toggleMobileMenu.emit()"
          class="md:hidden text-[#5A5561] p-1.5 hover:bg-[#F3EFEA] rounded-lg transition-colors"
          aria-label="Alternar navegación"
        >
          <span class="material-symbols-outlined text-[20px]">menu</span>
        </button>

        <div class="flex items-center space-x-2 text-sm">
          <span class="font-bold text-[#17141A] tracking-tight">
            {{ authService.isSuperAdmin() ? 'Plataforma SaaS' : (authService.empresa()?.nombre || 'YouShop') }}
          </span>
          <span class="text-[#E8E2DA]">/</span>
          <span class="text-[#9B94A3] hidden sm:inline">
            {{ authService.isSuperAdmin() ? 'SuperAdmin' : 'Operaciones' }}
          </span>
          <span class="text-[#E8E2DA] hidden sm:inline">/</span>
          <span class="font-medium text-[#17141A]">{{ activeViewTitle }}</span>
        </div>
      </div>

      <!-- Derecha: Estado en vivo e identidad de usuario -->
      <div class="flex items-center space-x-3">

        <!-- Indicador de estado del sistema -->
        <div class="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#DCFCE7] border border-[#DCFCE7]">
          <span class="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse"></span>
          <span class="text-[11px] font-bold text-[#16A34A] uppercase tracking-tight">Bóveda Sincronizada</span>
        </div>

        <!-- Menú de usuario -->
        <div class="relative" *ngIf="authService.currentUser() as user">
          <button
            (click)="showUserDropdown.update(v => !v)"
            class="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-[#F3EFEA] transition-colors text-left cursor-pointer border border-transparent hover:border-[#E8E2DA]"
          >
            <div class="w-7 h-7 rounded-full bg-[#F5EBF7] flex items-center justify-center text-[#38133E] font-bold text-xs border border-[#E8E2DA]">
              {{ user.nombre.substring(0, 2).toUpperCase() }}
            </div>
            <div class="hidden md:block">
              <p class="text-xs font-bold text-[#17141A] leading-tight">{{ user.nombre }}</p>
              <p class="text-[10px] text-[#5A5561] font-medium">{{ user.rol }}</p>
            </div>
            <span class="material-symbols-outlined text-[16px] text-[#9B94A3]">expand_more</span>
          </button>

          <!-- Menú desplegable -->
          <div
            *ngIf="showUserDropdown()"
            class="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-[#E8E2DA] shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            <div class="px-3 py-2 border-b border-[#E8E2DA]">
              <p class="text-xs font-bold text-[#17141A]">{{ user.nombre }}</p>
              <p class="text-xs text-[#5A5561] truncate">{{ user.email }}</p>
              <div class="flex items-center gap-1.5 mt-1.5">
                <span class="inline-block px-2 py-0.5 rounded-full bg-[#F5EBF7] text-[#38133E] text-[10px] font-bold uppercase border border-[#E8E2DA]">
                  {{ user.rol }}
                </span>
                <span *ngIf="authService.plan() as p" class="inline-block px-2 py-0.5 rounded-full bg-[#FAF8F5] text-[#38133E] text-[10px] font-bold uppercase border border-[#E8E2DA]">
                  {{ p.nombre }}
                </span>
              </div>
            </div>

            <div class="py-1">
              <p class="px-3 py-1 text-[10px] font-bold text-[#9B94A3] uppercase tracking-widest">Permisos activos:</p>
              <div class="px-3 py-1 flex flex-wrap gap-1">
                <span *ngFor="let perm of user.permisos" class="px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#E8E2DA] text-[#5A5561] text-[9px] font-medium">
                  {{ perm.replace('_', ' ') }}
                </span>
              </div>
            </div>

            <div class="pt-1 border-t border-[#E8E2DA] space-y-0.5">
              <button
                (click)="openChangePassword()"
                class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[#F3EFEA] text-xs font-semibold text-[#17141A] flex items-center space-x-2"
              >
                <span class="material-symbols-outlined text-[16px] text-[#5A5561]">lock</span>
                <span>Cambiar Contraseña</span>
              </button>
              <button
                (click)="onLogout()"
                class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-50 text-xs font-semibold text-rose-600 flex items-center space-x-2"
              >
                <span class="material-symbols-outlined text-[16px]">logout</span>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Modal: Cambiar contraseña -->
    <div *ngIf="showChangePasswordModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-[#17141A]/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-md w-full p-6 sm:p-8 rounded-2xl border border-[#E8E2DA] shadow-xl relative">
        <button (click)="showChangePasswordModal.set(false)" class="absolute top-4 right-4 text-[#9B94A3] hover:text-[#17141A] p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div class="mb-5">
          <span class="text-[10px] font-bold tracking-wider text-[#38133E] uppercase">Seguridad de Cuenta</span>
          <h3 class="text-lg font-bold text-[#17141A] mt-1">Cambiar Contraseña</h3>
          <p class="text-xs text-[#5A5561] mt-1">Ingrese su contraseña actual y la nueva contraseña.</p>
        </div>
        <div class="space-y-4">
          <div>
            <label class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Contraseña Actual</label>
            <input type="password" [(ngModel)]="currentPassword" class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-sm focus:ring-2 focus:ring-[#38133E] focus:outline-none" placeholder="Ingrese su contraseña actual" />
          </div>
          <div>
            <label class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Nueva Contraseña</label>
            <input type="password" [(ngModel)]="newPassword" class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-sm focus:ring-2 focus:ring-[#38133E] focus:outline-none" placeholder="Mínimo 10 caracteres" />
          </div>
          <div>
            <label class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Confirmar Nueva Contraseña</label>
            <input type="password" [(ngModel)]="confirmPassword" class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-sm focus:ring-2 focus:ring-[#38133E] focus:outline-none" placeholder="Repita la nueva contraseña" />
          </div>

          <!-- Reglas de contraseña -->
          <div class="p-3 bg-[#FAF8F5] rounded-lg border border-[#E8E2DA] space-y-1.5">
            <p class="text-[10px] font-bold uppercase tracking-wider text-[#5A5561] mb-2">Requisitos de contraseña:</p>
            <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="newPassword.length >= 10" [class.text-ys-subtle]="newPassword.length < 10">
              <span>{{ newPassword.length >= 10 ? '✓' : '○' }}</span>
              <span>Mínimo 10 caracteres</span>
            </div>
            <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="hasLower(newPassword)" [class.text-ys-subtle]="!hasLower(newPassword)">
              <span>{{ hasLower(newPassword) ? '✓' : '○' }}</span>
              <span>Al menos 1 minúscula</span>
            </div>
            <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="hasUpper(newPassword)" [class.text-ys-subtle]="!hasUpper(newPassword)">
              <span>{{ hasUpper(newPassword) ? '✓' : '○' }}</span>
              <span>Al menos 1 mayúscula</span>
            </div>
            <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="hasDigit(newPassword)" [class.text-ys-subtle]="!hasDigit(newPassword)">
              <span>{{ hasDigit(newPassword) ? '✓' : '○' }}</span>
              <span>Al menos 1 número</span>
            </div>
            <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="hasSpecial(newPassword)" [class.text-ys-subtle]="!hasSpecial(newPassword)">
              <span>{{ hasSpecial(newPassword) ? '✓' : '○' }}</span>
              <span>Al menos 1 carácter especial</span>
            </div>
            <div class="flex items-center space-x-2 text-xs" [class.text-ys-success]="newPassword === confirmPassword && confirmPassword.length > 0" [class.text-ys-subtle]="newPassword !== confirmPassword || confirmPassword.length === 0">
              <span>{{ newPassword === confirmPassword && confirmPassword.length > 0 ? '✓' : '○' }}</span>
              <span>Las contraseñas coinciden</span>
            </div>
          </div>

          <button
            (click)="submitChangePassword()"
            [disabled]="!isChangePasswordValid()"
            class="w-full bg-[#38133E] hover:bg-[#260B2B] text-white py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Actualizar Contraseña
          </button>
        </div>
      </div>
    </div>
  `
})
export class HeaderComponent {
  @Input() activeViewTitle = 'Centro de Operaciones';
  @Output() toggleMobileMenu = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  showUserDropdown = signal<boolean>(false);
  showChangePasswordModal = signal<boolean>(false);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  constructor(public authService: AuthService) {}

  openChangePassword() {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.showUserDropdown.set(false);
    this.showChangePasswordModal.set(true);
  }

  hasLower(value: string): boolean {
    return /[a-z]/.test(value);
  }

  hasUpper(value: string): boolean {
    return /[A-Z]/.test(value);
  }

  hasDigit(value: string): boolean {
    return /[0-9]/.test(value);
  }

  hasSpecial(value: string): boolean {
    return /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value);
  }

  isChangePasswordValid(): boolean {
    return (
      this.currentPassword.length > 0 &&
      this.newPassword.length >= 10 &&
      this.hasLower(this.newPassword) &&
      this.hasUpper(this.newPassword) &&
      this.hasDigit(this.newPassword) &&
      this.hasSpecial(this.newPassword) &&
      this.newPassword === this.confirmPassword
    );
  }

  submitChangePassword() {
    if (!this.isChangePasswordValid()) return;
    this.authService.changePassword(this.currentPassword, this.newPassword).then((ok) => {
      if (ok) {
        this.showChangePasswordModal.set(false);
      }
    });
  }

  onLogout() {
    this.showUserDropdown.set(false);
    this.authService.logout();
    this.logout.emit();
  }
}
