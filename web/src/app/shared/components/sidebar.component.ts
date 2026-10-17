import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

export type AppView =
  | 'dashboard'
  | 'archive'
  | 'inventory'
  | 'logistics'
  | 'suppliers'
  | 'seasons'
  | 'team'
  | 'reservations'
  | 'pos'
  | 'locations'
  | 'reports'
  | 'indicadores'
  | 'subscription'
  | 'platform';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="w-64 bg-white text-gray-900 flex flex-col justify-between h-full border-r border-gray-200 select-none">

      <!-- Sección superior -->
      <div class="flex-1 overflow-y-auto">

        <!-- Encabezado de marca y empresa en sidebar -->
        <div class="p-5 border-b border-gray-100">
          <div *ngIf="isSuperAdmin; else tenantHeader" class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 bg-purple-700 rounded-xl flex items-center justify-center text-white font-bold shadow-xs">
                <span class="material-symbols-outlined text-[20px]">admin_panel_settings</span>
              </div>
              <div>
                <span class="font-bold text-sm tracking-tight text-gray-900 block leading-tight">Plataforma SaaS</span>
                <span class="text-[10px] uppercase tracking-wider text-purple-600 font-bold">Operador Global</span>
              </div>
            </div>
            <span class="text-[9px] font-black px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-200 uppercase tracking-wider">
              SUPERADMIN
            </span>
          </div>

          <ng-template #tenantHeader>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3 min-w-0">
                <div class="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
                  {{ empresaNombre.substring(0, 1).toUpperCase() }}
                </div>
                <div class="min-w-0">
                  <span class="font-bold text-sm tracking-tight text-gray-900 block leading-tight truncate">
                    {{ empresaNombre }}
                  </span>
                  <span class="text-[10px] uppercase tracking-wider text-gray-400 font-bold block truncate">
                    {{ empresaSlug }}
                  </span>
                </div>
              </div>
              <span
                class="text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 shadow-2xs"
                [ngClass]="getPlanBadgeColor(planCodigo)"
              >
                {{ planNombre }}
              </span>
            </div>
          </ng-template>
        </div>

        <!-- Navegación: Vista SuperAdmin -->
        <nav *ngIf="isSuperAdmin; else tenantNav" class="p-4 space-y-1">
          <div class="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2 px-2">
            Panel de Operador
          </div>

          <button
            (click)="selectView('platform')"
            [class.bg-purple-50]="currentView === 'platform'"
            [class.text-purple-700]="currentView === 'platform'"
            [class.font-semibold]="currentView === 'platform'"
            [class.text-gray-600]="currentView !== 'platform'"
            class="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors hover:bg-purple-50/50 hover:text-purple-900 cursor-pointer group"
          >
            <div
              [class.bg-purple-700]="currentView === 'platform'"
              [class.text-white]="currentView === 'platform'"
              [class.bg-gray-100]="currentView !== 'platform'"
              [class.text-gray-500]="currentView !== 'platform'"
              class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">domain</span>
            </div>
            <span class="font-medium tracking-tight">Panel de Plataforma</span>
          </button>
        </nav>

        <!-- Navegación: Vista Tenant (filtrada por features del plan) -->
        <ng-template #tenantNav>
          <nav class="p-4 space-y-1">
            <div class="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2 px-2">
              Módulos Principales
            </div>

            <!-- Centro de Operaciones -->
            <button
              (click)="selectView('dashboard')"
              [class.bg-indigo-50]="currentView === 'dashboard'"
              [class.text-indigo-700]="currentView === 'dashboard'"
              [class.font-semibold]="currentView === 'dashboard'"
              [class.text-gray-600]="currentView !== 'dashboard'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'dashboard'"
                [class.text-white]="currentView === 'dashboard'"
                [class.bg-gray-100]="currentView !== 'dashboard'"
                [class.text-gray-500]="currentView !== 'dashboard'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">dashboard</span>
              </div>
              <span class="font-medium tracking-tight">Centro de Operaciones</span>
            </button>

            <!-- Archivo y Catálogo -->
            <button
              (click)="selectView('archive')"
              [class.bg-indigo-50]="currentView === 'archive'"
              [class.text-indigo-700]="currentView === 'archive'"
              [class.font-semibold]="currentView === 'archive'"
              [class.text-gray-600]="currentView !== 'archive'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'archive'"
                [class.text-white]="currentView === 'archive'"
                [class.bg-gray-100]="currentView !== 'archive'"
                [class.text-gray-500]="currentView !== 'archive'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">checkroom</span>
              </div>
              <span class="font-medium tracking-tight">Archivo y Catálogo</span>
            </button>

            <!-- Inventario Global (Gating: inventario) -->
            <button
              *ngIf="canViewInventory"
              (click)="selectView('inventory')"
              [class.bg-indigo-50]="currentView === 'inventory'"
              [class.text-indigo-700]="currentView === 'inventory'"
              [class.font-semibold]="currentView === 'inventory'"
              [class.text-gray-600]="currentView !== 'inventory'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'inventory'"
                [class.text-white]="currentView === 'inventory'"
                [class.bg-gray-100]="currentView !== 'inventory'"
                [class.text-gray-500]="currentView !== 'inventory'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">inventory_2</span>
              </div>
              <span class="font-medium tracking-tight">Inventario Global</span>
            </button>

            <!-- Despachos y Logística (Gating: despachos) -->
            <button
              *ngIf="canViewLogistics"
              (click)="selectView('logistics')"
              [class.bg-indigo-50]="currentView === 'logistics'"
              [class.text-indigo-700]="currentView === 'logistics'"
              [class.font-semibold]="currentView === 'logistics'"
              [class.text-gray-600]="currentView !== 'logistics'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'logistics'"
                [class.text-white]="currentView === 'logistics'"
                [class.bg-gray-100]="currentView !== 'logistics'"
                [class.text-gray-500]="currentView !== 'logistics'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">local_shipping</span>
              </div>
              <span class="font-medium tracking-tight">Despachos y VIP</span>
            </button>

            <!-- Proveedores -->
            <button
              (click)="selectView('suppliers')"
              [class.bg-indigo-50]="currentView === 'suppliers'"
              [class.text-indigo-700]="currentView === 'suppliers'"
              [class.font-semibold]="currentView === 'suppliers'"
              [class.text-gray-600]="currentView !== 'suppliers'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'suppliers'"
                [class.text-white]="currentView === 'suppliers'"
                [class.bg-gray-100]="currentView !== 'suppliers'"
                [class.text-gray-500]="currentView !== 'suppliers'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">handshake</span>
              </div>
              <span class="font-medium tracking-tight">Proveedores</span>
            </button>

            <!-- Temporadas y Colecciones -->
            <button
              (click)="selectView('seasons')"
              [class.bg-indigo-50]="currentView === 'seasons'"
              [class.text-indigo-700]="currentView === 'seasons'"
              [class.font-semibold]="currentView === 'seasons'"
              [class.text-gray-600]="currentView !== 'seasons'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'seasons'"
                [class.text-white]="currentView === 'seasons'"
                [class.bg-gray-100]="currentView !== 'seasons'"
                [class.text-gray-500]="currentView !== 'seasons'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">event_note</span>
              </div>
              <span class="font-medium tracking-tight">Temporadas y Colecciones</span>
            </button>

            <!-- Reservas (Gating: reservas) -->
            <button
              *ngIf="canViewReservations"
              (click)="selectView('reservations')"
              [class.bg-indigo-50]="currentView === 'reservations'"
              [class.text-indigo-700]="currentView === 'reservations'"
              [class.font-semibold]="currentView === 'reservations'"
              [class.text-gray-600]="currentView !== 'reservations'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'reservations'"
                [class.text-white]="currentView === 'reservations'"
                [class.bg-gray-100]="currentView !== 'reservations'"
                [class.text-gray-500]="currentView !== 'reservations'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">event_available</span>
              </div>
              <span class="font-medium tracking-tight">Reservas</span>
            </button>

            <!-- Caja / POS (Gating: pos + venta.crear) -->
            <button
              *ngIf="canOpenPos"
              (click)="selectView('pos')"
              [class.bg-indigo-50]="currentView === 'pos'"
              [class.text-indigo-700]="currentView === 'pos'"
              [class.font-semibold]="currentView === 'pos'"
              [class.text-gray-600]="currentView !== 'pos'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'pos'"
                [class.text-white]="currentView === 'pos'"
                [class.bg-gray-100]="currentView !== 'pos'"
                [class.text-gray-500]="currentView !== 'pos'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">point_of_sale</span>
              </div>
              <span class="font-medium tracking-tight">Caja</span>
            </button>

            <div class="pt-4 text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2 px-2">
              Administración
            </div>

            <!-- Personal y Nodos -->
            <button
              (click)="selectView('team')"
              [class.bg-indigo-50]="currentView === 'team'"
              [class.text-indigo-700]="currentView === 'team'"
              [class.font-semibold]="currentView === 'team'"
              [class.text-gray-600]="currentView !== 'team'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'team'"
                [class.text-white]="currentView === 'team'"
                [class.bg-gray-100]="currentView !== 'team'"
                [class.text-gray-500]="currentView !== 'team'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">shield_person</span>
              </div>
              <span class="font-medium tracking-tight">Personal y Nodos</span>
            </button>

            <!-- Ciudades y Sucursales -->
            <button
              (click)="selectView('locations')"
              [class.bg-indigo-50]="currentView === 'locations'"
              [class.text-indigo-700]="currentView === 'locations'"
              [class.font-semibold]="currentView === 'locations'"
              [class.text-gray-600]="currentView !== 'locations'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'locations'"
                [class.text-white]="currentView === 'locations'"
                [class.bg-gray-100]="currentView !== 'locations'"
                [class.text-gray-500]="currentView !== 'locations'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">location_city</span>
              </div>
              <span class="font-medium tracking-tight">Ciudades y Sucursales</span>
            </button>

            <!-- Reportes (Gating: reportes + reporte.ver) -->
            <button
              *ngIf="canViewReports"
              (click)="selectView('reports')"
              [class.bg-indigo-50]="currentView === 'reports'"
              [class.text-indigo-700]="currentView === 'reports'"
              [class.font-semibold]="currentView === 'reports'"
              [class.text-gray-600]="currentView !== 'reports'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'reports'"
                [class.text-white]="currentView === 'reports'"
                [class.bg-gray-100]="currentView !== 'reports'"
                [class.text-gray-500]="currentView !== 'reports'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">summarize</span>
              </div>
              <span class="font-medium tracking-tight">Reportes</span>
            </button>

            <!-- Indicadores (Gating: reportes_avanzados + reporte.ver) -->
            <button
              *ngIf="canViewIndicadores"
              (click)="selectView('indicadores')"
              [class.bg-indigo-50]="currentView === 'indicadores'"
              [class.text-indigo-700]="currentView === 'indicadores'"
              [class.font-semibold]="currentView === 'indicadores'"
              [class.text-gray-600]="currentView !== 'indicadores'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div
                [class.bg-indigo-600]="currentView === 'indicadores'"
                [class.text-white]="currentView === 'indicadores'"
                [class.bg-gray-100]="currentView !== 'indicadores'"
                [class.text-gray-500]="currentView !== 'indicadores'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">insights</span>
              </div>
              <span class="font-medium tracking-tight">Indicadores</span>
            </button>

            <!-- Mi Suscripción (Nuevo) -->
            <button
              (click)="selectView('subscription')"
              [class.bg-indigo-50]="currentView === 'subscription'"
              [class.text-indigo-700]="currentView === 'subscription'"
              [class.font-semibold]="currentView === 'subscription'"
              [class.text-gray-600]="currentView !== 'subscription'"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
            >
              <div class="flex items-center space-x-3 min-w-0">
                <div
                  [class.bg-indigo-600]="currentView === 'subscription'"
                  [class.text-white]="currentView === 'subscription'"
                  [class.bg-gray-100]="currentView !== 'subscription'"
                  [class.text-gray-500]="currentView !== 'subscription'"
                  class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
                >
                  <span class="material-symbols-outlined text-[18px]">workspace_premium</span>
                </div>
                <span class="font-medium tracking-tight truncate">Mi Suscripción</span>
              </div>
              <span
                *ngIf="isSubscriptionInactive"
                class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 shrink-0"
              >
                Pagar
              </span>
            </button>
          </nav>
        </ng-template>
      </div>

      <!-- Sección inferior: SuperAdmin o Bóveda y acciones -->
      <div class="p-4 border-t border-gray-100 space-y-2">
        <div *ngIf="isSuperAdmin; else vaultBox" class="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div class="flex items-center space-x-2 mb-1">
            <span class="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
            <p class="text-[11px] font-bold text-purple-900 uppercase tracking-tight">Control Global Activo</p>
          </div>
          <p class="text-xs text-purple-700 leading-relaxed">
            Gestión multitenant sin restricción de empresa.
          </p>
        </div>

        <ng-template #vaultBox>
          <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div class="flex items-center space-x-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <p class="text-[11px] font-bold text-gray-900 uppercase tracking-tight">Bóveda de Zurich Activa</p>
            </div>
            <p class="text-xs text-gray-500 leading-relaxed">
              Sincronizada con ateliers de París y Ginza.
            </p>
          </div>
        </ng-template>

        <button
          *ngIf="!isSuperAdmin"
          (click)="viewAuthScreen.emit()"
          class="w-full py-2 px-3 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
        >
          <span class="material-symbols-outlined text-[16px] text-gray-500">lock_reset</span>
          <span>Cambiar a Vista de Inicio de Sesión</span>
        </button>

        <button
          *ngIf="isSuperAdmin"
          (click)="onLogout()"
          class="w-full py-2 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
        >
          <span class="material-symbols-outlined text-[16px]">logout</span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  `
})
export class SidebarComponent {
  @Input() currentView: AppView = 'dashboard';
  @Output() viewChange = new EventEmitter<AppView>();
  @Output() viewAuthScreen = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  constructor(private authService: AuthService) {}

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  get empresaNombre(): string {
    return this.authService.empresa()?.nombre || 'YouShop';
  }

  get empresaSlug(): string {
    return this.authService.empresa()?.slug || 'youshop';
  }

  get planNombre(): string {
    return this.authService.plan()?.nombre || 'Básico';
  }

  get planCodigo(): string {
    return this.authService.plan()?.codigo || 'basico';
  }

  get canViewInventory(): boolean {
    return this.authService.hasFeature('inventario');
  }

  get canViewLogistics(): boolean {
    return this.authService.hasFeature('despachos');
  }

  get canViewReservations(): boolean {
    return this.authService.hasFeature('reservas');
  }

  get canOpenPos(): boolean {
    const hasPerm = this.authService.currentUser()?.permisos.includes('venta.crear') ?? false;
    return hasPerm && this.authService.hasFeature('pos');
  }

  get canViewReports(): boolean {
    const hasPerm = this.authService.currentUser()?.permisos.includes('reporte.ver') ?? false;
    return hasPerm && this.authService.hasFeature('reportes');
  }

  get canViewIndicadores(): boolean {
    const hasPerm = this.authService.currentUser()?.permisos.includes('reporte.ver') ?? false;
    return hasPerm && this.authService.hasFeature('reportes_avanzados');
  }

  get isSubscriptionInactive(): boolean {
    const s = this.authService.suscripcion();
    return !!s?.estado && s.estado !== 'activa';
  }

  selectView(view: AppView) {
    this.viewChange.emit(view);
  }

  onLogout() {
    this.authService.logout();
    this.logout.emit();
  }

  getPlanBadgeColor(codigo: string): string {
    const c = (codigo || '').toLowerCase();
    if (c === 'avanzado') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (c === 'intermedio') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}
