import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArchiveService } from '../../../core/services/archive.service';
import { ProductOut } from '../../../core/models';
import { ProductDetailComponent } from './product-detail.component';
import { ReservationFormComponent } from '../reservations/reservation-form.component';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-customer-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductDetailComponent, ReservationFormComponent],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">

      <!-- Encabezado -->
      <div class="pb-5 border-b border-gray-200">
        <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Catálogo</span>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">Explorar Productos</h1>
        <p class="text-xs text-gray-500 mt-1">Encuentre la prenda que busca y resérvela en su sucursal.</p>
      </div>

      <!-- Filtros -->
      <div class="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
        <div class="relative min-w-[200px] flex-1">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400">search</span>
          <input
            type="text"
            [(ngModel)]="q"
            (ngModelChange)="onFilterChange()"
            placeholder="Buscar por nombre..."
            class="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>

        <select
          [(ngModel)]="tipo"
          (ngModelChange)="onFilterChange()"
          class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">Todos los tipos</option>
          <option value="Camisa">Camisa</option>
          <option value="Polera">Polera</option>
          <option value="Pantalon">Pantalón</option>
          <option value="Vestido">Vestido</option>
          <option value="Chaqueta">Chaqueta</option>
          <option value="Falda">Falda</option>
        </select>

        <input
          type="text"
          [(ngModel)]="talla"
          (ngModelChange)="onFilterChange()"
          placeholder="Talla (ej. M)"
          class="w-28 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
        />

        <select
          [(ngModel)]="color"
          (ngModelChange)="onFilterChange()"
          class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">Todos los colores</option>
          <option value="Negro">Negro</option>
          <option value="Blanco">Blanco</option>
          <option value="Azul">Azul</option>
          <option value="Rojo">Rojo</option>
          <option value="Gris">Gris</option>
        </select>

        <select
          [(ngModel)]="idColeccion"
          (ngModelChange)="onFilterChange()"
          class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option [ngValue]="null">Todas las colecciones</option>
          <option *ngFor="let c of archiveService.colecciones()" [ngValue]="c.idColeccion">
            {{ c.nombre_coleccion }}
          </option>
        </select>

        <select
          [(ngModel)]="idProveedor"
          (ngModelChange)="onFilterChange()"
          class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option [ngValue]="null">Todos los proveedores</option>
          <option *ngFor="let pr of archiveService.proveedores()" [ngValue]="pr.idProveedor">
            {{ pr.nombre }}
          </option>
        </select>
      </div>

      <!-- Galería de productos -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          *ngFor="let item of archiveService.products()"
          (click)="openDetail(item)"
          class="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-xs hover:shadow-sm hover:border-indigo-300 transition-all flex flex-col cursor-pointer group"
        >
          <div class="aspect-[4/3] w-full bg-gray-100 overflow-hidden relative">
            <img
              [src]="item.imagen_url || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80'"
              [alt]="item.nombre"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div class="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-gray-200/80 shadow-xs text-right">
              <p class="text-xs font-bold text-gray-900">{{ item.venta.toLocaleString() }} Bs</p>
            </div>
          </div>

          <div class="p-4 flex-1 flex flex-col justify-between space-y-2">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                {{ item.tipo || 'Sin tipo' }} {{ item.talla ? '• ' + item.talla : '' }}
              </span>
              <h3 class="text-sm font-bold text-gray-900 leading-snug mt-0.5">{{ item.nombre }}</h3>
            </div>
            <p class="text-xs text-gray-500">{{ item.color || '' }}</p>
          </div>
        </div>
      </div>

      <div *ngIf="archiveService.products().length === 0" class="text-center py-12 text-gray-400 text-sm">
        No se encontraron productos con los filtros seleccionados.
      </div>

      <!-- Paginación -->
      <div *ngIf="totalPages() > 1" class="flex items-center justify-center gap-2 pt-2">
        <button
          (click)="goToPage(page() - 1)"
          [disabled]="page() === 1"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
        >
          Anterior
        </button>
        <span class="text-xs text-gray-500 font-semibold">Página {{ page() }} de {{ totalPages() }}</span>
        <button
          (click)="goToPage(page() + 1)"
          [disabled]="page() === totalPages()"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
        >
          Siguiente
        </button>
      </div>
    </div>

    <app-product-detail
      *ngIf="selectedProductId() !== null"
      [idProducto]="selectedProductId()!"
      (cerrar)="closeDetail()"
      (reservar)="onReservar($event)"
    ></app-product-detail>

    <app-reservation-form
      *ngIf="reservandoProducto() !== null"
      [producto]="reservandoProducto()!"
      (cerrar)="reservandoProducto.set(null)"
      (creada)="onReservaCreada()"
    ></app-reservation-form>
  `
})
export class CatalogComponent implements OnInit {
  q = '';
  tipo = '';
  talla = '';
  color = '';
  idColeccion: number | null = null;
  idProveedor: number | null = null;

  page = signal<number>(1);
  selectedProductId = signal<number | null>(null);
  reservandoProducto = signal<ProductOut | null>(null);

  totalPages = computed(() => {
    const total = this.archiveService.total();
    return total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;
  });

  constructor(
    public archiveService: ArchiveService,
  ) {}

  ngOnInit() {
    this.archiveService.loadColecciones();
    this.archiveService.loadProveedores();
    this.fetchProducts();
  }

  onFilterChange() {
    this.page.set(1);
    this.fetchProducts();
  }

  goToPage(target: number) {
    if (target < 1 || target > this.totalPages()) return;
    this.page.set(target);
    this.fetchProducts();
  }

  openDetail(item: ProductOut) {
    this.selectedProductId.set(item.idProducto);
  }

  closeDetail() {
    this.selectedProductId.set(null);
  }

  onReservar(producto: ProductOut) {
    this.selectedProductId.set(null);
    this.reservandoProducto.set(producto);
  }

  onReservaCreada() {
    this.reservandoProducto.set(null);
  }

  private fetchProducts() {
    this.archiveService.loadProducts({
      q: this.q || undefined,
      tipo: this.tipo || undefined,
      talla: this.talla || undefined,
      color: this.color || undefined,
      idColeccion: this.idColeccion ?? undefined,
      idProveedor: this.idProveedor ?? undefined,
      page: this.page(),
      size: PAGE_SIZE,
    });
  }
}
