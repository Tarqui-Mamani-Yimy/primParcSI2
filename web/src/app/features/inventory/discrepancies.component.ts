import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesService } from '../../core/services/sales.service';
import { AuthService } from '../../core/services/auth.service';
import { SyncService } from '../../core/services/sync.service';
import type { Venta } from '../../core/models';

@Component({
  selector: 'app-discrepancies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`:host { display: block; }`],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">

      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#38133E]">Control y Auditoría</span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">Discrepancias de Stock Offline</h1>
          <p class="text-xs text-gray-500 mt-1">
            Ventas registradas fuera de línea con stock cero o insuficiente que requieren conciliación física.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            (click)="cargarDiscrepancias()"
            [disabled]="loading() || !syncService.isOnline()"
            class="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-[18px]" [class.animate-spin]="loading()">refresh</span>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <!-- Permission Guard Check (OX6: visible only with inventario.ajustar) -->
      <div *ngIf="!canAdjustInventory()" class="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2">
        <span class="material-symbols-outlined text-rose-500 text-[36px]">lock</span>
        <h2 class="text-sm font-bold text-rose-800">Acceso Restringido</h2>
        <p class="text-xs text-rose-600 max-w-md mx-auto">
          Para ver y resolver discrepancias de inventario necesitas el permiso <code>inventario.ajustar</code>.
        </p>
      </div>

      <ng-container *ngIf="canAdjustInventory()">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="p-4 bg-white rounded-xl border border-gray-200 shadow-xs">
            <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Discrepancias</p>
            <p class="text-2xl font-black text-gray-900 mt-1">{{ ventas().length }}</p>
          </div>
          <div class="p-4 bg-white rounded-xl border border-gray-200 shadow-xs">
            <p class="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pendientes de Ajuste</p>
            <p class="text-2xl font-black text-amber-600 mt-1">{{ pendientesCount() }}</p>
          </div>
          <div class="p-4 bg-white rounded-xl border border-gray-200 shadow-xs">
            <p class="text-[11px] font-bold text-green-600 uppercase tracking-wider">Conciliadas</p>
            <p class="text-2xl font-black text-green-600 mt-1">{{ resueltasCount() }}</p>
          </div>
        </div>

        <!-- Table -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div class="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
            <span class="text-xs font-bold text-gray-700 uppercase tracking-wider">Registro de Ventas con Discrepancia</span>
            <span class="text-xs text-gray-400">Total: {{ ventas().length }}</span>
          </div>

          <div *ngIf="loading()" class="p-12 text-center text-gray-400 text-xs">
            Cargando discrepancias...
          </div>

          <div *ngIf="!loading() && ventas().length === 0" class="p-12 text-center text-gray-500 space-y-2">
            <span class="material-symbols-outlined text-[40px] text-gray-300 block">inventory</span>
            <p class="text-sm font-bold text-gray-800">No se encontraron discrepancias</p>
            <p class="text-xs text-gray-400">Todas las ventas fuera de línea tenían stock suficiente o ya fueron conciliadas.</p>
          </div>

          <div class="overflow-x-auto" *ngIf="!loading() && ventas().length > 0">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-200 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                  <th class="p-3.5 pl-6">ID / Comprobante</th>
                  <th class="p-3.5">Fecha</th>
                  <th class="p-3.5">Total</th>
                  <th class="p-3.5">Ítems Vendidos</th>
                  <th class="p-3.5">Estado</th>
                  <th class="p-3.5 text-right pr-6">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 text-xs">
                <tr *ngFor="let v of ventas()" class="hover:bg-gray-50/70 transition-colors">
                  <td class="p-3.5 pl-6">
                    <div class="font-bold text-gray-900 leading-tight">
                      #{{ v.idVenta }}
                      <span *ngIf="v.comprobanteLocal" class="ml-1 text-[11px] font-mono text-[#38133E] bg-[#F5EBF7] px-1.5 py-0.5 rounded">
                        {{ v.comprobanteLocal }}
                      </span>
                    </div>
                    <span class="text-[10px] text-gray-400 uppercase tracking-wider block mt-0.5">
                      Origen: {{ v.origen || 'offline' }}
                    </span>
                  </td>

                  <td class="p-3.5 text-gray-600">
                    {{ formatDate(v.fecha) }}
                  </td>

                  <td class="p-3.5 font-bold text-gray-900">
                    Bs {{ v.total | number:'1.2-2' }}
                  </td>

                  <td class="p-3.5 text-gray-600">
                    <div class="space-y-0.5">
                      <div *ngFor="let item of v.detalles" class="text-[11px]">
                        <span class="font-bold text-gray-800">{{ item.cantidad }}x</span>
                        <span class="ml-1">{{ item.producto_nombre || 'Producto #' + item.idProducto }}</span>
                      </div>
                    </div>
                  </td>

                  <td class="p-3.5">
                    <div *ngIf="v.discrepanciaResueltaEn; else pendingBadge" class="space-y-1">
                      <span class="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold uppercase">
                        Conciliada
                      </span>
                      <p class="text-[10px] text-gray-500 italic max-w-xs truncate" [title]="v.discrepanciaNota || ''">
                        Nota: {{ v.discrepanciaNota }}
                      </p>
                    </div>
                    <ng-template #pendingBadge>
                      <span class="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase">
                        Stock insuficiente
                      </span>
                    </ng-template>
                  </td>

                  <td class="p-3.5 text-right pr-6">
                    <button
                      *ngIf="!v.discrepanciaResueltaEn"
                      (click)="openResolveModal(v)"
                      [disabled]="!syncService.isOnline()"
                      [title]="!syncService.isOnline() ? 'Operación no disponible sin conexión a internet' : ''"
                      class="px-3 py-1.5 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Marcar revisada
                    </button>
                    <span *ngIf="v.discrepanciaResueltaEn" class="text-[11px] text-gray-400 font-medium">
                      Revisada el {{ formatDate(v.discrepanciaResueltaEn) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>

      <!-- Modal de resolución de discrepancia (OX6) -->
      <div *ngIf="selectedVenta()" class="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-[#FAF8F5]">
            <div>
              <h2 class="text-base font-bold text-gray-900">Resolver Discrepancia</h2>
              <p class="text-xs text-gray-500 mt-0.5">
                Venta #{{ selectedVenta()?.idVenta }} ({{ selectedVenta()?.comprobanteLocal || 'OFF' }})
              </p>
            </div>
            <button
              (click)="selectedVenta.set(null)"
              class="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
              <p class="font-bold">Aviso de conciliación:</p>
              <p>
                Esta venta se completó fuera de línea cuando el inventario del sistema estaba en 0 o era insuficiente.
                Ingresa una nota descriptiva del ajuste físico realizado para auditar el inventario.
              </p>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-800 mb-1">
                Nota de ajuste / Conciliación física <span class="text-rose-500">*</span>
              </label>
              <textarea
                [(ngModel)]="resolutionNote"
                rows="3"
                required
                placeholder="Ej: Se verificó stock en depósito sucursal central; 2 unidades halladas físicamente sin registrar."
                class="w-full text-xs p-3 rounded-lg border border-gray-200 focus:outline-none focus:border-[#38133E] resize-none"
              ></textarea>
            </div>
          </div>

          <div class="px-6 py-4 bg-[#FAF8F5] border-t border-gray-200 flex items-center justify-end space-x-3">
            <button
              (click)="selectedVenta.set(null)"
              class="px-4 py-2 rounded-lg border border-gray-200 hover:bg-white text-xs font-bold text-gray-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              (click)="submitResolution()"
              [disabled]="resolving() || !resolutionNote.trim() || !syncService.isOnline()"
              class="px-4 py-2 rounded-lg bg-[#38133E] hover:bg-[#260B2B] text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {{ resolving() ? 'Guardando...' : 'Confirmar y Marcar Revisada' }}
            </button>
          </div>
        </div>
      </div>

    </div>
  `
})
export class DiscrepanciesComponent implements OnInit {
  private salesService = inject(SalesService);
  public authService = inject(AuthService);
  public syncService = inject(SyncService);

  ventas = signal<Venta[]>([]);
  loading = signal(false);
  resolving = signal(false);
  selectedVenta = signal<Venta | null>(null);
  resolutionNote = '';

  canAdjustInventory = signal(false);

  pendientesCount = signal(0);
  resueltasCount = signal(0);

  ngOnInit(): void {
    const hasPerm = this.authService.hasPermission('inventario.ajustar');
    this.canAdjustInventory.set(hasPerm);

    if (hasPerm) {
      this.cargarDiscrepancias();
    }
  }

  async cargarDiscrepancias(): Promise<void> {
    this.loading.set(true);
    try {
      const items = await this.salesService.listarVentasDiscrepantes();
      this.ventas.set(items);
      this.updateCounts(items);
    } catch (e) {
      console.warn('Error loading discrepancy sales:', e);
    } finally {
      this.loading.set(false);
    }
  }

  private updateCounts(items: Venta[]): void {
    const pendientes = items.filter(v => !v.discrepanciaResueltaEn).length;
    const resueltas = items.filter(v => !!v.discrepanciaResueltaEn).length;
    this.pendientesCount.set(pendientes);
    this.resueltasCount.set(resueltas);
  }

  openResolveModal(v: Venta): void {
    this.selectedVenta.set(v);
    this.resolutionNote = '';
  }

  async submitResolution(): Promise<void> {
    const v = this.selectedVenta();
    if (!v || !this.resolutionNote.trim()) return;

    this.resolving.set(true);
    try {
      const note = this.resolutionNote.trim();
      await this.salesService.resolverDiscrepancia(v.idVenta, note);

      // Update locally
      const updated = this.ventas().map(item => {
        if (item.idVenta === v.idVenta) {
          return {
            ...item,
            discrepanciaResueltaEn: new Date().toISOString(),
            discrepanciaNota: note,
          };
        }
        return item;
      });
      this.ventas.set(updated);
      this.updateCounts(updated);
      this.selectedVenta.set(null);
    } catch (e) {
      console.warn('Error resolving discrepancy:', e);
    } finally {
      this.resolving.set(false);
    }
  }

  formatDate(val: string | null | undefined): string {
    if (!val) return '';
    try {
      const d = new Date(val);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch {
      return val;
    }
  }
}
