import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import { ReservationsService } from '../../../core/services/reservations.service';
import type { ProductOut, Reserva } from '../../../core/models';

// Formato HH:MM (compatible con `time.fromisoformat` del backend).
// El regex vive únicamente en este método de la clase — nunca como literal
// dentro de un binding de template (rompe la compilación AOT de Angular).
const HORARIO_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-md w-full rounded-2xl border border-gray-200 shadow-xl overflow-hidden flex flex-col">
        <div class="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Nueva reserva</span>
            <h2 class="text-base font-bold text-gray-900 mt-0.5 leading-snug">{{ producto.nombre }}</h2>
          </div>
          <button
            (click)="cerrar.emit()"
            class="w-8 h-8 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center hover:bg-gray-900 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form (ngSubmit)="onSubmit()" class="p-5 space-y-4">
          <div class="flex flex-col space-y-1.5">
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wider" for="sucursal">Sucursal</label>
            <select
              id="sucursal"
              name="sucursal"
              [(ngModel)]="codigoSucursal"
              class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option [ngValue]="null">Seleccione una sucursal</option>
              <option *ngFor="let s of inventoryService.locations()" [ngValue]="s.codigoSucursal">
                {{ s.nombre }} — {{ s.ciudad }}
              </option>
            </select>
          </div>

          <div class="flex flex-col space-y-1.5">
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wider" for="fecha">Fecha</label>
            <input
              id="fecha"
              name="fecha"
              type="date"
              [(ngModel)]="fecha"
              class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p *ngIf="fecha && !isFechaValida()" class="text-xs text-rose-600">La fecha debe ser hoy o una fecha futura.</p>
          </div>

          <div class="flex flex-col space-y-1.5">
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wider" for="horario">Horario</label>
            <input
              id="horario"
              name="horario"
              type="time"
              [(ngModel)]="horario"
              class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <p *ngIf="horario && !isHorarioValido()" class="text-xs text-rose-600">Formato de horario inválido (HH:MM).</p>
          </div>

          <p *ngIf="submitError()" class="text-xs text-rose-600">{{ submitError() }}</p>

          <div class="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              (click)="cerrar.emit()"
              class="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="isSubmitting() || !canSubmit()"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {{ isSubmitting() ? 'Reservando...' : 'Confirmar reserva' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class ReservationFormComponent implements OnInit {
  @Input({ required: true }) producto!: ProductOut;
  @Output() cerrar = new EventEmitter<void>();
  @Output() creada = new EventEmitter<Reserva>();

  codigoSucursal: number | null = null;
  fecha = '';
  horario = '';

  isSubmitting = signal<boolean>(false);
  submitError = signal<string | null>(null);

  constructor(
    public inventoryService: InventoryService,
    private reservationsService: ReservationsService,
  ) {}

  ngOnInit() {
    this.inventoryService.loadLocations();
  }

  // El <input type="date"> entrega la fecha calendario LOCAL del usuario
  // como string plano (sin hora/zona). Comparar contra
  // `new Date().toISOString()` compara contra UTC, lo cual rechaza el día
  // de hoy para cualquier usuario en una zona horaria detrás de UTC durante
  // la noche (ej. toda Latinoamérica). Se construye "hoy" a partir de los
  // componentes de fecha LOCALES, no de la representación UTC.
  private todayIso(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isFechaValida(): boolean {
    return this.fecha.length > 0 && this.fecha >= this.todayIso();
  }

  isHorarioValido(): boolean {
    return HORARIO_PATTERN.test(this.horario);
  }

  canSubmit(): boolean {
    return this.codigoSucursal !== null && this.isFechaValida() && this.isHorarioValido();
  }

  async onSubmit() {
    if (!this.canSubmit()) return;

    this.submitError.set(null);
    this.isSubmitting.set(true);

    const reserva = await this.reservationsService.createReservation({
      fecha: this.fecha,
      horario: this.horario,
      codigoSucursal: this.codigoSucursal!,
      idProducto: this.producto.idProducto,
    });

    this.isSubmitting.set(false);

    if (reserva) {
      this.creada.emit(reserva);
    }
  }
}
