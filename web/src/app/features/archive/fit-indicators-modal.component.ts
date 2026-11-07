import { Component, EventEmitter, OnInit, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FitFeedbackSummaryItem } from '../../core/models';
import { SizeChartService } from '../../core/services/size-chart.service';
import { SyncService } from '../../core/services/sync.service';

@Component({
  selector: 'app-fit-indicators-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#17141A]/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-5xl w-full rounded-2xl border border-gray-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col relative">

        <!-- Encabezado del modal -->
        <div class="p-5 md:p-6 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[11px] font-bold uppercase tracking-wider text-[#38133E]">
                Gestión de Catálogo • CU36
              </span>
              <span
                *ngIf="totalAlertas() > 0"
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {{ totalAlertas() }} {{ totalAlertas() === 1 ? 'alerta de ajuste' : 'alertas de ajuste' }}
              </span>
            </div>

            <h2 class="text-lg md:text-xl font-bold text-gray-900 mt-1 leading-snug">
              Indicadores de Ajuste y Calibración de Tallas
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">
              Acumulado de opiniones de clientes post-compra para detectar desviaciones en el tallaje y calibrar la tabla de medidas.
            </p>
          </div>

          <button
            (click)="close.emit()"
            class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-900 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <!-- Contenido principal -->
        <div class="overflow-y-auto p-5 md:p-6 space-y-4 flex-1">
          <div class="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <span class="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">info</span>
            <p class="leading-relaxed">
              Una prenda activa una <strong>alerta</strong> cuando tiene al menos 3 opiniones y el 60% o más de los clientes reporta que le quedó pequeña o grande. Use la acción de medidas para corregir los centímetros reales.
            </p>
          </div>

          <!-- Estado de carga -->
          <div *ngIf="loading()" class="py-16 text-center space-y-3">
            <span class="material-symbols-outlined animate-spin text-[32px] text-[#38133E]">progress_activity</span>
            <p class="text-xs text-gray-500 font-medium">Cargando indicadores de ajuste…</p>
          </div>

          <!-- Error de carga -->
          <div *ngIf="!loading() && loadFailed()" class="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
            <span>No se pudo obtener el resumen de indicadores de ajuste.</span>
            <button
              (click)="loadSummary()"
              class="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-bold cursor-pointer transition-colors"
            >
              Reintentar
            </button>
          </div>

          <!-- Tabla de indicadores -->
          <div *ngIf="!loading() && !loadFailed()" class="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                    <th class="py-3 px-4">Producto</th>
                    <th class="py-3 px-3 text-center">Talla</th>
                    <th class="py-3 px-3 text-center">Total Opiniones</th>
                    <th class="py-3 px-3 text-center">Pequeña</th>
                    <th class="py-3 px-3 text-center">Bien</th>
                    <th class="py-3 px-3 text-center">Grande</th>
                    <th class="py-3 px-3 text-center">Estado</th>
                    <th class="py-3 px-4 text-center w-36">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr *ngFor="let item of summaryList()" class="hover:bg-gray-50/70 transition-colors">
                    <!-- Producto -->
                    <td class="py-3 px-4">
                      <p class="text-xs font-bold text-gray-900">{{ item.nombre }}</p>
                      <p class="text-[10px] text-gray-400">ID {{ item.idProducto }}</p>
                    </td>

                    <!-- Talla -->
                    <td class="py-3 px-3 text-center">
                      <span class="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-800">
                        {{ item.talla || '—' }}
                      </span>
                    </td>

                    <!-- Total -->
                    <td class="py-3 px-3 text-center text-xs font-bold text-gray-900">
                      {{ item.total }}
                    </td>

                    <!-- Pequeña -->
                    <td class="py-3 px-3 text-center text-xs">
                      <span class="font-bold text-amber-700">{{ item.pequena }}</span>
                      <span class="text-[10px] text-gray-400 block">({{ calcPorcentaje(item.pequena, item.total) }}%)</span>
                    </td>

                    <!-- Bien -->
                    <td class="py-3 px-3 text-center text-xs">
                      <span class="font-bold text-emerald-700">{{ item.bien }}</span>
                      <span class="text-[10px] text-gray-400 block">({{ calcPorcentaje(item.bien, item.total) }}%)</span>
                    </td>

                    <!-- Grande -->
                    <td class="py-3 px-3 text-center text-xs">
                      <span class="font-bold text-blue-700">{{ item.grande }}</span>
                      <span class="text-[10px] text-gray-400 block">({{ calcPorcentaje(item.grande, item.total) }}%)</span>
                    </td>

                    <!-- Estado / Alerta -->
                    <td class="py-3 px-3 text-center">
                      <span
                        *ngIf="item.alerta"
                        class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-800 border border-rose-200"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                        Alerta de ajuste
                      </span>
                      <span
                        *ngIf="!item.alerta"
                        class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                      >
                        Normal
                      </span>
                    </td>

                    <!-- Botón para ajustar tabla de medidas -->
                    <td class="py-3 px-4 text-center">
                      <button
                        type="button"
                        (click)="editarMedidas.emit(item.idProducto)"
                        class="px-2.5 py-1.5 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold tracking-wide uppercase transition-colors cursor-pointer flex items-center justify-center gap-1 mx-auto"
                        title="Abrir tabla de medidas de este producto"
                      >
                        <span class="material-symbols-outlined text-[15px]">straighten</span>
                        <span>Medidas</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div *ngIf="summaryList().length === 0" class="py-12 text-center text-xs text-gray-400">
              Aún no se han registrado opiniones de ajuste en ningún producto.
            </div>
          </div>
        </div>

        <!-- Pie de modal -->
        <div class="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <span class="text-xs text-gray-500 font-medium">
            Total productos evaluados: {{ totalProductos() }}
          </span>
          <button
            type="button"
            (click)="close.emit()"
            class="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  `
})
export class FitIndicatorsModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() editarMedidas = new EventEmitter<number>();

  loading = signal<boolean>(true);
  loadFailed = signal<boolean>(false);
  summaryList = signal<FitFeedbackSummaryItem[]>([]);

  totalAlertas = computed(() => this.summaryList().filter((s) => s.alerta).length);
  totalProductos = computed(() => this.summaryList().length);

  constructor(
    private sizeChartService: SizeChartService,
    public syncService: SyncService
  ) {}

  ngOnInit(): void {
    void this.loadSummary();
  }

  calcPorcentaje(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  async loadSummary(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);

    try {
      const list = await this.sizeChartService.getFitFeedbackSummary();
      this.summaryList.set(list || []);
    } catch {
      this.loadFailed.set(true);
      this.summaryList.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
