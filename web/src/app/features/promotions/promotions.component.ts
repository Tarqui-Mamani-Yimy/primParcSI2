import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromotionsService } from '../../core/services/promotions.service';
import { NotificationService } from '../../core/services/notification.service';
import { SyncService } from '../../core/services/sync.service';
import { Cupon, CuponIn, Promocion, PromocionIn } from '../../core/models';

type TabType = 'promotions' | 'coupons';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">

      <!-- Encabezado de la vista -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#E8E2DA]">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#38133E]">Marketing y Fidelización</span>
          <h1 class="text-2xl font-bold text-[#17141A] tracking-tight mt-0.5">Promociones y Cupones de Descuento</h1>
          <p class="text-xs text-[#5A5561] mt-1">
            Gestión centralizada de reglas de descuento automáticas y cupones promocionales con vigencia.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            *ngIf="activeTab() === 'promotions'"
            (click)="abrirModalPromocion()"
            [disabled]="!syncService.isOnline()"
            class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>Nueva Promoción</span>
          </button>

          <button
            *ngIf="activeTab() === 'coupons'"
            (click)="abrirModalCupon()"
            [disabled]="!syncService.isOnline()"
            class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>Nuevo Cupón</span>
          </button>
        </div>
      </div>

      <!-- Pestañas de Navegación -->
      <div class="flex items-center gap-2 border-b border-[#E8E2DA]">
        <button
          type="button"
          (click)="activeTab.set('promotions')"
          class="px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors cursor-pointer flex items-center gap-2"
          [ngClass]="{
            'border-[#38133E] text-[#38133E]': activeTab() === 'promotions',
            'border-transparent text-[#5A5561] hover:text-[#17141A]': activeTab() !== 'promotions'
          }"
        >
          <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
          <span>Promociones Automáticas ({{ promotions().length }})</span>
        </button>

        <button
          type="button"
          (click)="activeTab.set('coupons')"
          class="px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors cursor-pointer flex items-center gap-2"
          [ngClass]="{
            'border-[#38133E] text-[#38133E]': activeTab() === 'coupons',
            'border-transparent text-[#5A5561] hover:text-[#17141A]': activeTab() !== 'coupons'
          }"
        >
          <span class="material-symbols-outlined text-[18px]">sell</span>
          <span>Cupones de Descuento ({{ coupons().length }})</span>
        </button>
      </div>

      <!-- TAB 1: PROMOCIONES AUTOMÁTICAS -->
      <div *ngIf="activeTab() === 'promotions'" class="space-y-4">
        <div *ngIf="loadingPromotions()" class="py-12 text-center text-xs text-[#9B94A3]">
          Cargando promociones…
        </div>

        <div *ngIf="!loadingPromotions() && promotions().length === 0" class="py-12 text-center bg-white rounded-2xl border border-[#E8E2DA] p-8 text-xs text-[#5A5561]">
          No hay promociones registradas. Creá una promoción para activar descuentos automáticos en caja y catálogo.
        </div>

        <div *ngIf="!loadingPromotions() && promotions().length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            *ngFor="let p of promotions()"
            class="bg-white rounded-xl border border-[#E8E2DA] shadow-xs p-5 flex flex-col justify-between space-y-4"
          >
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  [ngClass]="p.activa ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'"
                >
                  {{ p.activa ? 'Activa' : 'Inactiva' }}
                </span>
                <span class="text-[10px] font-bold uppercase tracking-wider text-[#38133E]">
                  Alcance: {{ formatAlcance(p.alcance, p.alcance_ref) }}
                </span>
              </div>

              <h3 class="text-sm font-bold text-[#17141A] leading-snug">{{ p.nombre }}</h3>
              <p class="text-base font-extrabold text-[#38133E] mt-1">
                {{ formatTipoPromo(p) }}
              </p>

              <div class="mt-3 pt-3 border-t border-[#E8E2DA] text-[11px] text-[#5A5561] space-y-1">
                <p><strong>Vigencia:</strong> {{ formatearFecha(p.fecha_inicio) }} al {{ formatearFecha(p.fecha_fin) }}</p>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E2DA]">
              <button
                type="button"
                (click)="editarPromocion(p)"
                class="px-2.5 py-1 text-xs font-bold text-[#38133E] hover:bg-[#F5EBF7] rounded-md transition-colors cursor-pointer"
              >
                Editar
              </button>
              <button
                type="button"
                (click)="desactivarPromocion(p)"
                class="px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer"
                [ngClass]="p.activa ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'"
              >
                {{ p.activa ? 'Desactivar' : 'Activar' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: CUPONES DE DESCUENTO -->
      <div *ngIf="activeTab() === 'coupons'" class="space-y-4">
        <div *ngIf="loadingCoupons()" class="py-12 text-center text-xs text-[#9B94A3]">
          Cargando cupones…
        </div>

        <div *ngIf="!loadingCoupons() && coupons().length === 0" class="py-12 text-center bg-white rounded-2xl border border-[#E8E2DA] p-8 text-xs text-[#5A5561]">
          No hay cupones registrados. Creá códigos de descuento para tus clientes.
        </div>

        <div *ngIf="!loadingCoupons() && coupons().length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            *ngFor="let c of coupons()"
            class="bg-white rounded-xl border border-[#E8E2DA] shadow-xs p-5 flex flex-col justify-between space-y-4"
          >
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  [ngClass]="c.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'"
                >
                  {{ c.activo ? 'Activo' : 'Inactivo' }}
                </span>
                <span class="text-[10px] font-bold uppercase tracking-wider text-[#5A5561]">
                  {{ c.un_uso_por_cliente ? '1 uso por cliente' : 'Multi-uso' }}
                </span>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-[#9B94A3]">CÓDIGO:</span>
                <span class="px-2.5 py-1 bg-[#FAF8F5] border border-[#E8E2DA] rounded font-mono font-bold text-sm text-[#38133E] tracking-wider">
                  {{ c.codigo }}
                </span>
              </div>

              <p class="text-base font-extrabold text-[#17141A] mt-2">
                {{ c.tipo === 'porcentaje' ? c.valor + '% de descuento' : 'Bs ' + c.valor.toFixed(2) + ' de descuento' }}
              </p>

              <div class="mt-3 pt-3 border-t border-[#E8E2DA] text-[11px] text-[#5A5561] space-y-1">
                <p><strong>Mínimo de compra:</strong> {{ c.minimo_compra > 0 ? 'Bs ' + c.minimo_compra.toFixed(2) : 'Sin mínimo' }}</p>
                <p><strong>Vigencia:</strong> {{ formatearFecha(c.fecha_inicio) }} al {{ formatearFecha(c.fecha_fin) }}</p>
                <p *ngIf="c.usos_maximos"><strong>Usos máximos:</strong> {{ c.usos_maximos }}</p>
                <p *ngIf="c.idCliente"><strong>Asignado a:</strong> Cliente #{{ c.idCliente }}</p>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E2DA]">
              <button
                type="button"
                (click)="editarCupon(c)"
                class="px-2.5 py-1 text-xs font-bold text-[#38133E] hover:bg-[#F5EBF7] rounded-md transition-colors cursor-pointer"
              >
                Editar
              </button>
              <button
                type="button"
                (click)="desactivarCupon(c)"
                class="px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer"
                [ngClass]="c.activo ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'"
              >
                {{ c.activo ? 'Desactivar' : 'Activar' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL CREAR / EDITAR PROMOCIÓN -->
      <div *ngIf="mostrarModalPromo()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div class="bg-white max-w-lg w-full rounded-2xl border border-[#E8E2DA] shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between border-b border-[#E8E2DA] pb-3">
            <h3 class="text-base font-bold text-[#17141A]">
              {{ editandoPromoId() ? 'Editar Promoción' : 'Nueva Promoción Automática' }}
            </h3>
            <button (click)="cerrarModalPromo()" class="text-[#5A5561] hover:text-[#17141A]">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form (ngSubmit)="guardarPromocion()" class="space-y-4 text-xs">
            <div>
              <label class="block font-bold text-[#17141A] mb-1">Nombre de la promoción *</label>
              <input
                type="text"
                [(ngModel)]="promoForm.nombre"
                name="nombre"
                required
                class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg focus:outline-none focus:border-[#38133E]"
                placeholder="Ej. Liquidación de Temporada"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-[#17141A] mb-1">Tipo de descuento *</label>
                <select
                  [(ngModel)]="promoForm.tipo"
                  name="tipo"
                  required
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg bg-white"
                >
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="monto_fijo">Monto Fijo por Unidad (Bs)</option>
                  <option value="nxm">Lleva N Paga M (NxM)</option>
                </select>
              </div>

              <div *ngIf="promoForm.tipo !== 'nxm'">
                <label class="block font-bold text-[#17141A] mb-1">
                  {{ promoForm.tipo === 'porcentaje' ? 'Porcentaje de descuento (%) *' : 'Monto de descuento (Bs) *' }}
                </label>
                <input
                  type="number"
                  [(ngModel)]="promoForm.valor"
                  name="valor"
                  step="0.01"
                  min="0.01"
                  required
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg focus:outline-none"
                  placeholder="Ej. 20"
                />
              </div>

              <div *ngIf="promoForm.tipo === 'nxm'" class="flex gap-2">
                <div class="flex-1">
                  <label class="block font-bold text-[#17141A] mb-1">Lleva (N) *</label>
                  <input
                    type="number"
                    [(ngModel)]="promoForm.n"
                    name="n"
                    min="2"
                    required
                    class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg"
                    placeholder="2"
                  />
                </div>
                <div class="flex-1">
                  <label class="block font-bold text-[#17141A] mb-1">Paga (M) *</label>
                  <input
                    type="number"
                    [(ngModel)]="promoForm.m"
                    name="m"
                    min="1"
                    required
                    class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg"
                    placeholder="1"
                  />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-[#17141A] mb-1">Alcance *</label>
                <select
                  [(ngModel)]="promoForm.alcance"
                  name="alcance"
                  required
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg bg-white"
                >
                  <option value="todos">Todos los productos</option>
                  <option value="producto">Producto específico</option>
                  <option value="coleccion">Por colección</option>
                  <option value="temporada">Por temporada</option>
                  <option value="tipo">Por tipo de prenda</option>
                </select>
              </div>

              <div *ngIf="promoForm.alcance !== 'todos'">
                <label class="block font-bold text-[#17141A] mb-1">Referencia del alcance *</label>
                <input
                  type="text"
                  [(ngModel)]="promoForm.alcance_ref"
                  name="alcance_ref"
                  required
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg"
                  placeholder="ID o nombre del tipo/colección"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-[#17141A] mb-1">Fecha de inicio *</label>
                <input
                  type="date"
                  [(ngModel)]="fechaInicioPromo"
                  name="fecha_inicio"
                  required
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg bg-white"
                />
              </div>

              <div>
                <label class="block font-bold text-[#17141A] mb-1">Fecha de fin *</label>
                <input
                  type="date"
                  [(ngModel)]="fechaFinPromo"
                  name="fecha_fin"
                  required
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg bg-white"
                />
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="promoActiva"
                [(ngModel)]="promoForm.activa"
                name="activa"
                class="rounded border-[#E8E2DA] text-[#38133E] focus:ring-[#38133E]"
              />
              <label for="promoActiva" class="font-bold text-[#17141A] cursor-pointer">Promoción activa</label>
            </div>

            <div class="flex items-center justify-end gap-2 pt-4 border-t border-[#E8E2DA]">
              <button
                type="button"
                (click)="cerrarModalPromo()"
                class="px-4 py-2 border border-[#E8E2DA] rounded-lg font-bold text-[#5A5561] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="guardando()"
                class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg font-bold uppercase tracking-wide cursor-pointer disabled:opacity-50"
              >
                {{ guardando() ? 'Guardando…' : 'Guardar Promoción' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- MODAL CREAR / EDITAR CUPÓN -->
      <div *ngIf="mostrarModalCupon()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div class="bg-white max-w-lg w-full rounded-2xl border border-[#E8E2DA] shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between border-b border-[#E8E2DA] pb-3">
            <h3 class="text-base font-bold text-[#17141A]">
              {{ editandoCuponId() ? 'Editar Cupón' : 'Nuevo Cupón de Descuento' }}
            </h3>
            <button (click)="cerrarModalCupon()" class="text-[#5A5561] hover:text-[#17141A]">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form (ngSubmit)="guardarCupon()" class="space-y-4 text-xs">
            <div>
              <label class="block font-bold text-[#17141A] mb-1">Código del cupón (letras mayúsculas) *</label>
              <input
                type="text"
                [(ngModel)]="cuponForm.codigo"
                name="codigo"
                (ngModelChange)="onCodigoChange($event)"
                required
                class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg font-mono font-bold uppercase focus:outline-none focus:border-[#38133E]"
                placeholder="EJ. BIENVENIDA10"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-[#17141A] mb-1">Tipo de descuento *</label>
                <select
                  [(ngModel)]="cuponForm.tipo"
                  name="tipo"
                  required
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg bg-white"
                >
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="monto_fijo">Monto Fijo (Bs)</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-[#17141A] mb-1">
                  {{ cuponForm.tipo === 'porcentaje' ? 'Valor en porcentaje (%) *' : 'Valor en bolivianos (Bs) *' }}
                </label>
                <input
                  type="number"
                  [(ngModel)]="cuponForm.valor"
                  name="valor"
                  step="0.01"
                  min="0.01"
                  required
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg"
                  placeholder="Ej. 15"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-[#17141A] mb-1">Mínimo de compra (Bs)</label>
                <input
                  type="number"
                  [(ngModel)]="cuponForm.minimo_compra"
                  name="minimo_compra"
                  step="0.01"
                  min="0"
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg"
                  placeholder="0 (Sin mínimo)"
                />
              </div>

              <div>
                <label class="block font-bold text-[#17141A] mb-1">Límite de usos totales (opcional)</label>
                <input
                  type="number"
                  [(ngModel)]="cuponForm.usos_maximos"
                  name="usos_maximos"
                  min="1"
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg"
                  placeholder="Ilimitado si está vacío"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-[#17141A] mb-1">Fecha de inicio *</label>
                <input
                  type="date"
                  [(ngModel)]="fechaInicioCupon"
                  name="fecha_inicio"
                  required
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg bg-white"
                />
              </div>

              <div>
                <label class="block font-bold text-[#17141A] mb-1">Fecha de fin *</label>
                <input
                  type="date"
                  [(ngModel)]="fechaFinCupon"
                  name="fecha_fin"
                  required
                  class="w-full px-3 py-2 border border-[#E8E2DA] rounded-lg bg-white"
                />
              </div>
            </div>

            <div class="flex flex-col gap-2 pt-2">
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cuponUnUso"
                  [(ngModel)]="cuponForm.un_uso_por_cliente"
                  name="un_uso_por_cliente"
                  class="rounded border-[#E8E2DA] text-[#38133E] focus:ring-[#38133E]"
                />
                <label for="cuponUnUso" class="font-bold text-[#17141A] cursor-pointer">
                  Un solo uso por cliente
                </label>
              </div>

              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cuponActivo"
                  [(ngModel)]="cuponForm.activo"
                  name="activo"
                  class="rounded border-[#E8E2DA] text-[#38133E] focus:ring-[#38133E]"
                />
                <label for="cuponActivo" class="font-bold text-[#17141A] cursor-pointer">
                  Cupón activo
                </label>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-4 border-t border-[#E8E2DA]">
              <button
                type="button"
                (click)="cerrarModalCupon()"
                class="px-4 py-2 border border-[#E8E2DA] rounded-lg font-bold text-[#5A5561] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="guardando()"
                class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg font-bold uppercase tracking-wide cursor-pointer disabled:opacity-50"
              >
                {{ guardando() ? 'Guardando…' : 'Guardar Cupón' }}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `
})
export class PromotionsComponent implements OnInit {
  activeTab = signal<TabType>('promotions');

  promotions = signal<Promocion[]>([]);
  coupons = signal<Cupon[]>([]);

  loadingPromotions = signal(false);
  loadingCoupons = signal(false);
  guardando = signal(false);

  mostrarModalPromo = signal(false);
  editandoPromoId = signal<number | null>(null);

  mostrarModalCupon = signal(false);
  editandoCuponId = signal<number | null>(null);

  fechaInicioPromo = '';
  fechaFinPromo = '';

  fechaInicioCupon = '';
  fechaFinCupon = '';

  promoForm: PromocionIn = {
    nombre: '',
    tipo: 'porcentaje',
    valor: 10,
    n: null,
    m: null,
    alcance: 'todos',
    alcance_ref: null,
    fecha_inicio: '',
    fecha_fin: '',
    activa: true,
  };

  cuponForm: CuponIn = {
    codigo: '',
    tipo: 'porcentaje',
    valor: 10,
    minimo_compra: 0,
    fecha_inicio: '',
    fecha_fin: '',
    usos_maximos: null,
    un_uso_por_cliente: true,
    idCliente: null,
    activo: true,
  };

  constructor(
    private promotionsService: PromotionsService,
    private notificationService: NotificationService,
    public syncService: SyncService,
  ) {}

  ngOnInit(): void {
    void this.cargarPromociones();
    void this.cargarCupones();
  }

  async cargarPromociones(): Promise<void> {
    this.loadingPromotions.set(true);
    try {
      const list = await this.promotionsService.getPromotions();
      this.promotions.set(list);
    } catch {
      this.promotions.set([]);
    } finally {
      this.loadingPromotions.set(false);
    }
  }

  async cargarCupones(): Promise<void> {
    this.loadingCoupons.set(true);
    try {
      const list = await this.promotionsService.getCoupons();
      this.coupons.set(list);
    } catch {
      this.coupons.set([]);
    } finally {
      this.loadingCoupons.set(false);
    }
  }

  abrirModalPromocion(): void {
    this.editandoPromoId.set(null);
    const hoy = new Date().toISOString().substring(0, 10);
    const fin = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);
    this.fechaInicioPromo = hoy;
    this.fechaFinPromo = fin;
    this.promoForm = {
      nombre: '',
      tipo: 'porcentaje',
      valor: 10,
      n: null,
      m: null,
      alcance: 'todos',
      alcance_ref: null,
      fecha_inicio: hoy,
      fecha_fin: fin,
      activa: true,
    };
    this.mostrarModalPromo.set(true);
  }

  editarPromocion(p: Promocion): void {
    this.editandoPromoId.set(p.idPromocion);
    this.fechaInicioPromo = p.fecha_inicio.substring(0, 10);
    this.fechaFinPromo = p.fecha_fin.substring(0, 10);
    this.promoForm = {
      nombre: p.nombre,
      tipo: p.tipo,
      valor: p.valor,
      n: p.n,
      m: p.m,
      alcance: p.alcance,
      alcance_ref: p.alcance_ref,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin,
      activa: p.activa,
    };
    this.mostrarModalPromo.set(true);
  }

  cerrarModalPromo(): void {
    this.mostrarModalPromo.set(false);
    this.editandoPromoId.set(null);
  }

  async guardarPromocion(): Promise<void> {
    this.guardando.set(true);
    this.promoForm.fecha_inicio = new Date(this.fechaInicioPromo).toISOString();
    this.promoForm.fecha_fin = new Date(this.fechaFinPromo + 'T23:59:59').toISOString();

    try {
      const id = this.editandoPromoId();
      if (id) {
        await this.promotionsService.updatePromotion(id, this.promoForm);
        this.notificationService.success('Promoción Actualizada', 'Los cambios fueron guardados exitosamente.');
      } else {
        await this.promotionsService.createPromotion(this.promoForm);
        this.notificationService.success('Promoción Creada', 'La nueva promoción fue creada correctamente.');
      }
      this.cerrarModalPromo();
      await this.cargarPromociones();
      await this.promotionsService.getActivePromotions();
    } catch (err: any) {
      const msg = err.error?.detail || 'No se pudo guardar la promoción.';
      this.notificationService.error('Error al guardar', msg);
    } finally {
      this.guardando.set(false);
    }
  }

  async desactivarPromocion(p: Promocion): Promise<void> {
    try {
      if (p.activa) {
        await this.promotionsService.deletePromotion(p.idPromocion);
        this.notificationService.info('Promoción Desactivada', `La promoción "${p.nombre}" ha sido desactivada.`);
      } else {
        await this.promotionsService.updatePromotion(p.idPromocion, { activa: true });
        this.notificationService.success('Promoción Activada', `La promoción "${p.nombre}" ha sido activada.`);
      }
      await this.cargarPromociones();
      await this.promotionsService.getActivePromotions();
    } catch (err: any) {
      const msg = err.error?.detail || 'No se pudo cambiar el estado de la promoción.';
      this.notificationService.error('Error', msg);
    }
  }

  abrirModalCupon(): void {
    this.editandoCuponId.set(null);
    const hoy = new Date().toISOString().substring(0, 10);
    const fin = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);
    this.fechaInicioCupon = hoy;
    this.fechaFinCupon = fin;
    this.cuponForm = {
      codigo: '',
      tipo: 'porcentaje',
      valor: 10,
      minimo_compra: 0,
      fecha_inicio: hoy,
      fecha_fin: fin,
      usos_maximos: null,
      un_uso_por_cliente: true,
      idCliente: null,
      activo: true,
    };
    this.mostrarModalCupon.set(true);
  }

  editarCupon(c: Cupon): void {
    this.editandoCuponId.set(c.idCupon);
    this.fechaInicioCupon = c.fecha_inicio.substring(0, 10);
    this.fechaFinCupon = c.fecha_fin.substring(0, 10);
    this.cuponForm = {
      codigo: c.codigo,
      tipo: c.tipo,
      valor: c.valor,
      minimo_compra: c.minimo_compra,
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin,
      usos_maximos: c.usos_maximos,
      un_uso_por_cliente: c.un_uso_por_cliente,
      idCliente: c.idCliente,
      activo: c.activo,
    };
    this.mostrarModalCupon.set(true);
  }

  cerrarModalCupon(): void {
    this.mostrarModalCupon.set(false);
    this.editandoCuponId.set(null);
  }

  onCodigoChange(val: string): void {
    this.cuponForm.codigo = val.toUpperCase().trim();
  }

  async guardarCupon(): Promise<void> {
    this.guardando.set(true);
    this.cuponForm.fecha_inicio = new Date(this.fechaInicioCupon).toISOString();
    this.cuponForm.fecha_fin = new Date(this.fechaFinCupon + 'T23:59:59').toISOString();
    this.cuponForm.codigo = this.cuponForm.codigo.toUpperCase().trim();

    try {
      const id = this.editandoCuponId();
      if (id) {
        await this.promotionsService.updateCoupon(id, this.cuponForm);
        this.notificationService.success('Cupón Actualizado', 'Los cambios fueron guardados exitosamente.');
      } else {
        await this.promotionsService.createCoupon(this.cuponForm);
        this.notificationService.success('Cupón Creado', 'El cupón fue creado correctamente.');
      }
      this.cerrarModalCupon();
      await this.cargarCupones();
    } catch (err: any) {
      const msg = err.error?.detail || 'No se pudo guardar el cupón.';
      this.notificationService.error('Error al guardar', msg);
    } finally {
      this.guardando.set(false);
    }
  }

  async desactivarCupon(c: Cupon): Promise<void> {
    try {
      if (c.activo) {
        await this.promotionsService.deleteCoupon(c.idCupon);
        this.notificationService.info('Cupón Desactivado', `El cupón "${c.codigo}" ha sido desactivado.`);
      } else {
        await this.promotionsService.updateCoupon(c.idCupon, { activo: true });
        this.notificationService.success('Cupón Activado', `El cupón "${c.codigo}" ha sido activado.`);
      }
      await this.cargarCupones();
    } catch (err: any) {
      const msg = err.error?.detail || 'No se pudo cambiar el estado del cupón.';
      this.notificationService.error('Error', msg);
    }
  }

  formatTipoPromo(p: Promocion): string {
    if (p.tipo === 'porcentaje') {
      return `${p.valor}% de descuento`;
    }
    if (p.tipo === 'monto_fijo') {
      return `Bs ${p.valor?.toFixed(2)} por unidad`;
    }
    if (p.tipo === 'nxm') {
      return `Lleva ${p.n} y paga ${p.m} (${p.n}x${p.m})`;
    }
    return '';
  }

  formatAlcance(alcance: string, ref: string | null): string {
    switch (alcance) {
      case 'todos': return 'Todo el catálogo';
      case 'producto': return `Producto #${ref || '—'}`;
      case 'coleccion': return `Colección #${ref || '—'}`;
      case 'temporada': return `Temporada #${ref || '—'}`;
      case 'tipo': return `Tipo: ${ref || '—'}`;
      default: return alcance;
    }
  }

  formatearFecha(f: string): string {
    if (!f) return '';
    try {
      return new Date(f).toLocaleDateString('es-BO', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return f;
    }
  }
}
