import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationsService } from '../../../core/services/reservations.service';
import { SyncService } from '../../../core/services/sync.service';
import { OutboxService } from '../../../core/services/outbox.service';

@Component({
  selector: 'app-customer-reservations',
  standalone: true,
  imports: [CommonModule],
  styles: [`:host { display: block; }`],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">

      <div class="pb-5 border-b border-[#E8E2DA]">
        <span class="text-[11px] font-bold uppercase tracking-wider text-[#38133E]">Reservas</span>
        <h1 class="text-2xl font-bold text-[#17141A] tracking-tight mt-0.5">Mis Reservas</h1>
        <p class="text-xs text-[#5A5561] mt-1">Reservas creadas desde el catálogo. Podés cancelar las que aún estén pendientes.</p>
      </div>

      <div *ngIf="reservationsService.reservations().length === 0 && pendingReservationOps().length === 0" class="text-center py-12 text-[#9B94A3] text-sm">
        Todavía no tenés reservas. Explorá el catálogo para crear una.
      </div>

      <div class="space-y-3">
        <!-- Solicitudes pendientes creadas fuera de línea (OX3) -->
        <div
          *ngFor="let op of pendingReservationOps()"
          class="bg-amber-50/50 rounded-xl border border-amber-200 shadow-xs p-4 flex items-center justify-between gap-4"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-[#17141A] truncate">
                {{ op.payload.producto_nombre || ('Producto #' + op.payload.idProducto) }}
              </h3>
              <span
                class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                [class.bg-amber-100]="op.status === 'pending' || op.status === 'sending'"
                [class.text-amber-800]="op.status === 'pending' || op.status === 'sending'"
                [class.bg-rose-100]="op.status === 'failed'"
                [class.text-rose-800]="op.status === 'failed'"
              >
                {{ op.status === 'failed' ? 'Rechazada' : 'Solicitud pendiente' }}
              </span>
            </div>
            <p class="text-xs text-[#5A5561] mt-1">
              Sucursal #{{ op.payload.codigoSucursal }} · {{ op.payload.fecha }} · {{ op.payload.horario }}
            </p>
            <p *ngIf="op.status !== 'failed'" class="text-[11px] text-amber-700 mt-1 font-medium">
              En cola local para sincronizar con el servidor (nunca confirmada hasta recibir respuesta).
            </p>
            <p *ngIf="op.status === 'failed' && op.lastError" class="text-[11px] text-rose-600 mt-1 font-medium">
              Motivo: {{ op.lastError }}
            </p>
          </div>
        </div>

        <!-- Reservas sincronizadas -->
        <div
          *ngFor="let r of reservationsService.reservations()"
          class="bg-white rounded-xl border border-[#E8E2DA] shadow-xs p-4 flex items-center justify-between gap-4"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-[#17141A] truncate">{{ r.producto_nombre || ('Producto #' + r.idProducto) }}</h3>
              <span
                class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                [class.bg-amber-50]="r.estado === 'Pendiente'"
                [class.text-amber-700]="r.estado === 'Pendiente'"
                [class.bg-ys-primary-soft]="r.estado === 'Preparada en Sucursal'"
                [class.text-ys-primary]="r.estado === 'Preparada en Sucursal'"
                [class.bg-ys-success-soft]="r.estado === 'Confirmada'"
                [class.text-ys-success]="r.estado === 'Confirmada'"
                [class.bg-ys-surface]="r.estado === 'Cancelada'"
                [class.text-ys-muted]="r.estado === 'Cancelada'"
              >
                {{ r.estado }}
              </span>
            </div>
            <p class="text-xs text-[#5A5561] mt-1">
              {{ r.sucursal_nombre || ('Sucursal #' + r.codigoSucursal) }} · {{ r.fecha }} · {{ r.horario }}
            </p>
          </div>

          <button
            *ngIf="r.estado === 'Pendiente'"
            (click)="onCancelar(r.codigoReserva)"
            [disabled]="cancelandoId() === r.codigoReserva || !syncService.isOnline()"
            [title]="!syncService.isOnline() ? 'Operación no disponible sin conexión a internet' : ''"
            class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide text-rose-600 border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {{ cancelandoId() === r.codigoReserva ? 'Cancelando...' : 'Cancelar' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class CustomerReservationsComponent implements OnInit {
  cancelandoId = signal<number | null>(null);

  pendingReservationOps = computed(() =>
    this.outboxService.pendingOps().filter(op =>
      op.type === 'reservation' && (op.status === 'pending' || op.status === 'sending' || op.status === 'failed')
    )
  );

  constructor(
    public reservationsService: ReservationsService,
    public syncService: SyncService,
    public outboxService: OutboxService,
  ) {}

  ngOnInit() {
    this.outboxService.refreshCounts();
    this.reservationsService.loadReservations();
  }

  async onCancelar(codigoReserva: number) {
    this.cancelandoId.set(codigoReserva);
    await this.reservationsService.cancelReservation(codigoReserva);
    this.cancelandoId.set(null);
  }
}
