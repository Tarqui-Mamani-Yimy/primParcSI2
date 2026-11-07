import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProductOut, SizeRecommendationOut } from '../../../core/models';
import { OfflineDbService } from '../../../core/services/offline-db.service';
import { SyncService } from '../../../core/services/sync.service';
import { SizeChartService } from '../../../core/services/size-chart.service';
import { environment } from '../../../../environments/environment';
import { CANTIDAD_MAXIMA_LINEA } from '../../../core/services/cart.service';
import { classifyProductDetailError, ProductDetailError } from './product-detail-error';

const API_URL = environment.apiUrl;

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-3xl w-full rounded-2xl border border-[#E8E2DA] shadow-xl overflow-hidden max-h-[90vh] flex flex-col relative">
        <button
          (click)="cerrar.emit()"
          class="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 shadow-sm text-[#5A5561] flex items-center justify-center hover:bg-[#260B2B] hover:text-white transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>

        <!-- Cargando -->
        <div *ngIf="loading()" class="p-16 flex items-center justify-center">
          <p class="text-sm text-[#9B94A3]">Cargando producto…</p>
        </div>

        <!-- Error de carga -->
        <div *ngIf="!loading() && loadError() as error" class="p-16 flex flex-col items-center justify-center text-center">
          <span class="material-symbols-outlined text-[40px] text-gray-300">{{ error === 'not-found' ? 'search_off' : 'error' }}</span>
          <p class="mt-3 text-sm font-semibold text-[#17141A]">
            {{ error === 'not-found' ? 'Producto no encontrado' : 'No se pudo cargar el producto' }}
          </p>
          <p class="text-xs text-[#9B94A3] mt-1">
            {{ error === 'not-found' ? 'Este producto ya no está disponible en el catálogo.' : 'Intenta nuevamente en unos momentos.' }}
          </p>
        </div>

        <!-- Detalle -->
        <div *ngIf="!loading() && !loadError() && producto() as p" class="overflow-y-auto p-6 md:p-8 space-y-6">
          <div class="flex flex-col md:flex-row gap-6">
            <div class="w-full md:w-1/2 aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-[#E8E2DA]">
              <img
                [src]="p.imagen_url || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800'"
                [alt]="p.nombre"
                class="w-full h-full object-cover"
              />
            </div>
            <div class="w-full md:w-1/2 flex flex-col justify-between">
              <div>
                <span class="text-[11px] font-bold tracking-wider text-[#38133E] uppercase">
                  {{ p.tipo || 'Sin tipo' }} {{ p.talla ? '• ' + p.talla : '' }}
                </span>
                <h2 class="text-xl font-bold text-[#17141A] mt-1 leading-snug">{{ p.nombre }}</h2>
                <p class="text-xs text-[#5A5561] mt-1">{{ p.descripcion }}</p>
              </div>

              <div class="p-3 bg-[#F5EBF7] rounded-xl border border-[#E8E2DA] my-3 inline-block w-fit">
                <p class="text-[10px] font-bold uppercase tracking-wider text-[#5A5561]">Precio</p>
                <p class="text-lg font-bold text-[#38133E] mt-0.5">{{ p.venta.toLocaleString() }} Bs</p>
              </div>

              <!-- Caja: Tu talla recomendada (CU35, S8) -->
              <div class="my-3 p-3.5 bg-[#FAF8F5] border border-[#E8E2DA] rounded-xl space-y-2.5">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[18px] text-[#38133E]">straighten</span>
                    <span class="text-xs font-bold text-[#17141A]">Tu talla recomendada</span>
                  </div>
                  <div *ngIf="recomendacion() as rec" class="flex items-center gap-1.5">
                    <span
                      *ngIf="rec.talla_recomendada && rec.ajuste"
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      [ngClass]="{
                        'bg-emerald-100 text-emerald-800 border border-emerald-200': rec.ajuste === 'justa',
                        'bg-amber-100 text-amber-800 border border-amber-200': rec.ajuste === 'ajustada',
                        'bg-blue-100 text-blue-800 border border-blue-200': rec.ajuste === 'holgada'
                      }"
                    >
                      Ajuste {{ rec.ajuste }}
                    </span>
                    <span
                      *ngIf="rec.fuente === 'generica'"
                      class="text-[9px] text-[#9B94A3] bg-white px-1.5 py-0.5 rounded border border-[#E8E2DA]"
                      title="Basado en tabla genérica de respaldo"
                    >
                      Genérica
                    </span>
                  </div>
                </div>

                <div *ngIf="loadingRecomendacion()" class="py-2 text-center text-xs text-[#9B94A3]">
                  Calculando recomendación personalizada…
                </div>

                <div *ngIf="!loadingRecomendacion() && recomendacion() as rec" class="space-y-2">
                  <!-- Caso sin_medidas -->
                  <div *ngIf="rec.sin_medidas" class="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1.5">
                    <p class="leading-relaxed">{{ rec.mensaje }}</p>
                    <button
                      type="button"
                      (click)="irAPerfil.emit()"
                      class="inline-flex items-center gap-1 text-[11px] font-bold text-[#38133E] hover:underline cursor-pointer"
                    >
                      <span>Registrar mis medidas en Mi Perfil</span>
                      <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>

                  <!-- Caso con medidas -->
                  <div *ngIf="!rec.sin_medidas" class="space-y-2">
                    <div class="flex items-baseline gap-2">
                      <span *ngIf="rec.talla_recomendada" class="text-xl font-extrabold text-[#38133E]">
                        Talla {{ rec.talla_recomendada }}
                      </span>
                      <span *ngIf="!rec.talla_recomendada" class="text-xs font-bold text-[#5A5561]">
                        Sin recomendación directa
                      </span>
                    </div>

                    <p class="text-xs text-[#5A5561] leading-relaxed">
                      {{ rec.mensaje }}
                    </p>

                    <!-- Aviso de talla destacado (S4 / S8) -->
                    <div
                      *ngIf="rec.aviso_talla"
                      class="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-bold text-amber-900 flex items-start gap-1.5"
                    >
                      <span class="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">warning</span>
                      <span>{{ rec.aviso_talla }}</span>
                    </div>

                    <!-- Chips por talla con su ajuste (S8) -->
                    <div *ngIf="rec.tallas && rec.tallas.length > 0" class="pt-1">
                      <p class="text-[10px] font-bold uppercase tracking-wider text-[#9B94A3] mb-1">Ajuste por talla:</p>
                      <div class="flex flex-wrap gap-1.5">
                        <span
                          *ngFor="let item of rec.tallas"
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border"
                          [ngClass]="{
                            'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold': item.talla === rec.talla_recomendada,
                            'bg-white border-[#E8E2DA] text-[#5A5561]': item.talla !== rec.talla_recomendada
                          }"
                        >
                          <span class="font-bold">{{ item.talla }}:</span>
                          <span class="capitalize text-[10px]">{{ item.ajuste }}</span>
                        </span>
                      </div>
                    </div>

                    <!-- Nota de retroalimentación de clientes (S5 / S8) -->
                    <div
                      *ngIf="rec.retroalimentacion?.nota"
                      class="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-1.5"
                    >
                      <span class="material-symbols-outlined text-[16px] text-blue-700 shrink-0 mt-0.5">reviews</span>
                      <span>{{ rec.retroalimentacion.nota }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 mb-3" *ngIf="stripeDisponible">
                <span class="text-[10px] font-bold uppercase tracking-wider text-[#9B94A3]">Cantidad</span>
                <button
                  type="button"
                  (click)="ajustarCantidad(-1)"
                  [disabled]="cantidad() <= 1"
                  class="w-7 h-7 rounded border border-[#E8E2DA] text-[#5A5561] hover:bg-[#FAF8F5] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >−</button>
                <span class="w-8 text-center text-sm font-bold text-[#17141A]">{{ cantidad() }}</span>
                <button
                  type="button"
                  (click)="ajustarCantidad(1)"
                  [disabled]="cantidad() >= cantidadMaxima"
                  class="w-7 h-7 rounded border border-[#E8E2DA] text-[#5A5561] hover:bg-[#FAF8F5] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >+</button>
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  (click)="reservar.emit(p)"
                  class="flex-1 py-2.5 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs cursor-pointer"
                >
                  Reservar
                </button>
                <button
                  *ngIf="stripeDisponible"
                  (click)="onComprar(p)"
                  [disabled]="!syncService.isOnline()"
                  [title]="!syncService.isOnline() ? 'Operación no disponible sin conexión a internet' : ''"
                  class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Comprar ahora
                </button>
                <button
                  *ngIf="stripeDisponible"
                  (click)="onAgregarAlCarrito(p)"
                  [disabled]="!syncService.isOnline()"
                  [title]="!syncService.isOnline() ? 'Operación no disponible sin conexión a internet' : ''"
                  class="flex-1 py-2.5 bg-white hover:bg-[#F5EBF7] text-[#38133E] border border-[#E8E2DA] rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Agregar al carrito
                </button>
                <p
                  *ngIf="!stripeDisponible"
                  class="flex-1 py-2.5 text-center text-[11px] font-semibold text-[#9B94A3] border border-[#E8E2DA] rounded-lg"
                  title="El cobro con tarjeta no está disponible en este servidor"
                >
                  Compra no disponible
                </p>
              </div>
            </div>
          </div>

          <div class="pt-6 border-t border-[#E8E2DA] grid grid-cols-2 gap-4">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-[#9B94A3] mb-1">Color</p>
              <p class="text-sm font-bold text-[#17141A]">{{ p.color || '—' }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-[#9B94A3] mb-1">Colección</p>
              <p class="text-sm font-bold text-[#17141A]">{{ p.coleccion_nombre || '—' }}</p>
            </div>
          </div>

          <div *ngIf="p.imagenes_secundarias && p.imagenes_secundarias.length > 0" class="pt-6 border-t border-[#E8E2DA]">
            <h3 class="text-sm font-bold text-[#17141A] mb-3">Imágenes adicionales</h3>
            <div class="grid grid-cols-3 gap-2">
              <img *ngFor="let img of p.imagenes_secundarias" [src]="img" class="w-full h-24 object-cover rounded-lg border border-[#E8E2DA]" />
            </div>
          </div>
        </div>

        <div class="p-4 bg-[#FAF8F5] border-t border-[#E8E2DA] flex justify-end">
          <button
            (click)="cerrar.emit()"
            class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `
})
export class ProductDetailComponent implements OnChanges {
  @Input({ required: true }) idProducto!: number;
  @Output() cerrar = new EventEmitter<void>();
  @Output() reservar = new EventEmitter<ProductOut>();
  @Output() comprar = new EventEmitter<{ producto: ProductOut; cantidad: number }>();
  @Output() agregarAlCarrito = new EventEmitter<{ producto: ProductOut; cantidad: number }>();
  @Output() irAPerfil = new EventEmitter<void>();

  producto = signal<ProductOut | null>(null);
  recomendacion = signal<SizeRecommendationOut | null>(null);
  loading = signal<boolean>(true);
  loadingRecomendacion = signal<boolean>(false);
  loadError = signal<ProductDetailError | null>(null);
  cantidad = signal<number>(1);

  // Sin lectura de disponibilidad real por sucursal (el Cliente no tiene
  // `inventario.ver`, ver design.md D5): el selector se acota a un tope fijo
  // y arbitrario, compartido con `CartService` (CU16 D2) para que el
  // stepper y el carrito nunca desincronicen su tope. El stock real lo
  // verifica siempre el servidor antes de cobrar (POST
  // /api/payments/intents) y antes de vender (POST /api/sales).
  cantidadMaxima = CANTIDAD_MAXIMA_LINEA;

  stripeDisponible = !!environment.stripePublishableKey;

  constructor(
    private http: HttpClient,
    private offlineDbService: OfflineDbService,
    public syncService: SyncService,
    private sizeChartService: SizeChartService,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['idProducto']) {
      this.cantidad.set(1);
      this.fetchProducto();
      this.fetchRecomendacion();
    }
  }

  ajustarCantidad(delta: number): void {
    this.cantidad.update(c => Math.min(Math.max(c + delta, 1), this.cantidadMaxima));
  }

  onComprar(p: ProductOut): void {
    if (!this.stripeDisponible || !this.syncService.isOnline()) {
      return;
    }
    this.comprar.emit({ producto: p, cantidad: this.cantidad() });
  }

  onAgregarAlCarrito(p: ProductOut): void {
    if (!this.stripeDisponible || !this.syncService.isOnline()) {
      return;
    }
    this.agregarAlCarrito.emit({ producto: p, cantidad: this.cantidad() });
  }

  private async fetchProducto() {
    this.loading.set(true);
    this.loadError.set(null);
    this.producto.set(null);

    let hadCached = false;
    try {
      const db = this.offlineDbService.getActiveDb();
      const cached = await db.productos.get(Number(this.idProducto));
      if (cached) {
        this.producto.set(cached);
        this.loading.set(false);
        hadCached = true;
      }
    } catch {}

    if (this.syncService.isOnline()) {
      try {
        const producto = await firstValueFrom(
          this.http.get<ProductOut>(`${API_URL}/api/products/${this.idProducto}`)
        );
        this.producto.set(producto);
      } catch (err: unknown) {
        if (!hadCached) {
          this.loadError.set(classifyProductDetailError(err));
        }
      } finally {
        this.loading.set(false);
      }
    } else if (!hadCached) {
      this.loading.set(false);
      this.loadError.set('not-found');
    }
  }

  private async fetchRecomendacion() {
    this.recomendacion.set(null);
    if (!this.syncService.isOnline()) {
      return;
    }
    this.loadingRecomendacion.set(true);
    try {
      const rec = await this.sizeChartService.getSizeRecommendation(this.idProducto);
      this.recomendacion.set(rec);
    } catch {
      this.recomendacion.set(null);
    } finally {
      this.loadingRecomendacion.set(false);
    }
  }
}
