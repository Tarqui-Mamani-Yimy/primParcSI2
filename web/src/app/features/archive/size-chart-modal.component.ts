import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { ProductOut, MedidaTalla, SizeChartResponse, FitFeedbackSummaryItem } from '../../core/models';
import { SizeChartService } from '../../core/services/size-chart.service';
import { NotificationService } from '../../core/services/notification.service';
import { SyncService } from '../../core/services/sync.service';

export interface EditableRow {
  talla: string;
  pecho: number | string | null;
  largo: number | string | null;
  hombros: number | string | null;
  manga: number | string | null;
  cintura: number | string | null;
  cadera: number | string | null;
}

@Component({
  selector: 'app-size-chart-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#17141A]/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-4xl w-full rounded-2xl border border-gray-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col relative">

        <!-- Encabezado del modal -->
        <div class="p-5 md:p-6 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[11px] font-bold uppercase tracking-wider text-[#38133E]">
                Catálogo • Tabla de Medidas
              </span>
              <span
                *ngIf="fuente() === 'generica'"
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Tabla genérica (respaldo)
              </span>
              <span
                *ngIf="fuente() === 'propia'"
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Tabla propia
              </span>
            </div>

            <h2 class="text-lg md:text-xl font-bold text-gray-900 mt-1 leading-snug">
              {{ product.nombre }}
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">
              ID {{ product.idProducto }} • Tipo: {{ product.tipo || 'Sin tipo' }} • Talla actual: {{ product.talla || '—' }} • Color: {{ product.color || '—' }}
            </p>
          </div>

          <button
            (click)="close.emit()"
            [disabled]="saving()"
            class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-900 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <!-- Contenido principal -->
        <div class="overflow-y-auto p-5 md:p-6 space-y-4 flex-1">
          <p class="text-xs text-gray-600">
            Registre las medidas reales en centímetros (cm) de cada talla para esta prenda. Deje en blanco las medidas que no apliquen al tipo de prenda.
          </p>

          <!-- Resumen de retroalimentación de clientes (CU36 / S8) -->
          <div *ngIf="feedbackSummary() as fb" class="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[18px] text-[#38133E]">reviews</span>
                <span class="text-xs font-bold text-gray-900">Opiniones de ajuste de clientes (CU36)</span>
              </div>
              <span class="text-[11px] font-semibold text-gray-500">
                {{ fb.total }} {{ fb.total === 1 ? 'opinión registrada' : 'opiniones registradas' }}
              </span>
            </div>

            <!-- Alerta destacada si alerta = true -->
            <div *ngIf="fb.alerta" class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <span class="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">warning</span>
              <div>
                <p class="font-bold">Alerta de ajuste detectada</p>
                <p class="mt-0.5 leading-relaxed">
                  Al menos el 60% de los clientes indica que la prenda queda pequeña o grande. Considere calibrar las medidas reales en centímetros de esta tabla.
                </p>
              </div>
            </div>

            <!-- Desglose de opiniones -->
            <div *ngIf="fb.total > 0" class="grid grid-cols-3 gap-2 text-center">
              <div class="p-2.5 bg-white border border-gray-200 rounded-lg">
                <p class="text-[10px] font-bold uppercase tracking-wider text-amber-700">Quedó pequeña</p>
                <p class="text-base font-extrabold text-gray-900 mt-0.5">{{ fb.pequena }}</p>
                <p class="text-[10px] text-gray-400 mt-0.5">{{ calcPorcentaje(fb.pequena, fb.total) }}%</p>
              </div>

              <div class="p-2.5 bg-white border border-gray-200 rounded-lg">
                <p class="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Quedó bien</p>
                <p class="text-base font-extrabold text-gray-900 mt-0.5">{{ fb.bien }}</p>
                <p class="text-[10px] text-gray-400 mt-0.5">{{ calcPorcentaje(fb.bien, fb.total) }}%</p>
              </div>

              <div class="p-2.5 bg-white border border-gray-200 rounded-lg">
                <p class="text-[10px] font-bold uppercase tracking-wider text-blue-700">Quedó grande</p>
                <p class="text-base font-extrabold text-gray-900 mt-0.5">{{ fb.grande }}</p>
                <p class="text-[10px] text-gray-400 mt-0.5">{{ calcPorcentaje(fb.grande, fb.total) }}%</p>
              </div>
            </div>

            <div *ngIf="fb.total === 0" class="text-xs text-gray-400 italic">
              Este producto aún no cuenta con opiniones de compra de clientes.
            </div>
          </div>

          <!-- Alerta de mensaje de error -->
          <div *ngIf="errorMessage()" class="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
            <span class="material-symbols-outlined text-[18px] text-red-500 shrink-0">error</span>
            <div class="flex-1 leading-relaxed">
              <span>{{ errorMessage() }}</span>
            </div>
            <button
              *ngIf="loadFailed()"
              (click)="loadSizeChart()"
              class="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-[11px] font-bold cursor-pointer transition-colors"
            >
              Reintentar
            </button>
          </div>

          <!-- Alerta de éxito -->
          <div *ngIf="successMessage()" class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check_circle</span>
            <span>{{ successMessage() }}</span>
          </div>

          <!-- Alerta de confirmación para restablecer a genérica -->
          <div *ngIf="showResetConfirm()" class="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-2">
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined text-[20px] text-amber-600 shrink-0">warning</span>
              <div>
                <p class="font-bold">¿Desea restablecer la tabla a la versión genérica?</p>
                <p class="mt-0.5 text-amber-800">
                  Esta acción eliminará la tabla propia de este producto y volverá a utilizar las medidas genéricas estándar de respaldo.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 pt-1 justify-end">
              <button
                type="button"
                (click)="showResetConfirm.set(false)"
                [disabled]="saving()"
                class="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="resetToGeneric()"
                [disabled]="saving()"
                class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1"
              >
                <span *ngIf="saving()" class="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                <span>Confirmar y restablecer</span>
              </button>
            </div>
          </div>

          <!-- Estado de carga inicial -->
          <div *ngIf="loading()" class="py-16 text-center space-y-3">
            <span class="material-symbols-outlined animate-spin text-[32px] text-[#38133E]">progress_activity</span>
            <p class="text-xs text-gray-500 font-medium">Cargando tabla de medidas...</p>
          </div>

          <!-- Tabla de medidas editable -->
          <div *ngIf="!loading()" class="space-y-3">
            <div class="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[680px]">
                  <thead>
                    <tr class="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                      <th class="py-2.5 px-3 w-28">Talla</th>
                      <th class="py-2.5 px-3 text-center">Pecho (cm)</th>
                      <th class="py-2.5 px-3 text-center">Largo (cm)</th>
                      <th class="py-2.5 px-3 text-center">Hombros (cm)</th>
                      <th class="py-2.5 px-3 text-center">Manga (cm)</th>
                      <th class="py-2.5 px-3 text-center">Cintura (cm)</th>
                      <th class="py-2.5 px-3 text-center">Cadera (cm)</th>
                      <th class="py-2.5 px-3 text-center w-14">Acción</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr *ngFor="let row of rows; let i = index" class="hover:bg-gray-50/70 transition-colors">
                      <!-- Talla -->
                      <td class="py-2 px-3">
                        <input
                          type="text"
                          [(ngModel)]="row.talla"
                          (blur)="normalizeTalla(row)"
                          placeholder="ej. M"
                          class="w-full uppercase font-bold text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#38133E]"
                        />
                      </td>
                      <!-- Pecho -->
                      <td class="py-2 px-2 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="300"
                          [(ngModel)]="row.pecho"
                          placeholder="—"
                          class="w-full text-center text-xs py-1.5 px-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#38133E]"
                        />
                      </td>
                      <!-- Largo -->
                      <td class="py-2 px-2 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="300"
                          [(ngModel)]="row.largo"
                          placeholder="—"
                          class="w-full text-center text-xs py-1.5 px-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#38133E]"
                        />
                      </td>
                      <!-- Hombros -->
                      <td class="py-2 px-2 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="300"
                          [(ngModel)]="row.hombros"
                          placeholder="—"
                          class="w-full text-center text-xs py-1.5 px-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#38133E]"
                        />
                      </td>
                      <!-- Manga -->
                      <td class="py-2 px-2 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="300"
                          [(ngModel)]="row.manga"
                          placeholder="—"
                          class="w-full text-center text-xs py-1.5 px-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#38133E]"
                        />
                      </td>
                      <!-- Cintura -->
                      <td class="py-2 px-2 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="300"
                          [(ngModel)]="row.cintura"
                          placeholder="—"
                          class="w-full text-center text-xs py-1.5 px-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#38133E]"
                        />
                      </td>
                      <!-- Cadera -->
                      <td class="py-2 px-2 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="300"
                          [(ngModel)]="row.cadera"
                          placeholder="—"
                          class="w-full text-center text-xs py-1.5 px-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#38133E]"
                        />
                      </td>
                      <!-- Botón Eliminar fila -->
                      <td class="py-2 px-2 text-center">
                        <button
                          type="button"
                          (click)="removeRow(i)"
                          title="Eliminar fila"
                          class="w-7 h-7 inline-flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div *ngIf="rows.length === 0" class="py-8 text-center text-xs text-gray-400">
                No hay tallas en la tabla. Use el botón "Agregar talla" o "Restablecer a genérica".
              </div>
            </div>

            <!-- Botón agregar fila -->
            <div class="flex items-center justify-between">
              <button
                type="button"
                (click)="addRow()"
                [disabled]="saving()"
                class="px-3.5 py-1.5 border border-dashed border-gray-300 hover:border-[#38133E] text-[#38133E] rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 hover:bg-[#F5EBF7]"
              >
                <span class="material-symbols-outlined text-[16px]">add</span>
                <span>Agregar talla</span>
              </button>
              <span class="text-[11px] text-gray-400">
                {{ rows.length }} {{ rows.length === 1 ? 'talla' : 'tallas' }} en lista
              </span>
            </div>
          </div>
        </div>

        <!-- Pie de acción del modal -->
        <div class="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              (click)="promptResetToGeneric()"
              [disabled]="saving() || loading() || !syncService.isOnline()"
              [title]="!syncService.isOnline() ? 'Operación no disponible sin conexión a internet' : ''"
              class="px-3 py-2 border border-gray-300 hover:border-amber-600 text-gray-700 hover:text-amber-800 hover:bg-amber-50 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span class="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Restablecer a genérica</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="close.emit()"
              [disabled]="saving()"
              class="px-4 py-2 border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer disabled:opacity-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              (click)="save()"
              [disabled]="saving() || loading() || !syncService.isOnline()"
              [title]="!syncService.isOnline() ? 'Operación no disponible sin conexión a internet' : ''"
              class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <span *ngIf="saving()" class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
              <span>{{ saving() ? 'Guardando...' : 'Guardar' }}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `
})
export class SizeChartModalComponent implements OnInit {
  @Input({ required: true }) product!: ProductOut;
  @Output() close = new EventEmitter<void>();

  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  loadFailed = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  showResetConfirm = signal<boolean>(false);
  fuente = signal<'propia' | 'generica'>('generica');
  feedbackSummary = signal<FitFeedbackSummaryItem | null>(null);

  rows: EditableRow[] = [];

  constructor(
    private sizeChartService: SizeChartService,
    private notificationService: NotificationService,
    public syncService: SyncService
  ) {}

  ngOnInit(): void {
    this.loadSizeChart();
    void this.loadFeedbackSummary();
  }

  calcPorcentaje(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  async loadFeedbackSummary(): Promise<void> {
    try {
      const list = await this.sizeChartService.getFitFeedbackSummary();
      const match = list.find((s) => s.idProducto === this.product.idProducto);
      if (match) {
        this.feedbackSummary.set(match);
      } else {
        this.feedbackSummary.set({
          idProducto: this.product.idProducto,
          nombre: this.product.nombre,
          talla: this.product.talla || '',
          total: 0,
          pequena: 0,
          bien: 0,
          grande: 0,
          alerta: false,
        });
      }
    } catch {
      this.feedbackSummary.set(null);
    }
  }

  async loadSizeChart(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const res = await this.sizeChartService.getSizeChart(this.product.idProducto);
      this.fuente.set(res.fuente);
      this.rows = (res.tallas || []).map((t) => ({
        talla: t.talla,
        pecho: t.pecho,
        largo: t.largo,
        hombros: t.hombros,
        manga: t.manga,
        cintura: t.cintura,
        cadera: t.cadera,
      }));
    } catch (err: any) {
      this.loadFailed.set(true);
      const msg = err.error?.detail || 'No se pudo cargar la tabla de medidas del producto.';
      this.errorMessage.set(typeof msg === 'string' ? msg : 'Error al cargar la tabla de medidas.');
    } finally {
      this.loading.set(false);
    }
  }

  normalizeTalla(row: EditableRow): void {
    if (row.talla) {
      row.talla = row.talla.trim().toUpperCase();
    }
  }

  addRow(): void {
    this.errorMessage.set(null);
    this.rows.push({
      talla: '',
      pecho: null,
      largo: null,
      hombros: null,
      manga: null,
      cintura: null,
      cadera: null,
    });
  }

  removeRow(index: number): void {
    this.errorMessage.set(null);
    this.rows.splice(index, 1);
  }

  promptResetToGeneric(): void {
    this.errorMessage.set(null);
    this.showResetConfirm.set(true);
  }

  async resetToGeneric(): Promise<void> {
    this.showResetConfirm.set(false);
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const res = await this.sizeChartService.updateSizeChart(this.product.idProducto, { tallas: [] });
      this.fuente.set(res.fuente);
      this.rows = (res.tallas || []).map((t) => ({
        talla: t.talla,
        pecho: t.pecho,
        largo: t.largo,
        hombros: t.hombros,
        manga: t.manga,
        cintura: t.cintura,
        cadera: t.cadera,
      }));
      this.successMessage.set('Se restableció la tabla de medidas a la versión genérica de respaldo.');
      this.notificationService.info('Tabla de medidas', 'Restablecida a la versión genérica de respaldo.');
    } catch (err: any) {
      const detail = err.error?.detail;
      const msg = typeof detail === 'string' ? detail : 'No se pudo restablecer la tabla a la versión genérica.';
      this.errorMessage.set(msg);
      this.notificationService.error('Error', msg);
    } finally {
      this.saving.set(false);
    }
  }

  async save(): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.rows.length === 0) {
      this.errorMessage.set('La tabla no tiene tallas. Para volver a la tabla genérica de respaldo, use "Restablecer a genérica".');
      return;
    }

    const tallasVistas = new Set<string>();
    const payloadTallas: MedidaTalla[] = [];

    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i];
      const tallaTrim = (r.talla || '').trim().toUpperCase();
      const filaNum = i + 1;

      if (!tallaTrim) {
        this.errorMessage.set(`Fila ${filaNum}: La talla no puede estar vacía.`);
        return;
      }

      if (tallasVistas.has(tallaTrim)) {
        this.errorMessage.set(`Fila ${filaNum}: La talla "${tallaTrim}" está duplicada. Cada talla debe ser única.`);
        return;
      }
      tallasVistas.add(tallaTrim);

      const parseMedida = (val: number | string | null | undefined, nombreCampo: string): number | null => {
        if (val === null || val === undefined || val === '') return null;
        const num = Number(val);
        if (isNaN(num)) {
          throw new Error(`Fila ${filaNum} (${tallaTrim}): El valor de ${nombreCampo} no es un número válido.`);
        }
        if (num < 1 || num > 300) {
          throw new Error(`Fila ${filaNum} (${tallaTrim}): La medida de ${nombreCampo} debe estar entre 1 y 300 cm.`);
        }
        return Math.round(num * 10) / 10;
      };

      let pecho: number | null = null;
      let largo: number | null = null;
      let hombros: number | null = null;
      let manga: number | null = null;
      let cintura: number | null = null;
      let cadera: number | null = null;

      try {
        pecho = parseMedida(r.pecho, 'pecho');
        largo = parseMedida(r.largo, 'largo');
        hombros = parseMedida(r.hombros, 'hombros');
        manga = parseMedida(r.manga, 'manga');
        cintura = parseMedida(r.cintura, 'cintura');
        cadera = parseMedida(r.cadera, 'cadera');
      } catch (valErr: any) {
        this.errorMessage.set(valErr.message);
        return;
      }

      const tieneMedida = [pecho, largo, hombros, manga, cintura, cadera].some((m) => m !== null);
      if (!tieneMedida) {
        this.errorMessage.set(`Fila ${filaNum} (${tallaTrim}): Debe ingresar al menos una medida (pecho, largo, hombros, manga, cintura o cadera).`);
        return;
      }

      payloadTallas.push({
        talla: tallaTrim,
        pecho,
        largo,
        hombros,
        manga,
        cintura,
        cadera,
      });
    }

    this.saving.set(true);
    try {
      const res = await this.sizeChartService.updateSizeChart(this.product.idProducto, { tallas: payloadTallas });
      this.fuente.set(res.fuente);
      this.rows = (res.tallas || []).map((t) => ({
        talla: t.talla,
        pecho: t.pecho,
        largo: t.largo,
        hombros: t.hombros,
        manga: t.manga,
        cintura: t.cintura,
        cadera: t.cadera,
      }));
      this.successMessage.set('Tabla de medidas guardada con éxito.');
      this.notificationService.success('Tabla de medidas', 'Guardada con éxito.');
    } catch (err: any) {
      const detail = err.error?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : (Array.isArray(detail) ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ') : 'No se pudo guardar la tabla de medidas.');
      this.errorMessage.set(msg);
      this.notificationService.error('Error', msg);
    } finally {
      this.saving.set(false);
    }
  }
}
