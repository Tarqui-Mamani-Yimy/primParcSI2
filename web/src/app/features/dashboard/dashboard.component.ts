import { Component, EventEmitter, Output, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ArchiveService } from '../../core/services/archive.service';
import { InventoryService } from '../../core/services/inventory.service';
import { DispatchService } from '../../core/services/dispatch.service';
import { AuthService } from '../../core/services/auth.service';
import { AppView } from '../../shared/components/sidebar.component';
import { MlProjectionsComponent } from '../ml-projections/ml-projections.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MlProjectionsComponent],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-200">

      <!-- Selector de Pestañas (Solo Administrador) -->
      <div *ngIf="isAdmin()" class="flex items-center space-x-2 border-b border-gray-200">
        <button
          type="button"
          (click)="activeTab.set('operaciones')"
          [class.text-ys-primary]="activeTab() === 'operaciones'"
          [class.border-ys-primary]="activeTab() === 'operaciones'"
          [class.text-gray-500]="activeTab() !== 'operaciones'"
          [class.border-transparent]="activeTab() !== 'operaciones'"
          class="px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors cursor-pointer flex items-center space-x-2"
        >
          <span class="material-symbols-outlined text-[16px]">dashboard</span>
          <span>Centro de Operaciones</span>
        </button>

        <button
          type="button"
          (click)="activeTab.set('ml')"
          [class.text-ys-primary]="activeTab() === 'ml'"
          [class.border-ys-primary]="activeTab() === 'ml'"
          [class.text-gray-500]="activeTab() !== 'ml'"
          [class.border-transparent]="activeTab() !== 'ml'"
          class="px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors cursor-pointer flex items-center space-x-2"
        >
          <span class="material-symbols-outlined text-[16px]">auto_graph</span>
          <span>Proyecciones (ML)</span>
          <span class="text-[9px] px-1.5 py-0.5 bg-[#F5EBF7] text-[#38133E] rounded font-extrabold uppercase border border-[#E8E2DA]">scikit-learn</span>
        </button>
      </div>

      <!-- Tab 1: Operaciones Regulares -->
      <ng-container *ngIf="activeTab() === 'operaciones' || !isAdmin()">

      <!-- Banner de bienvenida -->
      <div class="bg-gradient-to-r from-[#17141A] to-[#260B2B] text-white rounded-2xl p-6 lg:p-8 relative overflow-hidden shadow-xs">
        <div class="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none hidden md:block">
          <img
            src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=1000&auto=format&fit=crop&q=80"
            alt="Operaciones Voguely"
            class="w-full h-full object-cover mix-blend-luminosity"
          />
          <div class="absolute inset-0 bg-gradient-to-r from-[#17141A] to-transparent"></div>
        </div>

        <div class="relative z-10 max-w-2xl">
          <div class="flex items-center space-x-2 mb-2">
            <span class="px-2.5 py-0.5 rounded-full bg-[#F5EBF7]/20 text-[#F5EBF7] text-xs font-bold tracking-wide uppercase border border-[#F5EBF7]/30">
              Terminal de Operaciones
            </span>
            <span class="text-[#E8E2DA] text-xs">• {{ inventoryService.locations().length }} Sucursales Sincronizadas</span>
          </div>

          <h1 class="text-2xl lg:text-3xl font-bold text-white tracking-tight">
            Resumen Global de Operaciones Voguely
          </h1>
          <p class="text-sm text-[#FAF8F5]/80 mt-2 leading-relaxed max-w-xl">
            Telemetría en tiempo real de inventarios de boutiques, reservas de bóveda, despachos seguros y archivo permanente de prendas.
          </p>

          <div class="flex flex-wrap gap-3 mt-5">
            <button
              (click)="navigate.emit('archive')"
              class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-2 cursor-pointer"
            >
              <span class="material-symbols-outlined text-[18px]">checkroom</span>
              <span>Gestionar Archivo de Prendas</span>
            </button>
            <button
              (click)="navigate.emit('inventory')"
              class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold rounded-lg transition-colors flex items-center space-x-2 cursor-pointer"
            >
              <span class="material-symbols-outlined text-[18px]">swap_horiz</span>
              <span>Transferir Stock de Boutique</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Métricas clave de rendimiento -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

        <div class="bg-white p-5 rounded-xl border border-[#E8E2DA] shadow-2xs">
          <div class="flex items-center justify-between text-[#5A5561] mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-[#9B94A3]">Valoración del Archivo</span>
            <div class="w-8 h-8 rounded-lg bg-[#F5EBF7] text-[#38133E] flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">euro</span>
            </div>
          </div>
          <p class="text-2xl font-bold text-[#17141A] tracking-tight">
            {{ totalValuation().toLocaleString() }} Bs
          </p>
          <div class="flex items-center space-x-1.5 mt-2 text-xs text-[#16A34A] font-medium">
            <span class="material-symbols-outlined text-[16px]">trending_up</span>
            <span class="font-semibold">+18.4%</span>
            <span class="text-[#5A5561]">vs ciclo anterior</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-[#E8E2DA] shadow-2xs">
          <div class="flex items-center justify-between text-[#5A5561] mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-[#9B94A3]">Unidades en Boutiques</span>
            <div class="w-8 h-8 rounded-lg bg-[#F5EBF7] text-[#38133E] flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">inventory_2</span>
            </div>
          </div>
          <p class="text-2xl font-bold text-[#17141A] tracking-tight">
            {{ totalUnits() }} <span class="text-sm font-normal text-[#5A5561]">piezas</span>
          </p>
          <div class="flex items-center space-x-1.5 mt-2 text-xs text-[#5A5561] font-medium">
            <span class="w-2 h-2 rounded-full bg-[#16A34A]"></span>
            <span>Asignadas en {{ inventoryService.locations().length }} ubicaciones</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-[#E8E2DA] shadow-2xs">
          <div class="flex items-center justify-between text-[#5A5561] mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-[#9B94A3]">Despachos Activos</span>
            <div class="w-8 h-8 rounded-lg bg-[#F5EBF7] text-[#38133E] flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">local_shipping</span>
            </div>
          </div>
          <p class="text-2xl font-bold text-[#17141A] tracking-tight">
            {{ activeDispatchesCount() }}
          </p>
          <div class="flex items-center space-x-1.5 mt-2 text-xs text-amber-700 font-medium">
            <span class="material-symbols-outlined text-[16px]">priority_high</span>
            <span>Envíos activos en tránsito</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-[#E8E2DA] shadow-2xs">
          <div class="flex items-center justify-between text-[#5A5561] mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-[#9B94A3]">SKUs Archivados</span>
            <div class="w-8 h-8 rounded-lg bg-[#F5EBF7] text-[#38133E] flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">style</span>
            </div>
          </div>
          <p class="text-2xl font-bold text-[#17141A] tracking-tight">
            {{ archiveService.products().length }}
          </p>
          <div class="flex items-center space-x-1.5 mt-2 text-xs text-[#5A5561]">
            <span>Colecciones permanentes y de temporada</span>
          </div>
        </div>
      </div>

      <!-- Sección principal: Matrix de boutiques y despachos -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- Izquierda: Red global de boutiques -->
        <div class="lg:col-span-2 bg-white rounded-xl border border-[#E8E2DA] p-6 shadow-2xs">
          <div class="flex items-center justify-between pb-4 border-b border-[#E8E2DA]">
            <div>
              <h2 class="text-base font-bold text-[#17141A]">Nodos Globales de Boutique</h2>
              <p class="text-xs text-[#5A5561]">Balance de stock físico y telemetría de reservas activas</p>
            </div>
            <button
              (click)="navigate.emit('inventory')"
              class="text-xs font-bold text-[#38133E] hover:text-[#260B2B] transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <span>Ver Matriz Completa</span>
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          <div class="divide-y divide-[#E8E2DA] mt-2">
            <div *ngFor="let loc of inventoryService.locations()" class="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-start space-x-3">
                <div class="w-9 h-9 rounded-lg bg-[#F3EFEA] border border-[#E8E2DA] flex items-center justify-center text-[#17141A] font-bold text-xs">
                  {{ loc.ciudad.substring(0, 3).toUpperCase() }}
                </div>
                <div>
                  <p class="text-sm font-semibold text-[#17141A]">{{ loc.nombre }}</p>
                  <p class="text-xs text-[#5A5561]">{{ loc.direccion }}</p>
                </div>
              </div>

              <div class="flex items-center space-x-4 sm:text-right">
                <div class="min-w-[70px]">
                  <p class="text-sm font-bold text-[#17141A]">
                    {{ getLocationStockCount(loc.codigoSucursal) }} pzs
                  </p>
                  <p class="text-[11px] text-[#16A34A] font-medium">Óptimo</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Derecha: Despachos recientes -->
        <div class="bg-white rounded-xl border border-[#E8E2DA] p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between pb-4 border-b border-[#E8E2DA]">
              <h2 class="text-base font-bold text-[#17141A]">Despachos en Vivo</h2>
              <button
                (click)="navigate.emit('logistics')"
                class="text-xs font-bold text-[#38133E] hover:text-[#260B2B] cursor-pointer"
              >
                Todos ({{ dispatchService.dispatches().length }})
              </button>
            </div>

            <div class="space-y-3 mt-4">
              <div
                *ngFor="let order of dispatchService.dispatches().slice(0, 3)"
                class="p-3 rounded-lg bg-[#FAF8F5] border border-[#E8E2DA] space-y-1.5 hover:border-[#38133E]/40 transition-colors"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-[#17141A]">{{ order.referencia }}</span>
                  <span class="px-2 py-0.5 rounded-full bg-[#F5EBF7] text-[#38133E] border border-[#E8E2DA] text-[10px] font-bold uppercase tracking-wider">
                    Despacho
                  </span>
                </div>

                <p *ngIf="order.motivo" class="text-xs text-[#5A5561] truncate">{{ order.motivo }}</p>
                <p *ngIf="!order.motivo" class="text-xs text-[#9B94A3] italic">Sin motivo registrado</p>

                <div *ngIf="order.movimientos && order.movimientos.length > 0" class="flex items-center justify-between pt-1 border-t border-[#E8E2DA] text-xs">
                  <span class="text-[#5A5561]">{{ order.movimientos.length }} movimiento(s)</span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-[#E8E2DA]">
            <button
              (click)="navigate.emit('logistics')"
              class="w-full py-2 bg-[#38133E] text-white rounded-lg text-xs font-bold hover:bg-[#260B2B] transition-colors text-center block shadow-xs cursor-pointer"
            >
              Registrar Nuevo Despacho
            </button>
          </div>
        </div>
      </div>

      <!-- Prendas destacadas del archivo permanente -->
      <div class="bg-white rounded-xl border border-[#E8E2DA] p-6 shadow-2xs">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-base font-bold text-[#17141A]">Prendas Destacadas del Archivo Permanente</h2>
            <p class="text-xs text-[#5A5561]">Siluetas arquitectónicas y fabricaciones con materiales certificados</p>
          </div>
          <button
            (click)="navigate.emit('archive')"
            class="px-3 py-1.5 bg-white border border-[#E8E2DA] text-[#17141A] hover:bg-[#F3EFEA] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Explorar Archivo Completo →
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            *ngFor="let item of archiveService.products().slice(0, 3)"
            class="group bg-white rounded-xl overflow-hidden border border-[#E8E2DA] hover:border-[#38133E]/50 hover:shadow-sm transition-all flex flex-col justify-between"
          >
            <div class="aspect-[4/3] w-full overflow-hidden relative bg-[#F3EFEA]">
              <img
                [src]="item.imagen_url"
                [alt]="item.nombre"
                class="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
              />
              <div class="absolute top-2.5 left-2.5 bg-[#17141A]/80 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                ID {{ item.idProducto }}
              </div>
              <div class="absolute bottom-2.5 right-2.5 bg-white/95 backdrop-blur-xs text-[#17141A] px-2 py-0.5 rounded text-xs font-bold shadow-xs">
                {{ item.venta.toLocaleString() }} Bs
              </div>
            </div>

            <div class="p-4 flex-1 flex flex-col justify-between">
              <div>
                <p class="text-[10px] font-bold text-[#38133E] uppercase tracking-wider">
                  {{ item.coleccion_nombre }}
                </p>
                <h3 class="text-sm font-bold text-[#17141A] mt-1 leading-snug">{{ item.nombre }}</h3>
                <p class="text-xs text-[#5A5561] mt-1 line-clamp-2 leading-relaxed">{{ item.descripcion }}</p>
              </div>

              <div class="mt-4 pt-3 border-t border-[#E8E2DA] flex items-center justify-between text-xs">
                <span class="text-[#5A5561] font-medium">{{ item.color }}</span>
                <span class="text-[#16A34A] font-semibold flex items-center space-x-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>
                  <span>Activo</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      </ng-container>

      <!-- Tab 2: Proyecciones ML (Solo Administrador) -->
      <div *ngIf="activeTab() === 'ml' && isAdmin()">
        <app-ml-projections></app-ml-projections>
      </div>

    </div>
  `
})
export class DashboardComponent implements OnInit {
  @Output() navigate = new EventEmitter<AppView>();

  activeTab = signal<'operaciones' | 'ml'>('operaciones');

  constructor(
    public archiveService: ArchiveService,
    public inventoryService: InventoryService,
    public dispatchService: DispatchService,
    public authService: AuthService
  ) {}

  isAdmin(): boolean {
    const rol = this.authService.currentUser()?.rol;
    return rol === 'Administrador' || this.authService.isSuperAdmin();
  }

  ngOnInit() {
    this.inventoryService.loadLocations();
    this.inventoryService.loadStock();
    this.dispatchService.loadDispatches();
    this.archiveService.loadProducts();
  }

  totalValuation = computed(() => {
    let sum = 0;
    for (const item of this.archiveService.products()) {
      sum += item.venta;
    }
    return sum;
  });

  totalUnits = computed(() => {
    return this.inventoryService.stock().reduce((acc, curr) => acc + curr.cantidad_actual, 0);
  });

  activeDispatchesCount = computed(() => {
    return this.dispatchService.dispatches().length;
  });

  getLocationStockCount(codigoSucursal: number): number {
    return this.inventoryService
      .stock()
      .filter(s => s.codigoSucursal === codigoSucursal)
      .reduce((acc, curr) => acc + curr.cantidad_actual, 0);
  }

  getLocationName(codigoSucursal: number): string {
    return this.inventoryService.locations().find(l => l.codigoSucursal === codigoSucursal)?.nombre || 'N/A';
  }
}
