import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-xl mx-auto p-6 sm:p-8">
      <div class="mb-6">
        <span class="text-[10px] font-bold tracking-wider text-[#38133E] uppercase">Mi Cuenta</span>
        <h2 class="text-xl font-bold text-[#17141A] mt-1">Datos de mi perfil</h2>
        <p class="text-sm text-[#5A5561] mt-1">Información de solo lectura asociada a tu cuenta.</p>
      </div>

      <div class="bg-white rounded-2xl border border-[#E8E2DA] shadow-xs p-6 space-y-5" *ngIf="authService.currentUser() as user; else noUser">
        <div class="flex items-center space-x-4">
          <div class="w-14 h-14 rounded-full bg-[#F5EBF7] flex items-center justify-center text-[#38133E] font-bold text-lg border border-[#E8E2DA]">
            {{ user.nombre.substring(0, 2).toUpperCase() }}
          </div>
          <div>
            <p class="text-base font-bold text-[#17141A] leading-tight">{{ user.nombre }}</p>
            <span class="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#F5EBF7] text-[#38133E] text-[10px] font-bold uppercase border border-[#E8E2DA]">
              {{ user.rol }}
            </span>
          </div>
        </div>

        <div class="border-t border-[#E8E2DA] pt-4 space-y-3">
          <div>
            <p class="text-[10px] font-bold text-[#9B94A3] uppercase tracking-widest">Nombre</p>
            <p class="text-sm text-[#17141A] font-medium mt-0.5">{{ user.nombre }}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold text-[#9B94A3] uppercase tracking-widest">Correo Electrónico</p>
            <p class="text-sm text-[#17141A] font-medium mt-0.5">{{ user.email }}</p>
          </div>
          <div>
            <p class="text-[10px] font-bold text-[#9B94A3] uppercase tracking-widest">Rol</p>
            <p class="text-sm text-[#17141A] font-medium mt-0.5">{{ user.rol }}</p>
          </div>
        </div>
      </div>

      <ng-template #noUser>
        <div class="bg-white rounded-2xl border border-[#E8E2DA] shadow-xs p-6 text-sm text-[#5A5561]">
          No se encontraron datos de la cuenta.
        </div>
      </ng-template>
    </div>
  `
})
export class CustomerProfileComponent {
  constructor(public authService: AuthService) {}
}
