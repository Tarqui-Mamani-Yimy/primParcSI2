import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArchiveService } from '../../core/services/archive.service';
import { ProductItem } from '../../core/models';

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">

      <!-- Top Title & Action Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Arquitectura de prendas curada</span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">Archivo AETHER y Catálogo Esencial</h1>
          <p class="text-xs text-gray-500 mt-1">Registro oficial de prendas esenciales permanentes, especificaciones de hilo certificadas y lanzamientos de temporada.</p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            (click)="openCreateModal()"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>Registrar prenda</span>
          </button>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="flex flex-wrap items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            (click)="selectedCollection.set('ALL')"
            [class.bg-indigo-600]="selectedCollection() === 'ALL'"
            [class.text-white]="selectedCollection() === 'ALL'"
            [class.text-gray-600]="selectedCollection() !== 'ALL'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >Todas las colecciones</button>
          <button
            (click)="selectedCollection.set('ESSENTIAL_PERMANENT')"
            [class.bg-indigo-600]="selectedCollection() === 'ESSENTIAL_PERMANENT'"
            [class.text-white]="selectedCollection() === 'ESSENTIAL_PERMANENT'"
            [class.text-gray-600]="selectedCollection() !== 'ESSENTIAL_PERMANENT'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >Esenciales permanentes</button>
          <button
            (click)="selectedCollection.set('ARCHIVE_AW25')"
            [class.bg-indigo-600]="selectedCollection() === 'ARCHIVE_AW25'"
            [class.text-white]="selectedCollection() === 'ARCHIVE_AW25'"
            [class.text-gray-600]="selectedCollection() !== 'ARCHIVE_AW25'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >Archivo OI25</button>
          <button
            (click)="selectedCollection.set('ATELIER_SS26')"
            [class.bg-indigo-600]="selectedCollection() === 'ATELIER_SS26'"
            [class.text-white]="selectedCollection() === 'ATELIER_SS26'"
            [class.text-gray-600]="selectedCollection() !== 'ATELIER_SS26'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >Atelier PV26</button>
        </div>

        <div class="relative min-w-[240px]">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400">search</span>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Buscar por SKU, tejido o título..."
            class="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      <!-- Garment Gallery Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          *ngFor="let item of filteredProducts()"
          class="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-xs hover:shadow-sm hover:border-gray-300 transition-all flex flex-col group"
        >
          <div class="aspect-[4/3] w-full bg-gray-100 overflow-hidden relative">
            <img
              [src]="item.imagen_url"
              [alt]="item.nombre"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div class="absolute top-3 left-3 flex flex-col gap-1.5">
              <span class="px-2.5 py-1 bg-gray-900/90 backdrop-blur-xs text-white rounded-md text-[10px] font-bold tracking-wider uppercase shadow-xs">
                {{ item.sku }}
              </span>
              <span
                *ngIf="item.estado === 'agotado'"
                class="px-2 py-0.5 bg-amber-500 text-white rounded text-[9px] font-bold uppercase shadow-xs"
              >Sin stock</span>
            </div>

            <div class="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-gray-200/80 shadow-xs text-right">
              <p class="text-xs font-bold text-gray-900">{{ item.precio.toLocaleString() }} Bs</p>
            </div>
          </div>

          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {{ item.categoria }} • {{ item.temporada }}
                </span>
                <span class="text-xs text-gray-500">{{ item.color }}</span>
              </div>
              <h3 class="text-base font-bold text-gray-900 leading-snug">{{ item.nombre }}</h3>
              <p class="text-xs text-gray-600 mt-1 leading-relaxed line-clamp-2">{{ item.descripcion }}</p>
            </div>

            <div class="pt-3 border-t border-gray-100 flex items-center justify-between">
              <div class="flex gap-1 text-xs">
                <span *ngFor="let s of getAvailableSizes(item)" class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold text-[11px]">
                  {{ s }}
                </span>
              </div>
              <button
                (click)="inspectProduct(item)"
                class="px-3 py-1.5 bg-gray-900 text-white hover:bg-indigo-600 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
              >Ver ficha técnica</button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Garment Detailed Inspection Modal -->
    <div *ngIf="inspectingItem()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-3xl w-full rounded-2xl border border-gray-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col relative">
        <button
          (click)="inspectingItem.set(null)"
          class="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 shadow-sm text-gray-700 flex items-center justify-center hover:bg-gray-900 hover:text-white transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div class="overflow-y-auto p-6 md:p-8 space-y-6">
          <div *ngIf="inspectingItem() as p">
            <div class="flex flex-col md:flex-row gap-6">
              <div class="w-full md:w-1/2 aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                <img [src]="p.imagen_url" [alt]="p.nombre" class="w-full h-full object-cover" />
              </div>
              <div class="w-full md:w-1/2 flex flex-col justify-between">
                <div>
                  <span class="text-[11px] font-bold tracking-wider text-indigo-600 uppercase">
                    {{ p.sku }} • {{ p.coleccion.replace('_', ' ') }}
                  </span>
                  <h2 class="text-xl font-bold text-gray-900 mt-1 leading-snug">{{ p.nombre }}</h2>
                  <p class="text-xs text-gray-600 mt-1">{{ p.descripcion }}</p>
                </div>

                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 my-3">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-gray-500">Precio de venta</p>
                  <p class="text-xl font-bold text-gray-900 mt-0.5">{{ p.precio.toLocaleString() }} Bs</p>
                </div>
              </div>
            </div>

            <div class="mt-6 pt-6 border-t border-gray-100 space-y-3">
              <h3 class="text-sm font-bold text-gray-900">Color y temporada</h3>
              <div class="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-gray-900 text-xs">{{ p.color }}</span>
                  <span class="text-xs text-indigo-600 font-semibold">{{ p.temporada }}</span>
                </div>
              </div>
            </div>

            <div *ngIf="p.notas_diseno" class="mt-6 pt-6 border-t border-gray-100">
              <h3 class="text-sm font-bold text-gray-900 mb-2">Notas de diseño</h3>
              <p class="text-xs text-gray-600 leading-relaxed p-4 rounded-xl bg-gray-50 border border-gray-200 italic">
                "{{ p.notas_diseno }}"
              </p>
            </div>

            <div class="mt-6 pt-6 border-t border-gray-100">
              <h3 class="text-sm font-bold text-gray-900 mb-3">Matriz de tallas por nodo</h3>
              <div class="grid grid-cols-5 gap-2 text-center">
                <div *ngFor="let key of getKeys(p.tallas)" class="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p class="text-xs font-bold text-gray-500">Size {{ key }}</p>
                  <p class="text-base font-bold text-gray-900 mt-0.5">{{ p.tallas[key] }} pcs</p>
                </div>
              </div>
            </div>

            <div *ngIf="p.imagenes_secundarias && p.imagenes_secundarias.length > 0" class="mt-6 pt-6 border-t border-gray-100">
              <h3 class="text-sm font-bold text-gray-900 mb-3">Imágenes adicionales</h3>
              <div class="grid grid-cols-3 gap-2">
                <img *ngFor="let img of p.imagenes_secundarias" [src]="img" class="w-full h-24 object-cover rounded-lg border border-gray-200" />
              </div>
            </div>
          </div>
        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button (click)="inspectingItem.set(null)" class="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors">
            Cerrar ficha
          </button>
        </div>
      </div>
    </div>

    <!-- Curate New Garment Modal -->
    <div *ngIf="showCreateModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-xl w-full rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8 max-h-[90vh] overflow-y-auto relative">
        <button (click)="showCreateModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-5">
          <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Curaduría de atelier</span>
          <h2 class="text-lg font-bold text-gray-900 mt-0.5">Registrar prenda en el archivo</h2>
          <p class="text-xs text-gray-500">Añade una pieza esencial nueva al catálogo maestro.</p>
        </div>

        <form (ngSubmit)="saveNewGarment()" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Nombre de la prenda</label>
              <input type="text" [(ngModel)]="newGarment.nombre" name="nombre" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Código SKU</label>
              <input type="text" [(ngModel)]="newGarment.sku" name="sku" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Descripción</label>
            <input type="text" [(ngModel)]="newGarment.descripcion" name="descripcion" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Categoría</label>
              <select [(ngModel)]="newGarment.categoria" name="categoria" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="OUTERWEAR">Abrigos</option>
                <option value="TAILORING">Sastrería</option>
                <option value="KNITWEAR">Punto</option>
                <option value="TROUSERS">Pantalones</option>
                <option value="FOOTWEAR">Calzado</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Colección</label>
              <select [(ngModel)]="newGarment.coleccion" name="coleccion" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="ESSENTIAL_PERMANENT">Esenciales permanentes</option>
                <option value="ARCHIVE_AW25">Archivo OI25</option>
                <option value="ATELIER_SS26">Atelier PV26</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Precio (Bs)</label>
              <input type="number" [(ngModel)]="newGarment.precio" name="precio" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Color</label>
            <input type="text" [(ngModel)]="newGarment.color" name="color" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Notas de diseño</label>
            <textarea [(ngModel)]="newGarment.notas_diseno" name="notas" rows="2" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"></textarea>
          </div>

          <button type="submit" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs mt-4">
            Guardar en el archivo
          </button>
        </form>
      </div>
    </div>
  `
})
export class ArchiveComponent implements OnInit {
  selectedCollection = signal<string>('ALL');
  searchQuery = '';
  inspectingItem = signal<ProductItem | null>(null);
  showCreateModal = signal<boolean>(false);

  newGarment: Partial<ProductItem> = {
    nombre: '',
    sku: 'AETH-AL-007',
    descripcion: '',
    categoria: 'OUTERWEAR',
    coleccion: 'ESSENTIAL_PERMANENT',
    precio: 1650,
    imagen_url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
    imagenes_secundarias: [],
    tallas: { 'S': 8, 'M': 12, 'L': 6 },
    color: 'Natural Vicuña',
    temporada: 'Core 2026',
    notas_diseno: '',
    estado: 'disponible',
  };

  constructor(public archiveService: ArchiveService) {}

  ngOnInit() {
    this.archiveService.loadProducts();
  }

  filteredProducts = computed(() => {
    let list = this.archiveService.products();
    if (this.selectedCollection() !== 'ALL') {
      list = list.filter(p => p.coleccion === this.selectedCollection());
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        p =>
          p.nombre.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.descripcion.toLowerCase().includes(q)
      );
    }
    return list;
  });

  inspectProduct(item: ProductItem) {
    this.inspectingItem.set(item);
  }

  getAvailableSizes(item: ProductItem): string[] {
    return Object.keys(item.tallas || {});
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  openCreateModal() {
    this.showCreateModal.set(true);
  }

  saveNewGarment() {
    if (!this.newGarment.nombre) return;

    this.archiveService.addProduct({
      sku: this.newGarment.sku || 'AETH-000',
      nombre: this.newGarment.nombre,
      descripcion: this.newGarment.descripcion || 'Essential Architectural Garment',
      categoria: this.newGarment.categoria || 'OUTERWEAR',
      coleccion: this.newGarment.coleccion || 'ESSENTIAL_PERMANENT',
      precio: Number(this.newGarment.precio) || 1200,
      imagen_url: this.newGarment.imagen_url || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      imagenes_secundarias: [],
      tallas: { 'S': 6, 'M': 10, 'L': 6 },
      color: this.newGarment.color || 'Obsidian Sand',
      temporada: 'Core 2026',
      notas_diseno: this.newGarment.notas_diseno || 'Precision crafted.',
      estado: 'disponible',
    });

    this.showCreateModal.set(false);
  }
}
