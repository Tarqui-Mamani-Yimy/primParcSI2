import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PASSWORD_RULES,
  PasswordRule,
  etiquetaFuerza,
  fuerzaPassword,
} from '../../core/password-policy';

/**
 * Lista de requisitos de la contrasena que se van marcando en vivo mientras el
 * usuario escribe, con una barra de fuerza.
 */
@Component({
  selector: 'app-password-requirements',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Requisitos de la contraseña
        </span>
        <span class="text-[10px] font-bold" [ngClass]="colorFuerza()">
          {{ etiqueta() }}
        </span>
      </div>

      <div class="h-1 w-full rounded-full bg-gray-200 overflow-hidden mb-3">
        <div
          class="h-full rounded-full transition-all duration-200"
          [ngClass]="barraFuerza()"
          [style.width.%]="fuerza() * 100"
        ></div>
      </div>

      <ul class="space-y-1">
        <li *ngFor="let regla of reglas" class="flex items-center space-x-2">
          <span
            class="material-symbols-outlined text-[14px]"
            [ngClass]="cumple(regla) ? 'text-emerald-600' : 'text-gray-300'"
          >
            {{ cumple(regla) ? 'check_circle' : 'radio_button_unchecked' }}
          </span>
          <span
            class="text-xs"
            [ngClass]="cumple(regla) ? 'text-emerald-700 font-medium' : 'text-gray-500'"
          >
            {{ regla.descripcion }}
          </span>
        </li>
      </ul>
    </div>
  `,
})
export class PasswordRequirementsComponent {
  @Input() password = '';

  readonly reglas = PASSWORD_RULES;

  cumple(regla: PasswordRule): boolean {
    return regla.patron.test(this.password ?? '');
  }

  fuerza(): number {
    return fuerzaPassword(this.password ?? '');
  }

  etiqueta(): string {
    return etiquetaFuerza(this.password ?? '');
  }

  colorFuerza(): string {
    if (!this.password) return 'text-gray-400';
    const f = this.fuerza();
    if (f >= 1) return 'text-emerald-600';
    if (f >= 0.6) return 'text-amber-600';
    return 'text-rose-600';
  }

  barraFuerza(): string {
    const f = this.fuerza();
    if (f >= 1) return 'bg-emerald-500';
    if (f >= 0.6) return 'bg-amber-500';
    return 'bg-rose-500';
  }
}
