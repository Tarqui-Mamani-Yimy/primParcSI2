import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProductOut } from '../../../core/models';
import { environment } from '../../../../environments/environment';

const API_URL = environment.apiUrl;

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-3xl w-full rounded-2xl border border-gray-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col relative">
        <button
          (click)="cerrar.emit()"
          class="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 shadow-sm text-gray-700 flex items-center justify-center hover:bg-gray-900 hover:text-white transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>

        <!-- Cargando -->
        <div *ngIf="loading()" class="p-16 flex items-center justify-center">
          <p class="text-sm text-gray-400">Cargando producto…</p>
        </div>

        <!-- No encontrado -->
        <div *ngIf="!loading() && notFound()" class="p-16 flex flex-col items-center justify-center text-center">
          <span class="material-symbols-outlined text-[40px] text-gray-300">search_off</span>
          <p class="mt-3 text-sm font-semibold text-gray-700">Producto no encontrado</p>
          <p class="text-xs text-gray-400 mt-1">Este producto ya no está disponible en el catálogo.</p>
        </div>

        <!-- Detalle -->
        <div *ngIf="!loading() && !notFound() && producto() as p" class="overflow-y-auto p-6 md:p-8 space-y-6">
          <div class="flex flex-col md:flex-row gap-6">
            <div class="w-full md:w-1/2 aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
              <img
                [src]="p.imagen_url || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800'"
                [alt]="p.nombre"
                class="w-full h-full object-cover"
              />
            </div>
            <div class="w-full md:w-1/2 flex flex-col justify-between">
              <div>
                <span class="text-[11px] font-bold tracking-wider text-indigo-600 uppercase">
                  {{ p.tipo || 'Sin tipo' }} {{ p.talla ? '• ' + p.talla : '' }}
                </span>
                <h2 class="text-xl font-bold text-gray-900 mt-1 leading-snug">{{ p.nombre }}</h2>
                <p class="text-xs text-gray-600 mt-1">{{ p.descripcion }}</p>
              </div>

              <div class="p-3 bg-indigo-50 rounded-xl border border-indigo-200 my-3 inline-block w-fit">
                <p class="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Precio</p>
                <p class="text-lg font-bold text-indigo-700 mt-0.5">{{ p.venta.toLocaleString() }} Bs</p>
              </div>

              <button
                (click)="reservar.emit(p)"
                class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs cursor-pointer"
              >
                Reservar
              </button>
            </div>
          </div>

          <div class="pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Color</p>
              <p class="text-sm font-bold text-gray-900">{{ p.color || '—' }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Colección</p>
              <p class="text-sm font-bold text-gray-900">{{ p.coleccion_nombre || '—' }}</p>
            </div>
          </div>

          <div *ngIf="p.imagenes_secundarias && p.imagenes_secundarias.length > 0" class="pt-6 border-t border-gray-100">
            <h3 class="text-sm font-bold text-gray-900 mb-3">Imágenes adicionales</h3>
            <div class="grid grid-cols-3 gap-2">
              <img *ngFor="let img of p.imagenes_secundarias" [src]="img" class="w-full h-24 object-cover rounded-lg border border-gray-200" />
            </div>
          </div>
        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            (click)="cerrar.emit()"
            class="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
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

  producto = signal<ProductOut | null>(null);
  loading = signal<boolean>(true);
  notFound = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['idProducto']) {
      this.fetchProducto();
    }
  }

  private async fetchProducto() {
    this.loading.set(true);
    this.notFound.set(false);
    this.producto.set(null);

    try {
      const producto = await firstValueFrom(
        this.http.get<ProductOut>(`${API_URL}/api/products/${this.idProducto}`)
      );
      this.producto.set(producto);
    } catch (err: unknown) {
      const httpErr = err as { status?: number };
      if (httpErr.status === 404) {
        this.notFound.set(true);
      } else {
        this.notFound.set(true);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
