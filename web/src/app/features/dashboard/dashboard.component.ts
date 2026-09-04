import { Component, EventEmitter, Output, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ArchiveService } from '../../core/services/archive.service';
import { InventoryService } from '../../core/services/inventory.service';
import { DispatchService } from '../../core/services/dispatch.service';
import { AuthService } from '../../core/services/auth.service';
import { AppView } from '../../shared/components/sidebar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-200">

      <!-- Welcome Hero Banner -->
      <div class="bg-gradient-to-r from-gray-900 to-indigo-950 text-white rounded-2xl p-6 lg:p-8 relative overflow-hidden shadow-xs">
        <div class="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none hidden md:block">
          <img
            src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=1000&auto=format&fit=crop&q=80"
            alt="AETHER Operations"
            class="w-full h-full object-cover mix-blend-luminosity"
          />
          <div class="absolute inset-0 bg-gradient-to-r from-gray-900 to-transparent"></div>
        </div>

        <div class="relative z-10 max-w-2xl">
          <div class="flex items-center space-x-2 mb-2">
            <span class="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-bold tracking-wide uppercase border border-indigo-400/30">
              Operations Terminal
            </span>
            <span class="text-gray-300 text-xs">• {{ inventoryService.locations().length }} Sucursales Synced</span>
          </div>

          <h1 class="text-2xl lg:text-3xl font-bold text-white tracking-tight">
            AETHER Global Operations Overview
          </h1>
          <p class="text-sm text-gray-300 mt-2 leading-relaxed max-w-xl">
            Real-time telemetry across boutique inventories, vault reserves, secured dispatches, and permanent garment archive.
          </p>

          <div class="flex flex-wrap gap-3 mt-5">
            <button
              (click)="navigate.emit('archive')"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-2 cursor-pointer"
            >
              <span class="material-symbols-outlined text-[18px]">checkroom</span>
              <span>Curate Garment Archive</span>
            </button>
            <button
              (click)="navigate.emit('inventory')"
              class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold rounded-lg transition-colors flex items-center space-x-2 cursor-pointer"
            >
              <span class="material-symbols-outlined text-[18px]">swap_horiz</span>
              <span>Transfer Boutique Stock</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Key Performance Metrics Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

        <!-- Metric 1: Total Archive Valuation -->
        <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
          <div class="flex items-center justify-between text-gray-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-gray-400">Archive Valuation</span>
            <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">euro</span>
            </div>
          </div>
          <p class="text-2xl font-bold text-gray-900 tracking-tight">
            {{ totalValuation().toLocaleString() }} Bs
          </p>
          <div class="flex items-center space-x-1.5 mt-2 text-xs text-emerald-700 font-medium">
            <span class="material-symbols-outlined text-[16px]">trending_up</span>
            <span class="font-semibold">+18.4%</span>
            <span class="text-gray-500">vs previous cycle</span>
          </div>
        </div>

        <!-- Metric 2: Active Inventory Units -->
        <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
          <div class="flex items-center justify-between text-gray-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-gray-400">Boutique Units</span>
            <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">inventory_2</span>
            </div>
          </div>
          <p class="text-2xl font-bold text-gray-900 tracking-tight">
            {{ totalUnits() }} <span class="text-sm font-normal text-gray-500">piezas</span>
          </p>
          <div class="flex items-center space-x-1.5 mt-2 text-xs text-gray-600 font-medium">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Allocated across {{ inventoryService.locations().length }} locations</span>
          </div>
        </div>

        <!-- Metric 3: Active Dispatches -->
        <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
          <div class="flex items-center justify-between text-gray-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-gray-400">Active Dispatches</span>
            <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">local_shipping</span>
            </div>
          </div>
          <p class="text-2xl font-bold text-gray-900 tracking-tight">
            {{ activeDispatchesCount() }}
          </p>
          <div class="flex items-center space-x-1.5 mt-2 text-xs text-amber-700 font-medium">
            <span class="material-symbols-outlined text-[16px]">priority_high</span>
            <span>Active shipments in transit</span>
          </div>
        </div>

        <!-- Metric 4: Permanent Archive Pieces -->
        <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
          <div class="flex items-center justify-between text-gray-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-gray-400">Archived SKUs</span>
            <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">style</span>
            </div>
          </div>
          <p class="text-2xl font-bold text-gray-900 tracking-tight">
            {{ archiveService.products().length }}
          </p>
          <div class="flex items-center space-x-1.5 mt-2 text-xs text-gray-500">
            <span>Permanent & Seasonal Collections</span>
          </div>
        </div>
      </div>

      <!-- Main Section: Boutique Matrix & Active Dispatches Split -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- Left 2 Cols: Global Boutique Network Distribution -->
        <div class="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-2xs">
          <div class="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h2 class="text-base font-bold text-gray-900">Global Boutique Nodes</h2>
              <p class="text-xs text-gray-500">Physical stock balance and active reserve telemetry</p>
            </div>
            <button
              (click)="navigate.emit('inventory')"
              class="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center space-x-1"
            >
              <span>View Full Matrix</span>
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          <div class="divide-y divide-gray-100 mt-2">
            <div *ngFor="let loc of inventoryService.locations()" class="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-start space-x-3">
                <div class="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 font-bold text-xs">
                  {{ loc.ciudad.substring(0, 3).toUpperCase() }}
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-900">{{ loc.nombre }}</p>
                  <p class="text-xs text-gray-500">{{ loc.direccion }} • Mgr: {{ loc.responsable }}</p>
                </div>
              </div>

              <div class="flex items-center space-x-4 sm:text-right">
                <div class="min-w-[70px]">
                  <p class="text-sm font-bold text-gray-900">
                    {{ getLocationStockCount(loc.id) }} pcs
                  </p>
                  <p class="text-[11px] text-emerald-700 font-medium">Optimal</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right 1 Col: Recent Dispatches Feed -->
        <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 class="text-base font-bold text-gray-900">Live Dispatches</h2>
              <button
                (click)="navigate.emit('logistics')"
                class="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                All ({{ dispatchService.dispatches().length }})
              </button>
            </div>

            <div class="space-y-3 mt-4">
              <div
                *ngFor="let order of dispatchService.dispatches().slice(0, 3)"
                class="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1.5 hover:border-indigo-200 transition-colors"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-gray-900">{{ order.referencia }}</span>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    [ngClass]="{
                      'bg-emerald-50 text-emerald-700 border border-emerald-200': order.estado === 'entregado',
                      'bg-sky-50 text-sky-700 border border-sky-200': order.estado === 'en_transito',
                      'bg-amber-50 text-amber-700 border border-amber-200': order.estado === 'despachado',
                      'bg-gray-100 text-gray-700 border border-gray-200': order.estado === 'preparacion'
                    }"
                  >
                    {{ order.estado.replace('_', ' ') }}
                  </span>
                </div>

                <p class="text-xs font-semibold text-gray-900">{{ order.cliente }}</p>
                <p class="text-xs text-gray-500 truncate">
                  {{ getLocationName(order.origen_id) }} → {{ getLocationName(order.destino_id) }}
                </p>

                <div class="flex items-center justify-between pt-1 border-t border-gray-200 text-xs">
                  <span class="text-gray-500">{{ order.cantidad }} units</span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-gray-100">
            <button
              (click)="navigate.emit('logistics')"
              class="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors text-center block shadow-xs"
            >
              Book New Dispatch
            </button>
          </div>
        </div>
      </div>

      <!-- Featured Permanent Archive Preview -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-base font-bold text-gray-900">Permanent Archive Highlights</h2>
            <p class="text-xs text-gray-500">Architectural silhouettes and certified material fabrications</p>
          </div>
          <button
            (click)="navigate.emit('archive')"
            class="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold transition-colors"
          >
            Explore Full Archive →
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            *ngFor="let item of archiveService.products().slice(0, 3)"
            class="group bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between"
          >
            <div class="aspect-[4/3] w-full overflow-hidden relative bg-gray-100">
              <img
                [src]="item.imagen_url"
                [alt]="item.nombre"
                class="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
              />
              <div class="absolute top-2.5 left-2.5 bg-gray-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                {{ item.sku }}
              </div>
              <div class="absolute bottom-2.5 right-2.5 bg-white/95 backdrop-blur-xs text-gray-900 px-2 py-0.5 rounded text-xs font-bold shadow-xs">
                {{ item.precio.toLocaleString() }} Bs
              </div>
            </div>

            <div class="p-4 flex-1 flex flex-col justify-between">
              <div>
                <p class="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                  {{ item.coleccion.replace('_', ' ') }}
                </p>
                <h3 class="text-sm font-bold text-gray-900 mt-1 leading-snug">{{ item.nombre }}</h3>
                <p class="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{{ item.descripcion }}</p>
              </div>

              <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span class="text-gray-600 font-medium">{{ item.color }}</span>
                <span class="text-emerald-700 font-semibold flex items-center space-x-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Active</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class DashboardComponent implements OnInit {
  @Output() navigate = new EventEmitter<AppView>();

  constructor(
    public archiveService: ArchiveService,
    public inventoryService: InventoryService,
    public dispatchService: DispatchService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.inventoryService.loadLocations();
    this.inventoryService.loadStock();
    this.dispatchService.loadDispatches();
    this.archiveService.loadProducts();
  }

  totalValuation = computed(() => {
    let sum = 0;
    for (const item of this.archiveService.products()) {
      let totalPcs = 0;
      for (const size in item.tallas) {
        totalPcs += item.tallas[size];
      }
      sum += totalPcs * item.precio;
    }
    return sum;
  });

  totalUnits = computed(() => {
    return this.inventoryService.stock().reduce((acc, curr) => acc + curr.cantidad, 0);
  });

  activeDispatchesCount = computed(() => {
    return this.dispatchService.dispatches().filter(d => d.estado !== 'entregado').length;
  });

  getLocationStockCount(locationId: string): number {
    return this.inventoryService
      .stock()
      .filter(s => s.sucursal_id === locationId)
      .reduce((acc, curr) => acc + curr.cantidad, 0);
  }

  getLocationName(locId: string): string {
    return this.inventoryService.locations().find(l => l.id === locId)?.nombre || 'N/A';
  }
}
