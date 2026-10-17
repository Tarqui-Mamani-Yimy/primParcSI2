import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProductOut } from '../../../core/models';
import { OfflineDbService } from '../../../core/services/offline-db.service';
import { SyncService } from '../../../core/services/sync.service';
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
                  [disabled]="!syncService.isOnline()"
                  [title]="!syncService.isOnline() ? 'Operación no disponible sin conexión a internet' : ''"
                  class="flex-1 py-2.5 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs cursor-pointer disabled:opacity-50"
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

  producto = signal<ProductOut | null>(null);
  loading = signal<boolean>(true);
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
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['idProducto']) {
      this.cantidad.set(1);
      this.fetchProducto();
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
}
