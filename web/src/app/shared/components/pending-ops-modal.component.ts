import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OutboxService } from '../../core/services/outbox.service';
import { SyncService } from '../../core/services/sync.service';
import type { PendingOp } from '../../core/models';

@Component({
  selector: 'app-pending-ops-modal',
  standalone: true,
  imports: [CommonModule],
  styles: [`:host { display: block; position: fixed; inset: 0; z-index: 50; }`],
  template: `
    <div class="w-full h-full overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-2xl w-full border border-[#E8E2DA] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">

        <!-- Header -->
        <div class="px-6 py-5 border-b border-[#E8E2DA] flex items-center justify-between bg-[#FAF8F5]">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-[#F5EBF7] border border-[#E8E2DA] flex items-center justify-center text-[#38133E]">
              <span class="material-symbols-outlined text-[22px]">sync</span>
            </div>
            <div>
              <h2 class="text-base font-bold text-[#17141A]">Operaciones fuera de línea</h2>
              <p class="text-xs text-[#5A5561]">
                Cola local de cambios pendientes de sincronizar con el servidor.
              </p>
            </div>
          </div>
          <button
            (click)="close.emit()"
            class="text-[#9B94A3] hover:text-[#17141A] p-2 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- Toolbar / Status Summary -->
        <div class="px-6 py-3 bg-white border-b border-[#E8E2DA] flex items-center justify-between text-xs">
          <div class="flex items-center space-x-3">
            <span class="flex items-center space-x-1.5 text-[#17141A] font-medium">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span>{{ outboxService.pendingCount() }} pendiente{{ outboxService.pendingCount() === 1 ? '' : 's' }}</span>
            </span>
            <span *ngIf="outboxService.failedCount() > 0" class="flex items-center space-x-1.5 text-rose-600 font-bold">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>{{ outboxService.failedCount() }} con error</span>
            </span>
          </div>

          <button
            (click)="syncNow()"
            [disabled]="outboxService.isFlushing() || !syncService.isOnline() || outboxService.totalActiveCount() === 0"
            class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#38133E] hover:bg-[#2A0E2E] text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[16px]" [class.animate-spin]="outboxService.isFlushing()">sync</span>
            <span>{{ outboxService.isFlushing() ? 'Sincronizando...' : 'Sincronizar ahora' }}</span>
          </button>
        </div>

        <!-- Content list -->
        <div class="p-6 overflow-y-auto flex-1 space-y-3">
          <div *ngIf="outboxService.pendingOps().length === 0" class="py-12 text-center text-[#5A5561]">
            <span class="material-symbols-outlined text-[40px] text-[#9B94A3] mb-2 block">cloud_done</span>
            <p class="text-sm font-bold text-[#17141A]">No hay operaciones en cola</p>
            <p class="text-xs text-[#5A5561] mt-1">Todos los cambios están sincronizados con el servidor.</p>
          </div>

          <div
            *ngFor="let op of outboxService.pendingOps()"
            class="p-4 rounded-xl border border-[#E8E2DA] bg-white hover:border-[#38133E]/30 transition-all space-y-2.5"
          >
            <!-- Top row: type badge and status badge -->
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="material-symbols-outlined text-[18px] text-[#38133E]">
                  {{ getOpIcon(op.type) }}
                </span>
                <span class="text-xs font-bold text-[#17141A]">{{ getOpLabel(op.type) }}</span>
                <span class="text-[10px] text-[#9B94A3]">ID: {{ op.id.substring(0, 8) }}...</span>
              </div>

              <!-- Status badge -->
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                [ngClass]="getStatusBadgeClass(op.status)"
              >
                {{ getStatusLabel(op.status) }}
              </span>
            </div>

            <!-- Payload summary -->
            <div class="text-xs text-[#5A5561] bg-[#FAF8F5] p-2.5 rounded-lg border border-[#E8E2DA]">
              <!-- POS sale info -->
              <div *ngIf="op.type === 'pos_sale'" class="space-y-1">
                <p class="font-medium text-[#17141A]">
                  Comprobante: <span class="font-bold">{{ op.payload?.comprobanteLocal || 'OFF' }}</span>
                </p>
                <p>
                  Sucursal ID: {{ op.payload?.idLocal }} | Ítems: {{ op.payload?.items?.length || 0 }}
                </p>
              </div>

              <!-- Reservation info -->
              <div *ngIf="op.type === 'reservation'" class="space-y-1">
                <p class="font-medium text-[#17141A]">
                  Solicitud de reserva: <span class="font-bold">{{ op.payload?.fecha }} ({{ op.payload?.horario }})</span>
                </p>
                <p>
                  Sucursal: {{ op.payload?.codigoSucursal }} | Producto ID: {{ op.payload?.idProducto }}
                </p>
              </div>

              <!-- Profile edit info -->
              <div *ngIf="op.type === 'customer_profile'" class="space-y-1">
                <p class="font-medium text-[#17141A]">
                  Actualización de perfil: <span class="font-bold">{{ op.payload?.nombre }}</span>
                </p>
                <p *ngIf="op.payload?.telefono">Teléfono: {{ op.payload?.telefono }}</p>
              </div>
            </div>

            <!-- Error message if failed -->
            <div *ngIf="op.status === 'failed' && op.lastError" class="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <p class="font-bold flex items-center space-x-1">
                <span class="material-symbols-outlined text-[14px]">error</span>
                <span>Error definitivo del servidor:</span>
              </p>
              <p>{{ op.lastError }}</p>
            </div>

            <!-- Bottom row: date and action buttons -->
            <div class="flex items-center justify-between pt-1 border-t border-[#E8E2DA] text-[11px] text-[#9B94A3]">
              <span>Creado: {{ formatDate(op.createdAt) }} (Intentos: {{ op.attempts }})</span>

              <!-- Actions for failed or stuck sending ops -->
              <div class="flex items-center space-x-2" *ngIf="op.status === 'failed' || op.status === 'sending'">
                <button
                  (click)="discard(op.id)"
                  class="px-2.5 py-1 rounded text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
                >
                  Descartar
                </button>
                <button
                  (click)="retry(op.id)"
                  class="px-2.5 py-1 rounded bg-[#38133E] hover:bg-[#2A0E2E] text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 bg-[#FAF8F5] border-t border-[#E8E2DA] flex justify-end">
          <button
            (click)="close.emit()"
            class="px-4 py-2 rounded-xl border border-[#E8E2DA] hover:bg-white text-xs font-bold text-[#17141A] transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  `
})
export class PendingOpsModalComponent {
  @Output() close = new EventEmitter<void>();

  public outboxService = inject(OutboxService);
  public syncService = inject(SyncService);

  getOpIcon(type: string): string {
    switch (type) {
      case 'pos_sale':
        return 'point_of_sale';
      case 'reservation':
        return 'calendar_month';
      case 'customer_profile':
        return 'person';
      default:
        return 'pending_actions';
    }
  }

  getOpLabel(type: string): string {
    switch (type) {
      case 'pos_sale':
        return 'Venta en caja (POS)';
      case 'reservation':
        return 'Solicitud de reserva';
      case 'customer_profile':
        return 'Actualización de perfil';
      default:
        return 'Operación local';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'sending':
        return 'Enviando...';
      case 'failed':
        return 'Error';
      case 'done':
        return 'Sincronizado';
      default:
        return status;
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'sending':
        return 'bg-blue-100 text-blue-800 border border-blue-300';
      case 'failed':
        return 'bg-rose-100 text-rose-800 border border-rose-300';
      case 'done':
        return 'bg-green-100 text-green-800 border border-green-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  formatDate(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch {
      return isoString;
    }
  }

  async syncNow(): Promise<void> {
    await this.outboxService.flush();
  }

  async retry(id: string): Promise<void> {
    await this.outboxService.retryOp(id);
  }

  async discard(id: string): Promise<void> {
    await this.outboxService.discardOp(id);
  }
}
