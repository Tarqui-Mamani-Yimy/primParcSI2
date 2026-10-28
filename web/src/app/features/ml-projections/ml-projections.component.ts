import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DashboardMlService,
  parseDashboardMlError,
} from '../../core/services/dashboard-ml.service';
import {
  MLCustomerSegmentItem,
  MLCustomerSegmentSummary,
  MLCustomerSegmentsOut,
  MLForecastPoint,
  MLHistoryPoint,
  MLProductTrend,
  MLProductTrendItem,
  MLProductTrendsOut,
  MLSalesForecastOut,
  MLStockoutItem,
  MLStockoutRiskOut,
} from '../../core/models';
import { InventoryService } from '../../core/services/inventory.service';
import { NotificationService } from '../../core/services/notification.service';

interface ChartPoint {
  date: string;
  amount: number;
  lower?: number;
  upper?: number;
  units?: number;
  type: 'history' | 'forecast';
  x: number;
  y: number;
  yLower?: number;
  yUpper?: number;
}

@Component({
  selector: 'app-ml-projections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 animate-in fade-in duration-200">

      <!-- Encabezado de la Sección -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200">
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#38133E]">
              Analítica Predictiva · Machine Learning
            </span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5EBF7] text-[#38133E] border border-[#E8E2DA] uppercase tracking-wider">
              scikit-learn
            </span>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
            Proyecciones y Modelos de Inteligencia Analítica
          </h2>
          <p class="text-xs text-gray-500 mt-1">
            Pronósticos de ventas con bandas de confianza, alertas tempranas de stockout, tendencias y segmentación RFM de clientes.
          </p>
        </div>

        <div class="flex items-center space-x-2">
          <button
            type="button"
            (click)="recargarTodo()"
            [disabled]="loadingGeneral()"
            class="px-3.5 py-2 bg-white hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#17141A] rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-[16px]" [class.animate-spin]="loadingGeneral()">
              refresh
            </span>
            <span>Actualizar Modelos</span>
          </button>
        </div>
      </div>

      <!-- Barra de Filtros Globales (Días & Sucursal) -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-xs font-bold uppercase tracking-wider text-gray-500">
            Sucursal:
          </span>
          <select
            [ngModel]="selectedBranchId()"
            (ngModelChange)="onBranchChange($event)"
            [disabled]="loadingGeneral()"
            class="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#38133E]"
          >
            <option [ngValue]="null">Todas las sucursales (Consolidado)</option>
            <option *ngFor="let loc of inventoryService.locations()" [ngValue]="loc.codigoSucursal">
              {{ loc.nombre }} ({{ loc.ciudad }})
            </option>
          </select>
        </div>

        <div class="flex items-center space-x-2">
          <span class="text-xs font-bold uppercase tracking-wider text-gray-500 mr-1">
            Horizonte:
          </span>
          <div class="inline-flex rounded-lg bg-gray-100 p-0.5 border border-gray-200">
            <button
              type="button"
              (click)="onDaysChange(7)"
              [class.bg-white]="selectedDays() === 7"
              [class.text-[#38133E]]="selectedDays() === 7"
              [class.font-bold]="selectedDays() === 7"
              [class.shadow-2xs]="selectedDays() === 7"
              [class.text-gray-500]="selectedDays() !== 7"
              class="px-3 py-1 text-xs rounded-md transition-all cursor-pointer"
            >
              7 Días
            </button>
            <button
              type="button"
              (click)="onDaysChange(30)"
              [class.bg-white]="selectedDays() === 30"
              [class.text-[#38133E]]="selectedDays() === 30"
              [class.font-bold]="selectedDays() === 30"
              [class.shadow-2xs]="selectedDays() === 30"
              [class.text-gray-500]="selectedDays() !== 30"
              class="px-3 py-1 text-xs rounded-md transition-all cursor-pointer"
            >
              30 Días
            </button>
            <button
              type="button"
              (click)="onDaysChange(90)"
              [class.bg-white]="selectedDays() === 90"
              [class.text-[#38133E]]="selectedDays() === 90"
              [class.font-bold]="selectedDays() === 90"
              [class.shadow-2xs]="selectedDays() === 90"
              [class.text-gray-500]="selectedDays() !== 90"
              class="px-3 py-1 text-xs rounded-md transition-all cursor-pointer"
            >
              90 Días
            </button>
          </div>
        </div>
      </div>

      <!-- Banner de Error Global si fallaron las llamadas -->
      <div *ngIf="errorMessage()" class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between gap-3">
        <div class="flex items-center space-x-2">
          <span class="material-symbols-outlined text-[20px] text-rose-600">error</span>
          <span>{{ errorMessage() }}</span>
        </div>
        <button
          type="button"
          (click)="recargarTodo()"
          class="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer shrink-0"
        >
          Reintentar
        </button>
      </div>

      <!-- ============================================================== -->
      <!-- 1) GRÁFICO DE PRONÓSTICO DE VENTAS (S2) -->
      <!-- ============================================================== -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs space-y-4">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-[#38133E] text-[20px]">show_chart</span>
              <h3 class="text-base font-bold text-gray-900">Pronóstico Predictivo de Ventas</h3>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">
              Regresión sobre ventas históricas con estacionalidad semanal y banda de incertidumbre basada en residuales.
            </p>
          </div>

          <!-- Total Proyectado & Badge de Modelo -->
          <div *ngIf="!loadingForecast() && salesForecast() && !salesForecast()?.insufficient_data" class="flex flex-wrap items-center gap-2 sm:text-right">
            <div class="bg-[#FAF8F5] border border-[#E8E2DA] rounded-lg px-3 py-1.5">
              <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Total Proyectado</span>
              <span class="text-sm font-bold text-[#38133E]">
                Bs {{ (salesForecast()?.total_forecast_amount ?? 0).toLocaleString() }}
              </span>
            </div>
            <span *ngIf="salesForecast()?.model as mdl" class="px-2.5 py-1 text-[10px] font-bold bg-[#F5EBF7] text-[#38133E] border border-[#E8E2DA] rounded-lg uppercase">
              {{ mdl.name }} · MAE: Bs {{ mdl.mae.toLocaleString() }}
            </span>
          </div>
        </div>

        <!-- Estado de Carga -->
        <div *ngIf="loadingForecast()" class="py-16 text-center space-y-2">
          <span class="material-symbols-outlined text-3xl text-[#38133E] animate-spin">progress_activity</span>
          <p class="text-xs text-gray-500 font-medium">Entrenando modelo y proyectando serie temporal…</p>
        </div>

        <!-- Estado Insufficient Data -->
        <div
          *ngIf="!loadingForecast() && salesForecast()?.insufficient_data"
          class="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-2"
        >
          <span class="material-symbols-outlined text-3xl text-gray-400">hourglass_empty</span>
          <h4 class="text-sm font-bold text-gray-800">Aún no hay suficiente historial para proyectar</h4>
          <p class="text-xs text-gray-500 max-w-md mx-auto">
            El modelo de Machine Learning requiere al menos dos semanas consecutivas de registros de venta para estimar la tendencia y los patrones semanales.
          </p>
        </div>

        <!-- Gráfico SVG con banda lower/upper -->
        <div *ngIf="!loadingForecast() && !salesForecast()?.insufficient_data && salesPoints().length > 0" class="space-y-3">
          
          <!-- Leyenda del Gráfico -->
          <div class="flex flex-wrap items-center gap-4 text-xs text-gray-600 justify-end pt-1">
            <div class="flex items-center space-x-1.5">
              <span class="w-4 h-0.5 bg-[#38133E] inline-block"></span>
              <span>Historial Real</span>
            </div>
            <div class="flex items-center space-x-1.5">
              <span class="w-4 h-0.5 border-t-2 border-dashed border-[#6E1D2D] inline-block"></span>
              <span>Pronóstico ML ({{ selectedDays() }}d)</span>
            </div>
            <div class="flex items-center space-x-1.5">
              <span class="w-3.5 h-3.5 bg-[#38133E]/15 rounded border border-[#38133E]/30 inline-block"></span>
              <span>Banda de Confianza (Lower / Upper)</span>
            </div>
          </div>

          <div class="relative overflow-hidden">
            <svg
              #chartSvg
              [attr.viewBox]="'0 0 ' + chartW + ' ' + chartH"
              class="w-full h-auto select-none"
              (mousemove)="onChartHover($event, chartSvg)"
              (mouseleave)="onChartLeave()"
            >
              <!-- Gridlines horizontales -->
              <g *ngFor="let tick of chartYTicks()">
                <line
                  [attr.x1]="pad.left"
                  [attr.x2]="chartW - pad.right"
                  [attr.y1]="tick.y"
                  [attr.y2]="tick.y"
                  stroke="#E8E2DA"
                  stroke-width="1"
                />
                <text
                  [attr.x]="pad.left - 8"
                  [attr.y]="tick.y + 3"
                  text-anchor="end"
                  font-size="10"
                  fill="#9B94A3"
                >
                  Bs {{ formatNumberCompact(tick.value) }}
                </text>
              </g>

              <!-- Eje X -->
              <line
                [attr.x1]="pad.left"
                [attr.x2]="chartW - pad.right"
                [attr.y1]="chartH - pad.bottom"
                [attr.y2]="chartH - pad.bottom"
                stroke="#E8E2DA"
                stroke-width="1"
              />
              <text
                *ngFor="let tick of chartXTicks()"
                [attr.x]="tick.x"
                [attr.y]="chartH - pad.bottom + 16"
                text-anchor="middle"
                font-size="10"
                fill="#9B94A3"
              >
                {{ tick.label }}
              </text>

              <!-- Banda de Confianza (Sombreado Lower / Upper) -->
              <path
                *ngIf="forecastBandPath()"
                [attr.d]="forecastBandPath()"
                fill="#38133E"
                fill-opacity="0.10"
                stroke="none"
              />

              <!-- Líneas superior e inferior de la banda (punteadas sutiles) -->
              <path
                *ngIf="forecastUpperPath()"
                [attr.d]="forecastUpperPath()"
                fill="none"
                stroke="#9B94A3"
                stroke-width="1"
                stroke-dasharray="2,2"
              />
              <path
                *ngIf="forecastLowerPath()"
                [attr.d]="forecastLowerPath()"
                fill="none"
                stroke="#9B94A3"
                stroke-width="1"
                stroke-dasharray="2,2"
              />

              <!-- Línea de Conexión entre Historial y Pronóstico -->
              <line
                *ngIf="connectingLineCoords() as c"
                [attr.x1]="c.x1"
                [attr.y1]="c.y1"
                [attr.x2]="c.x2"
                [attr.y2]="c.y2"
                stroke="#6E1D2D"
                stroke-width="2"
                stroke-dasharray="4,3"
              />

              <!-- Línea Historial -->
              <path
                *ngIf="historyPath()"
                [attr.d]="historyPath()"
                fill="none"
                stroke="#38133E"
                stroke-width="2.5"
                stroke-linejoin="round"
                stroke-linecap="round"
              />

              <!-- Línea Pronóstico -->
              <path
                *ngIf="forecastPath()"
                [attr.d]="forecastPath()"
                fill="none"
                stroke="#6E1D2D"
                stroke-width="2.5"
                stroke-dasharray="5,4"
                stroke-linejoin="round"
                stroke-linecap="round"
              />

              <!-- Área interactiva de hover -->
              <rect
                [attr.x]="pad.left"
                [attr.y]="pad.top"
                [attr.width]="chartW - pad.left - pad.right"
                [attr.height]="chartH - pad.top - pad.bottom"
                fill="transparent"
              />

              <!-- Crosshair vertical y punto resaltado al hacer hover -->
              <ng-container *ngIf="hoveredPoint() as p">
                <line
                  [attr.x1]="p.x"
                  [attr.x2]="p.x"
                  [attr.y1]="pad.top"
                  [attr.y2]="chartH - pad.bottom"
                  stroke="#9B94A3"
                  stroke-width="1"
                  stroke-dasharray="3,3"
                />
                <circle
                  [attr.cx]="p.x"
                  [attr.cy]="p.y"
                  r="5"
                  [attr.fill]="p.type === 'forecast' ? '#6E1D2D' : '#38133E'"
                  stroke="#FFFFFF"
                  stroke-width="2"
                />
              </ng-container>
            </svg>

            <!-- Tooltip Flotante -->
            <div
              *ngIf="hoveredPoint() as p"
              class="absolute pointer-events-none bg-gray-900/95 backdrop-blur-xs text-white rounded-xl px-3 py-2 text-xs shadow-xl -translate-x-1/2 -translate-y-full z-10 border border-gray-800"
              [style.left.%]="(p.x / chartW) * 100"
              [style.top.%]="(p.y / chartH) * 100 - 3"
            >
              <div class="flex items-center space-x-1.5 mb-1">
                <span
                  class="w-2 h-2 rounded-full"
                  [class.bg-[#38133E]]="p.type === 'history'"
                  [class.bg-rose-400]="p.type === 'forecast'"
                ></span>
                <span class="font-bold text-[11px] uppercase tracking-wider text-gray-300">
                  {{ p.type === 'history' ? 'Dato Histórico' : 'Pronóstico ML' }}
                </span>
                <span class="text-gray-400">· {{ p.date }}</span>
              </div>
              <p class="text-sm font-bold">
                Bs {{ p.amount.toLocaleString() }}
              </p>
              <p *ngIf="p.type === 'history' && p.units !== undefined" class="text-gray-400 text-[11px]">
                {{ p.units }} unidades vendidas
              </p>
              <div *ngIf="p.type === 'forecast'" class="text-[11px] text-gray-300 border-t border-gray-700/80 pt-1 mt-1 space-y-0.5">
                <p>Límite Inferior: Bs {{ (p.lower ?? 0).toLocaleString() }}</p>
                <p>Límite Superior: Bs {{ (p.upper ?? 0).toLocaleString() }}</p>
              </div>
            </div>
          </div>

        </div>

      </div>

      <!-- ============================================================== -->
      <!-- 2) TABLA: RIESGO DE QUIEBRE DE STOCK (S3) -->
      <!-- ============================================================== -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs space-y-4">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
              <h3 class="text-base font-bold text-gray-900">Riesgo de Quiebre de Stock</h3>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">
              Productos clasificados ascendentemente por días estimados hasta agotarse, con reposición calculada para 30 días de cobertura.
            </p>
          </div>

          <div class="flex items-center space-x-2">
            <button
              type="button"
              (click)="filtroSoloCriticos.set(!filtroSoloCriticos())"
              [class.bg-rose-50]="filtroSoloCriticos()"
              [class.border-rose-300]="filtroSoloCriticos()"
              [class.text-rose-700]="filtroSoloCriticos()"
              [class.bg-white]="!filtroSoloCriticos()"
              [class.border-gray-200]="!filtroSoloCriticos()"
              [class.text-gray-600]="!filtroSoloCriticos()"
              class="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <span class="material-symbols-outlined text-[16px]">priority_high</span>
              <span>Solo Críticos (&lt; 7 días)</span>
            </button>
          </div>
        </div>

        <!-- Estado de Carga -->
        <div *ngIf="loadingStockout()" class="py-12 text-center space-y-2">
          <span class="material-symbols-outlined text-3xl text-[#38133E] animate-spin">progress_activity</span>
          <p class="text-xs text-gray-500 font-medium">Calculando velocidad de agotamiento y demanda diaria…</p>
        </div>

        <!-- Estado Insufficient Data -->
        <div
          *ngIf="!loadingStockout() && stockoutRisk()?.insufficient_data"
          class="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-2"
        >
          <span class="material-symbols-outlined text-3xl text-gray-400">hourglass_empty</span>
          <h4 class="text-sm font-bold text-gray-800">Aún no hay suficiente historial para proyectar</h4>
          <p class="text-xs text-gray-500 max-w-md mx-auto">
            Se requiere registrar ventas continuas para estimar la tasa de demanda diaria de los productos en inventario.
          </p>
        </div>

        <!-- Tabla con Productos -->
        <div *ngIf="!loadingStockout() && !stockoutRisk()?.insufficient_data" class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <th class="py-3 px-4">Producto</th>
                <th class="py-3 px-3 text-center">Talla</th>
                <th class="py-3 px-4">Sucursal</th>
                <th class="py-3 px-3 text-right">Stock Actual</th>
                <th class="py-3 px-3 text-right">Demanda Diaria</th>
                <th class="py-3 px-4 text-center">Días hasta Agotarse</th>
                <th class="py-3 px-4 text-right">Reposición Sugerida</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                *ngFor="let item of filteredStockoutItems()"
                [class.bg-rose-50/40]="item.days_to_stockout < 7"
                class="hover:bg-gray-50/80 transition-colors"
              >
                <td class="py-3 px-4 font-semibold text-gray-900">
                  <div class="flex items-center space-x-2">
                    <span
                      *ngIf="item.days_to_stockout < 7"
                      class="material-symbols-outlined text-rose-600 text-[16px] shrink-0"
                      title="Riesgo crítico de quiebre de stock (< 7 días)"
                    >
                      error
                    </span>
                    <span>{{ item.product_name }}</span>
                  </div>
                </td>
                <td class="py-3 px-3 text-center text-gray-600 font-medium">
                  {{ item.talla || '—' }}
                </td>
                <td class="py-3 px-4 text-gray-600">
                  {{ item.branch_name || 'Sucursal #' + item.branch_id }}
                </td>
                <td class="py-3 px-3 text-right font-bold text-gray-900">
                  {{ item.current_stock }} pzs
                </td>
                <td class="py-3 px-3 text-right text-gray-600">
                  {{ formatDecimal(item.daily_demand) }} /día
                </td>
                <td class="py-3 px-4 text-center">
                  <span
                    class="px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center space-x-1"
                    [ngClass]="getStockoutBadgeClass(item.days_to_stockout)"
                  >
                    <span>{{ formatDays(item.days_to_stockout) }}</span>
                  </span>
                </td>
                <td class="py-3 px-4 text-right font-bold text-[#38133E]">
                  +{{ item.suggested_restock }} pzs
                </td>
              </tr>

              <tr *ngIf="filteredStockoutItems().length === 0">
                <td colspan="7" class="py-8 text-center text-gray-400">
                  <span class="material-symbols-outlined text-2xl text-gray-300 block mb-1">inventory</span>
                  No se encontraron productos en riesgo con los filtros seleccionados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      <!-- ============================================================== -->
      <!-- 3) TENDENCIA DE PRODUCTOS (S4) -->
      <!-- ============================================================== -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs space-y-4">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-[#38133E] text-[20px]">trending_up</span>
              <h3 class="text-base font-bold text-gray-900">Tendencia de Productos</h3>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">
              Dirección de demanda semanal estimada mediante regresión lineal sobre las unidades vendidas en los últimos períodos.
            </p>
          </div>

          <!-- Filtro de Tendencias -->
          <div class="flex items-center space-x-1">
            <button
              type="button"
              (click)="filtroTrend.set('todos')"
              [class.bg-[#38133E]]="filtroTrend() === 'todos'"
              [class.text-white]="filtroTrend() === 'todos'"
              [class.bg-gray-100]="filtroTrend() !== 'todos'"
              [class.text-gray-700]="filtroTrend() !== 'todos'"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer"
            >
              Todos
            </button>
            <button
              type="button"
              (click)="filtroTrend.set('creciendo')"
              [class.bg-emerald-600]="filtroTrend() === 'creciendo'"
              [class.text-white]="filtroTrend() === 'creciendo'"
              [class.bg-gray-100]="filtroTrend() !== 'creciendo'"
              [class.text-gray-700]="filtroTrend() !== 'creciendo'"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer"
            >
              Creciendo
            </button>
            <button
              type="button"
              (click)="filtroTrend.set('estable')"
              [class.bg-gray-700]="filtroTrend() === 'estable'"
              [class.text-white]="filtroTrend() === 'estable'"
              [class.bg-gray-100]="filtroTrend() !== 'estable'"
              [class.text-gray-700]="filtroTrend() !== 'estable'"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer"
            >
              Estables
            </button>
            <button
              type="button"
              (click)="filtroTrend.set('cayendo')"
              [class.bg-rose-600]="filtroTrend() === 'cayendo'"
              [class.text-white]="filtroTrend() === 'cayendo'"
              [class.bg-gray-100]="filtroTrend() !== 'cayendo'"
              [class.text-gray-700]="filtroTrend() !== 'cayendo'"
              class="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer"
            >
              Cayendo
            </button>
          </div>
        </div>

        <!-- Estado de Carga -->
        <div *ngIf="loadingTrends()" class="py-12 text-center space-y-2">
          <span class="material-symbols-outlined text-3xl text-[#38133E] animate-spin">progress_activity</span>
          <p class="text-xs text-gray-500 font-medium">Analizando pendientes de ventas semanales…</p>
        </div>

        <!-- Estado Insufficient Data -->
        <div
          *ngIf="!loadingTrends() && productTrends()?.insufficient_data"
          class="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-2"
        >
          <span class="material-symbols-outlined text-3xl text-gray-400">hourglass_empty</span>
          <h4 class="text-sm font-bold text-gray-800">Aún no hay suficiente historial para proyectar</h4>
          <p class="text-xs text-gray-500 max-w-md mx-auto">
            El cálculo de pendientes requiere registrar transacciones en varias semanas consecutivas.
          </p>
        </div>

        <!-- Grid de Items con Tendencia -->
        <div *ngIf="!loadingTrends() && !productTrends()?.insufficient_data" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            *ngFor="let item of filteredTrendItems()"
            class="p-4 rounded-xl border border-gray-200 bg-white shadow-2xs hover:border-[#38133E]/30 transition-all flex flex-col justify-between"
          >
            <div class="flex items-start justify-between gap-2">
              <h4 class="text-sm font-bold text-gray-900 leading-snug">
                {{ item.product_name }}
              </h4>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 flex items-center space-x-1"
                [ngClass]="getTrendBadgeClass(item.trend)"
              >
                <span class="material-symbols-outlined text-[12px]">
                  {{ getTrendIcon(item.trend) }}
                </span>
                <span>{{ getTrendLabel(item.trend) }}</span>
              </span>
            </div>

            <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <div>
                <span class="text-gray-400 text-[10px] uppercase font-bold block">Últimos 30d</span>
                <span class="font-bold text-gray-900 text-sm">{{ item.units_last_30 }} pzs</span>
              </div>
              <div class="text-right">
                <span class="text-gray-400 text-[10px] uppercase font-bold block">Previos 30d</span>
                <span class="font-semibold text-gray-700 text-sm">{{ item.units_prev_30 }} pzs</span>
              </div>
              <div class="text-right">
                <span class="text-gray-400 text-[10px] uppercase font-bold block">Pendiente</span>
                <span class="font-bold font-mono text-xs" [ngClass]="getSlopeColor(item.slope)">
                  {{ item.slope > 0 ? '+' : '' }}{{ formatDecimal(item.slope) }}
                </span>
              </div>
            </div>
          </div>

          <div *ngIf="filteredTrendItems().length === 0" class="col-span-full py-8 text-center text-gray-400">
            No hay productos que coincidan con la tendencia seleccionada.
          </div>
        </div>

      </div>

      <!-- ============================================================== -->
      <!-- 4) SEGMENTACIÓN DE CLIENTES (S5) -->
      <!-- ============================================================== -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs space-y-5">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-[#38133E] text-[20px]">groups</span>
              <h3 class="text-base font-bold text-gray-900">Segmentación de Clientes (KMeans RFM)</h3>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">
              Clasificación automática por Recencia, Frecuencia y Valor Monetario acumulado para identificar fidelidad y riesgo de fuga.
            </p>
          </div>
        </div>

        <!-- Estado de Carga -->
        <div *ngIf="loadingSegments()" class="py-12 text-center space-y-2">
          <span class="material-symbols-outlined text-3xl text-[#38133E] animate-spin">progress_activity</span>
          <p class="text-xs text-gray-500 font-medium">Calculando clusters RFM con scikit-learn…</p>
        </div>

        <!-- Estado Insufficient Data -->
        <div
          *ngIf="!loadingSegments() && customerSegments()?.insufficient_data"
          class="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-2"
        >
          <span class="material-symbols-outlined text-3xl text-gray-400">hourglass_empty</span>
          <h4 class="text-sm font-bold text-gray-800">Aún no hay suficiente historial para proyectar</h4>
          <p class="text-xs text-gray-500 max-w-md mx-auto">
            El algoritmo KMeans requiere una muestra representativa de clientes y transacciones para generar grupos diferenciados.
          </p>
        </div>

        <!-- Contenido de Segmentos -->
        <div *ngIf="!loadingSegments() && !customerSegments()?.insufficient_data" class="space-y-6">
          
          <!-- Tarjetas por Segmento -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              *ngFor="let seg of customerSegments()?.segments"
              class="p-5 rounded-xl border border-gray-200 bg-[#FAF8F5] shadow-2xs space-y-3"
            >
              <div class="flex items-center justify-between">
                <span class="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider" [ngClass]="getSegmentBadgeClass(seg.segment)">
                  {{ seg.label || seg.segment }}
                </span>
                <span class="text-sm font-bold text-gray-900">
                  {{ seg.customers }} clientes
                </span>
              </div>

              <div class="grid grid-cols-3 gap-2 pt-2 border-t border-[#E8E2DA] text-xs">
                <div>
                  <span class="text-gray-400 text-[10px] uppercase font-bold block">Recencia</span>
                  <span class="font-bold text-gray-800">{{ formatDecimal(seg.avg_recency_days) }} d</span>
                </div>
                <div>
                  <span class="text-gray-400 text-[10px] uppercase font-bold block">Frecuencia</span>
                  <span class="font-bold text-gray-800">{{ formatDecimal(seg.avg_frequency) }}x</span>
                </div>
                <div>
                  <span class="text-gray-400 text-[10px] uppercase font-bold block">Gasto Prom.</span>
                  <span class="font-bold text-[#38133E]">Bs {{ formatNumberCompact(seg.avg_amount) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tabla Detalle de Clientes Segmentados -->
          <div class="border border-gray-200 rounded-xl overflow-hidden">
            <div class="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-700">
                Clientes Mapeados ({{ (customerSegments()?.customers ?? []).length }})
              </span>
            </div>

            <div class="max-h-72 overflow-y-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="sticky top-0 bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr class="border-b border-gray-200">
                    <th class="py-2.5 px-4">Cliente</th>
                    <th class="py-2.5 px-4">Segmento</th>
                    <th class="py-2.5 px-3 text-right">Días desde última compra</th>
                    <th class="py-2.5 px-3 text-right">Frecuencia (compras)</th>
                    <th class="py-2.5 px-4 text-right">Monto Acumulado</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr *ngFor="let c of customerSegments()?.customers" class="hover:bg-gray-50/70 transition-colors">
                    <td class="py-2.5 px-4 font-semibold text-gray-900">
                      {{ c.name || 'Cliente #' + c.customer_id }}
                    </td>
                    <td class="py-2.5 px-4">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border" [ngClass]="getSegmentBadgeClass(c.segment)">
                        {{ getSegmentLabel(c.segment) }}
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-right text-gray-700 font-medium">
                      {{ c.recency_days }} días
                    </td>
                    <td class="py-2.5 px-3 text-right text-gray-700 font-medium">
                      {{ c.frequency }}
                    </td>
                    <td class="py-2.5 px-4 text-right font-bold text-[#38133E]">
                      Bs {{ c.monetary.toLocaleString() }}
                    </td>
                  </tr>

                  <tr *ngIf="(customerSegments()?.customers ?? []).length === 0">
                    <td colspan="5" class="py-6 text-center text-gray-400">
                      No se encontraron clientes registrados en este conjunto.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  `
})
export class MlProjectionsComponent implements OnInit {
  selectedDays = signal<number>(30);
  selectedBranchId = signal<number | null>(null);

  loadingGeneral = signal<boolean>(false);
  loadingForecast = signal<boolean>(false);
  loadingStockout = signal<boolean>(false);
  loadingTrends = signal<boolean>(false);
  loadingSegments = signal<boolean>(false);

  errorMessage = signal<string | null>(null);

  salesForecast = signal<MLSalesForecastOut | null>(null);
  stockoutRisk = signal<MLStockoutRiskOut | null>(null);
  productTrends = signal<MLProductTrendsOut | null>(null);
  customerSegments = signal<MLCustomerSegmentsOut | null>(null);

  // Filtros locales
  filtroSoloCriticos = signal<boolean>(false);
  filtroTrend = signal<'todos' | 'creciendo' | 'estable' | 'cayendo'>('todos');

  // Chart state
  chartW = 900;
  chartH = 300;
  pad = { top: 25, right: 30, bottom: 35, left: 70 };
  hoveredPoint = signal<ChartPoint | null>(null);

  constructor(
    private mlService: DashboardMlService,
    public inventoryService: InventoryService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.inventoryService.loadLocations();
    this.recargarTodo();
  }

  async recargarTodo(): Promise<void> {
    this.errorMessage.set(null);
    this.loadingGeneral.set(true);

    await Promise.all([
      this.cargarForecast(),
      this.cargarStockout(),
      this.cargarTrends(),
      this.cargarSegments(),
    ]);

    this.loadingGeneral.set(false);
  }

  async cargarForecast(): Promise<void> {
    this.loadingForecast.set(true);
    try {
      const data = await this.mlService.getSalesForecast(this.selectedDays(), this.selectedBranchId());
      this.salesForecast.set(data);
    } catch (err: unknown) {
      const msg = parseDashboardMlError(err);
      this.errorMessage.set(msg);
      this.notificationService.error('Error al cargar pronóstico de ventas', msg);
    } finally {
      this.loadingForecast.set(false);
    }
  }

  async cargarStockout(): Promise<void> {
    this.loadingStockout.set(true);
    try {
      const data = await this.mlService.getStockoutRisk(this.selectedBranchId());
      this.stockoutRisk.set(data);
    } catch (err: unknown) {
      const msg = parseDashboardMlError(err);
      this.errorMessage.set(msg);
    } finally {
      this.loadingStockout.set(false);
    }
  }

  async cargarTrends(): Promise<void> {
    this.loadingTrends.set(true);
    try {
      const data = await this.mlService.getProductTrends();
      this.productTrends.set(data);
    } catch (err: unknown) {
      const msg = parseDashboardMlError(err);
      this.errorMessage.set(msg);
    } finally {
      this.loadingTrends.set(false);
    }
  }

  async cargarSegments(): Promise<void> {
    this.loadingSegments.set(true);
    try {
      const data = await this.mlService.getCustomerSegments();
      this.customerSegments.set(data);
    } catch (err: unknown) {
      const msg = parseDashboardMlError(err);
      this.errorMessage.set(msg);
    } finally {
      this.loadingSegments.set(false);
    }
  }

  onDaysChange(days: number): void {
    if (this.selectedDays() === days) return;
    this.selectedDays.set(days);
    this.cargarForecast();
  }

  onBranchChange(branchId: number | null): void {
    this.selectedBranchId.set(branchId);
    this.cargarForecast();
    this.cargarStockout();
  }

  // =========================================================================
  // CALCULOS Y ESCALADO DEL GRÁFICO SVG (S2)
  // =========================================================================

  salesPoints = computed<ChartPoint[]>(() => {
    const forecastData = this.salesForecast();
    if (!forecastData || forecastData.insufficient_data) return [];

    const history = forecastData.history || [];
    const forecast = forecastData.forecast || [];
    const totalPointsCount = history.length + forecast.length;
    if (totalPointsCount === 0) return [];

    // Encontrar rango Y (mínimo y máximo considerando también banda upper/lower)
    let minY = Infinity;
    let maxY = -Infinity;

    history.forEach(h => {
      if (h.amount < minY) minY = h.amount;
      if (h.amount > maxY) maxY = h.amount;
    });

    forecast.forEach(f => {
      const low = f.lower !== undefined ? f.lower : f.amount;
      const up = f.upper !== undefined ? f.upper : f.amount;
      if (low < minY) minY = low;
      if (up > maxY) maxY = up;
      if (f.amount < minY) minY = f.amount;
      if (f.amount > maxY) maxY = f.amount;
    });

    if (minY === Infinity) minY = 0;
    if (maxY === -Infinity) maxY = 100;
    if (minY > 0) minY = 0; // Baseline en 0 para visualización honesta
    if (maxY <= minY) maxY = minY + 100;

    // Margen superior de 10%
    maxY = maxY * 1.1;

    const plotW = this.chartW - this.pad.left - this.pad.right;
    const plotH = this.chartH - this.pad.top - this.pad.bottom;

    const result: ChartPoint[] = [];

    const getX = (idx: number) => {
      if (totalPointsCount <= 1) return this.pad.left + plotW / 2;
      return this.pad.left + (idx / (totalPointsCount - 1)) * plotW;
    };

    const getY = (val: number) => {
      const ratio = (val - minY) / (maxY - minY);
      return this.chartH - this.pad.bottom - ratio * plotH;
    };

    let idx = 0;
    history.forEach(h => {
      result.push({
        date: h.date,
        amount: h.amount,
        units: h.units,
        type: 'history',
        x: getX(idx),
        y: getY(h.amount),
      });
      idx++;
    });

    forecast.forEach(f => {
      result.push({
        date: f.date,
        amount: f.amount,
        lower: f.lower,
        upper: f.upper,
        type: 'forecast',
        x: getX(idx),
        y: getY(f.amount),
        yLower: f.lower !== undefined ? getY(f.lower) : undefined,
        yUpper: f.upper !== undefined ? getY(f.upper) : undefined,
      });
      idx++;
    });

    return result;
  });

  historyPath = computed<string>(() => {
    const pts = this.salesPoints().filter(p => p.type === 'history');
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  });

  forecastPath = computed<string>(() => {
    const pts = this.salesPoints().filter(p => p.type === 'forecast');
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  });

  connectingLineCoords = computed<{ x1: number; y1: number; x2: number; y2: number } | null>(() => {
    const pts = this.salesPoints();
    const lastHistory = [...pts].reverse().find(p => p.type === 'history');
    const firstForecast = pts.find(p => p.type === 'forecast');
    if (!lastHistory || !firstForecast) return null;
    return {
      x1: lastHistory.x,
      y1: lastHistory.y,
      x2: firstForecast.x,
      y2: firstForecast.y,
    };
  });

  forecastBandPath = computed<string>(() => {
    const pts = this.salesPoints().filter(p => p.type === 'forecast' && p.yLower !== undefined && p.yUpper !== undefined);
    if (pts.length === 0) return '';

    // Línea superior hacia la derecha, luego línea inferior hacia la izquierda, y cerrar
    const upperPart = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yUpper!.toFixed(1)}`).join(' ');
    const lowerPart = [...pts].reverse().map(p => `L ${p.x.toFixed(1)} ${p.yLower!.toFixed(1)}`).join(' ');

    return `${upperPart} ${lowerPart} Z`;
  });

  forecastUpperPath = computed<string>(() => {
    const pts = this.salesPoints().filter(p => p.type === 'forecast' && p.yUpper !== undefined);
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yUpper!.toFixed(1)}`).join(' ');
  });

  forecastLowerPath = computed<string>(() => {
    const pts = this.salesPoints().filter(p => p.type === 'forecast' && p.yLower !== undefined);
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yLower!.toFixed(1)}`).join(' ');
  });

  chartYTicks = computed<{ y: number; value: number }[]>(() => {
    const pts = this.salesPoints();
    if (pts.length === 0) return [];

    let maxY = 0;
    pts.forEach(p => {
      if (p.amount > maxY) maxY = p.amount;
      if (p.upper && p.upper > maxY) maxY = p.upper;
    });
    if (maxY === 0) maxY = 1000;
    maxY = maxY * 1.1;

    const ticksCount = 4;
    const ticks: { y: number; value: number }[] = [];
    const plotH = this.chartH - this.pad.top - this.pad.bottom;

    for (let i = 0; i <= ticksCount; i++) {
      const val = (maxY / ticksCount) * i;
      const y = this.chartH - this.pad.bottom - (i / ticksCount) * plotH;
      ticks.push({ y, value: val });
    }

    return ticks;
  });

  chartXTicks = computed<{ x: number; label: string }[]>(() => {
    const pts = this.salesPoints();
    if (pts.length === 0) return [];

    const ticksCount = Math.min(6, pts.length);
    const step = Math.floor(pts.length / (ticksCount - 1 || 1)) || 1;
    const ticks: { x: number; label: string }[] = [];

    for (let i = 0; i < pts.length; i += step) {
      ticks.push({
        x: pts[i].x,
        label: this.formatDateShort(pts[i].date),
      });
    }

    // Asegurar que el último punto esté presente
    const last = pts[pts.length - 1];
    if (ticks[ticks.length - 1]?.x !== last.x) {
      ticks.push({
        x: last.x,
        label: this.formatDateShort(last.date),
      });
    }

    return ticks;
  });

  onChartHover(event: MouseEvent, svg: SVGSVGElement): void {
    const pts = this.salesPoints();
    if (pts.length === 0) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * this.chartW;

    // Buscar el punto más cercano en X
    let closest: ChartPoint = pts[0];
    let minDist = Math.abs(pts[0].x - mouseX);

    for (let i = 1; i < pts.length; i++) {
      const dist = Math.abs(pts[i].x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = pts[i];
      }
    }

    this.hoveredPoint.set(closest);
  }

  onChartLeave(): void {
    this.hoveredPoint.set(null);
  }

  // =========================================================================
  // FILTRADO Y BADGES: QUIEBRE DE STOCK (S3)
  // =========================================================================

  filteredStockoutItems = computed<MLStockoutItem[]>(() => {
    const risk = this.stockoutRisk();
    if (!risk || risk.insufficient_data || !risk.items) return [];

    let list = risk.items;
    if (this.filtroSoloCriticos()) {
      list = list.filter(item => item.days_to_stockout < 7);
    }
    return list;
  });

  getStockoutBadgeClass(days: number): string {
    if (days < 7) {
      return 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold';
    }
    if (days <= 14) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }

  formatDays(days: number): string {
    if (days <= 0) return 'Agotado';
    if (days === 1) return '1 día restante';
    return `${days} días restantes`;
  }

  // =========================================================================
  // FILTRADO Y BADGES: TENDENCIA DE PRODUCTOS (S4)
  // =========================================================================

  filteredTrendItems = computed<MLProductTrendItem[]>(() => {
    const trends = this.productTrends();
    if (!trends || trends.insufficient_data || !trends.items) return [];

    const f = this.filtroTrend();
    if (f === 'todos') return trends.items;
    return trends.items.filter(item => item.trend === f);
  });

  getTrendBadgeClass(trend: MLProductTrend): string {
    switch (trend) {
      case 'creciendo':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cayendo':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'estable':
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  getTrendIcon(trend: MLProductTrend): string {
    switch (trend) {
      case 'creciendo':
        return 'trending_up';
      case 'cayendo':
        return 'trending_down';
      case 'estable':
      default:
        return 'trending_flat';
    }
  }

  getTrendLabel(trend: MLProductTrend): string {
    switch (trend) {
      case 'creciendo':
        return 'Creciendo';
      case 'cayendo':
        return 'Cayendo';
      case 'estable':
      default:
        return 'Estable';
    }
  }

  getSlopeColor(slope: number): string {
    if (slope > 0.05) return 'text-emerald-600';
    if (slope < -0.05) return 'text-rose-600';
    return 'text-gray-500';
  }

  // =========================================================================
  // BADGES: SEGMENTACIÓN DE CLIENTES (S5)
  // =========================================================================

  getSegmentBadgeClass(segmentKey: string): string {
    const key = (segmentKey || '').toLowerCase();
    if (key.includes('frecuente') || key.includes('vip') || key.includes('campeon')) {
      return 'bg-purple-100 text-[#38133E] border-purple-200';
    }
    if (key.includes('riesgo') || key.includes('dormido') || key.includes('perdido')) {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    if (key.includes('ocasional') || key.includes('promisorio') || key.includes('nuevo')) {
      return 'bg-blue-50 text-blue-800 border-blue-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  }

  getSegmentLabel(segmentKey: string): string {
    const seg = this.customerSegments()?.segments?.find(s => s.segment === segmentKey);
    return seg?.label || segmentKey;
  }

  // =========================================================================
  // HELPERS DE FORMATO (Sin regex inline en templates)
  // =========================================================================

  formatDateShort(dateStr: string): string {
    if (!dateStr) return '';
    // Expected ISO or YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  }

  formatDecimal(val: number | null | undefined): string {
    if (val === null || val === undefined) return '0.0';
    return val.toFixed(1);
  }

  formatNumberCompact(val: number | null | undefined): string {
    if (!val) return '0';
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1) + 'M';
    }
    if (val >= 1000) {
      return (val / 1000).toFixed(1) + 'k';
    }
    return Math.round(val).toLocaleString();
  }
}
