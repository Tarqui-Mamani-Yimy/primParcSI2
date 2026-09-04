import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="h-16 bg-white border-b border-gray-200 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">

      <!-- Izquierda: menu movil y ruta de navegacion -->
      <div class="flex items-center space-x-3">
        <button
          (click)="toggleMobileMenu.emit()"
          class="md:hidden text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Abrir o cerrar la navegación"
        >
          <span class="material-symbols-outlined text-[20px]">menu</span>
        </button>

        <div class="flex items-center space-x-2 text-sm">
          <span class="font-bold text-gray-900 tracking-tight">AETHER</span>
          <span class="text-gray-300">/</span>
          <span class="text-gray-400 hidden sm:inline">Operaciones</span>
          <span class="text-gray-300 hidden sm:inline">/</span>
          <span class="font-medium text-gray-900">{{ activeViewTitle }}</span>
        </div>
      </div>

      <!-- Derecha: estado del sistema e identidad del usuario -->
      <div class="flex items-center space-x-3">

        <!-- Indicador de estado del sistema -->
        <div class="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-[11px] font-bold text-emerald-700 uppercase tracking-tight">Bóveda sincronizada</span>
        </div>

        <!-- Menu de usuario -->
        <div class="relative" *ngIf="authService.currentUser() as user">
          <button
            (click)="showUserDropdown.update(v => !v)"
            class="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-left cursor-pointer border border-transparent hover:border-gray-200"
          >
            <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs border border-indigo-200">
              {{ user.nombre.substring(0, 2).toUpperCase() }}
            </div>
            <div class="hidden md:block">
              <p class="text-xs font-bold text-gray-900 leading-tight">{{ user.nombre }}</p>
              <p class="text-[10px] text-gray-500 font-medium">{{ user.rol }}</p>
            </div>
            <span class="material-symbols-outlined text-[16px] text-gray-400">expand_more</span>
          </button>

          <!-- Desplegable -->
          <div
            *ngIf="showUserDropdown()"
            class="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            <div class="px-3 py-2 border-b border-gray-100">
              <p class="text-xs font-bold text-gray-900">{{ user.nombre }}</p>
              <p class="text-xs text-gray-500 truncate">{{ user.email }}</p>
              <span class="inline-block mt-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase border border-indigo-100">
                {{ user.rol }}
              </span>
            </div>

            <div class="py-1">
              <p class="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Permisos activos:</p>
              <div class="px-3 py-1 flex flex-wrap gap-1">
                <span *ngFor="let perm of user.permisos" class="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-600 text-[9px] font-medium">
                  {{ perm.replace('_', ' ') }}
                </span>
              </div>
            </div>

            <div class="pt-1 border-t border-gray-100">
              <button
                (click)="onLogout()"
                class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-50 text-xs font-semibold text-rose-600 flex items-center space-x-2"
              >
                <span class="material-symbols-outlined text-[16px]">logout</span>
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  @Input() activeViewTitle = 'Centro de Operaciones';
  @Output() toggleMobileMenu = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  showUserDropdown = signal<boolean>(false);

  constructor(public authService: AuthService) {}

  onLogout() {
    this.showUserDropdown.set(false);
    this.authService.logout();
    this.logout.emit();
  }
}
