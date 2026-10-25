import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { OutboxService } from '../../core/services/outbox.service';
import { SyncService } from '../../core/services/sync.service';

export type AppView =
  | 'dashboard'
  | 'archive'
  | 'inventory'
  | 'discrepancies'
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
  | 'platform'
  | 'sync-queue';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="w-64 bg-white text-[#17141A] flex flex-col justify-between h-full border-r border-[#E8E2DA] select-none">

      <!-- Sección superior -->
      <div class="flex-1 overflow-y-auto">

        <!-- Encabezado de marca y empresa en sidebar -->
        <div class="p-5 border-b border-[#E8E2DA]">
          <div *ngIf="isSuperAdmin; else tenantHeader" class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 bg-[#38133E] rounded-xl flex items-center justify-center text-white font-bold shadow-xs">
                <span class="material-symbols-outlined text-[20px]">admin_panel_settings</span>
              </div>
              <div>
                <span class="font-bold text-sm tracking-tight text-[#17141A] block leading-tight">Plataforma SaaS</span>
                <span class="text-[10px] uppercase tracking-wider text-[#38133E] font-bold">Operador Global</span>
              </div>
            </div>
            <span class="text-[9px] font-black px-2 py-0.5 bg-[#F5EBF7] text-[#38133E] rounded-full border border-[#E8E2DA] uppercase tracking-wider">
              SUPERADMIN
            </span>
          </div>

          <ng-template #tenantHeader>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3 min-w-0">
                <div class="w-9 h-9 bg-[#38133E] rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
                  {{ empresaNombre.substring(0, 1).toUpperCase() }}
                </div>
                <div class="min-w-0">
                  <span class="font-bold text-sm tracking-tight text-[#17141A] block leading-tight truncate">
                    {{ empresaNombre }}
                  </span>
                  <span class="text-[10px] uppercase tracking-wider text-[#9B94A3] font-bold block truncate">
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
          <div class="text-[10px] uppercase tracking-widest text-[#9B94A3] font-bold mb-2 px-2">
            Panel de Operador
          </div>

          <button
            (click)="selectView('platform')"
            [class.bg-ys-primary-soft]="currentView === 'platform'"
            [class.text-ys-primary]="currentView === 'platform'"
            [class.font-semibold]="currentView === 'platform'"
            [class.text-ys-muted]="currentView !== 'platform'"
            class="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors hover:bg-[#F5EBF7] hover:text-[#38133E] cursor-pointer group"
          >
            <div
              [class.bg-ys-primary]="currentView === 'platform'"
              [class.text-white]="currentView === 'platform'"
              [class.bg-ys-surface]="currentView !== 'platform'"
              [class.text-ys-muted]="currentView !== 'platform'"
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
            <div class="text-[10px] uppercase tracking-widest text-[#9B94A3] font-bold mb-2 px-2">
              Módulos Principales
            </div>

            <!-- Centro de Operaciones -->
            <button
              (click)="selectView('dashboard')"
              [class.bg-ys-primary-soft]="currentView === 'dashboard'"
              [class.text-ys-primary]="currentView === 'dashboard'"
              [class.font-semibold]="currentView === 'dashboard'"
              [class.text-ys-muted]="currentView !== 'dashboard'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'dashboard'"
                [class.text-white]="currentView === 'dashboard'"
                [class.bg-ys-surface]="currentView !== 'dashboard'"
                [class.text-ys-muted]="currentView !== 'dashboard'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">dashboard</span>
              </div>
              <span class="font-medium tracking-tight">Centro de Operaciones</span>
            </button>

            <!-- Archivo y Catálogo -->
            <button
              (click)="selectView('archive')"
              [class.bg-ys-primary-soft]="currentView === 'archive'"
              [class.text-ys-primary]="currentView === 'archive'"
              [class.font-semibold]="currentView === 'archive'"
              [class.text-ys-muted]="currentView !== 'archive'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'archive'"
                [class.text-white]="currentView === 'archive'"
                [class.bg-ys-surface]="currentView !== 'archive'"
                [class.text-ys-muted]="currentView !== 'archive'"
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
              [class.bg-ys-primary-soft]="currentView === 'inventory'"
              [class.text-ys-primary]="currentView === 'inventory'"
              [class.font-semibold]="currentView === 'inventory'"
              [class.text-ys-muted]="currentView !== 'inventory'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'inventory'"
                [class.text-white]="currentView === 'inventory'"
                [class.bg-ys-surface]="currentView !== 'inventory'"
                [class.text-ys-muted]="currentView !== 'inventory'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">inventory_2</span>
              </div>
              <span class="font-medium tracking-tight">Inventario Global</span>
            </button>

            <!-- Discrepancias Offline (Gating: inventario.ajustar) -->
            <button
              *ngIf="canAdjustInventory"
              (click)="selectView('discrepancies')"
              [class.bg-ys-primary-soft]="currentView === 'discrepancies'"
              [class.text-ys-primary]="currentView === 'discrepancies'"
              [class.font-semibold]="currentView === 'discrepancies'"
              [class.text-ys-muted]="currentView !== 'discrepancies'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'discrepancies'"
                [class.text-white]="currentView === 'discrepancies'"
                [class.bg-ys-surface]="currentView !== 'discrepancies'"
                [class.text-ys-muted]="currentView !== 'discrepancies'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">rule</span>
              </div>
              <span class="font-medium tracking-tight">Discrepancias Stock</span>
            </button>

            <!-- Despachos y Logística (Gating: despachos) -->
            <button
              *ngIf="canViewLogistics"
              (click)="selectView('logistics')"
              [class.bg-ys-primary-soft]="currentView === 'logistics'"
              [class.text-ys-primary]="currentView === 'logistics'"
              [class.font-semibold]="currentView === 'logistics'"
              [class.text-ys-muted]="currentView !== 'logistics'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'logistics'"
                [class.text-white]="currentView === 'logistics'"
                [class.bg-ys-surface]="currentView !== 'logistics'"
                [class.text-ys-muted]="currentView !== 'logistics'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">local_shipping</span>
              </div>
              <span class="font-medium tracking-tight">Despachos y VIP</span>
            </button>

            <!-- Proveedores -->
            <button
              (click)="selectView('suppliers')"
              [class.bg-ys-primary-soft]="currentView === 'suppliers'"
              [class.text-ys-primary]="currentView === 'suppliers'"
              [class.font-semibold]="currentView === 'suppliers'"
              [class.text-ys-muted]="currentView !== 'suppliers'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'suppliers'"
                [class.text-white]="currentView === 'suppliers'"
                [class.bg-ys-surface]="currentView !== 'suppliers'"
                [class.text-ys-muted]="currentView !== 'suppliers'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">handshake</span>
              </div>
              <span class="font-medium tracking-tight">Proveedores</span>
            </button>

            <!-- Temporadas y Colecciones -->
            <button
              (click)="selectView('seasons')"
              [class.bg-ys-primary-soft]="currentView === 'seasons'"
              [class.text-ys-primary]="currentView === 'seasons'"
              [class.font-semibold]="currentView === 'seasons'"
              [class.text-ys-muted]="currentView !== 'seasons'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'seasons'"
                [class.text-white]="currentView === 'seasons'"
                [class.bg-ys-surface]="currentView !== 'seasons'"
                [class.text-ys-muted]="currentView !== 'seasons'"
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
              [class.bg-ys-primary-soft]="currentView === 'reservations'"
              [class.text-ys-primary]="currentView === 'reservations'"
              [class.font-semibold]="currentView === 'reservations'"
              [class.text-ys-muted]="currentView !== 'reservations'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'reservations'"
                [class.text-white]="currentView === 'reservations'"
                [class.bg-ys-surface]="currentView !== 'reservations'"
                [class.text-ys-muted]="currentView !== 'reservations'"
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
              [class.bg-ys-primary-soft]="currentView === 'pos'"
              [class.text-ys-primary]="currentView === 'pos'"
              [class.font-semibold]="currentView === 'pos'"
              [class.text-ys-muted]="currentView !== 'pos'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'pos'"
                [class.text-white]="currentView === 'pos'"
                [class.bg-ys-surface]="currentView !== 'pos'"
                [class.text-ys-muted]="currentView !== 'pos'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">point_of_sale</span>
              </div>
              <span class="font-medium tracking-tight">Caja</span>
            </button>

            <!-- Cola de Sincronización (Gating: Cajero o Encargado de Sucursal) -->
            <button
              *ngIf="canViewSyncQueue"
              (click)="selectView('sync-queue')"
              [class.bg-ys-primary-soft]="currentView === 'sync-queue'"
              [class.text-ys-primary]="currentView === 'sync-queue'"
              [class.font-semibold]="currentView === 'sync-queue'"
              [class.text-ys-muted]="currentView !== 'sync-queue'"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div class="flex items-center space-x-3 min-w-0">
                <div
                  [class.bg-ys-primary]="currentView === 'sync-queue'"
                  [class.text-white]="currentView === 'sync-queue'"
                  [class.bg-ys-surface]="currentView !== 'sync-queue'"
                  [class.text-ys-muted]="currentView !== 'sync-queue'"
                  class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
                >
                  <span class="material-symbols-outlined text-[18px]">sync_alt</span>
                </div>
                <span class="font-medium tracking-tight truncate">Cola de Sincronización</span>
              </div>
              <span
                *ngIf="syncService.pendingCount() > 0"
                class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0"
              >
                {{ syncService.pendingCount() }}
              </span>
            </button>

            <div class="pt-4 text-[10px] uppercase tracking-widest text-[#9B94A3] font-bold mb-2 px-2">
              Administración
            </div>

            <!-- Personal y Nodos -->
            <button
              (click)="selectView('team')"
              [class.bg-ys-primary-soft]="currentView === 'team'"
              [class.text-ys-primary]="currentView === 'team'"
              [class.font-semibold]="currentView === 'team'"
              [class.text-ys-muted]="currentView !== 'team'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'team'"
                [class.text-white]="currentView === 'team'"
                [class.bg-ys-surface]="currentView !== 'team'"
                [class.text-ys-muted]="currentView !== 'team'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">shield_person</span>
              </div>
              <span class="font-medium tracking-tight">Personal y Nodos</span>
            </button>

            <!-- Ciudades y Sucursales -->
            <button
              (click)="selectView('locations')"
              [class.bg-ys-primary-soft]="currentView === 'locations'"
              [class.text-ys-primary]="currentView === 'locations'"
              [class.font-semibold]="currentView === 'locations'"
              [class.text-ys-muted]="currentView !== 'locations'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'locations'"
                [class.text-white]="currentView === 'locations'"
                [class.bg-ys-surface]="currentView !== 'locations'"
                [class.text-ys-muted]="currentView !== 'locations'"
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
              [class.bg-ys-primary-soft]="currentView === 'reports'"
              [class.text-ys-primary]="currentView === 'reports'"
              [class.font-semibold]="currentView === 'reports'"
              [class.text-ys-muted]="currentView !== 'reports'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'reports'"
                [class.text-white]="currentView === 'reports'"
                [class.bg-ys-surface]="currentView !== 'reports'"
                [class.text-ys-muted]="currentView !== 'reports'"
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
              [class.bg-ys-primary-soft]="currentView === 'indicadores'"
              [class.text-ys-primary]="currentView === 'indicadores'"
              [class.font-semibold]="currentView === 'indicadores'"
              [class.text-ys-muted]="currentView !== 'indicadores'"
              class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div
                [class.bg-ys-primary]="currentView === 'indicadores'"
                [class.text-white]="currentView === 'indicadores'"
                [class.bg-ys-surface]="currentView !== 'indicadores'"
                [class.text-ys-muted]="currentView !== 'indicadores'"
                class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">insights</span>
              </div>
              <span class="font-medium tracking-tight">Indicadores</span>
            </button>

            <!-- Mi Suscripción (Nuevo) -->
            <button
              (click)="selectView('subscription')"
              [class.bg-ys-primary-soft]="currentView === 'subscription'"
              [class.text-ys-primary]="currentView === 'subscription'"
              [class.font-semibold]="currentView === 'subscription'"
              [class.text-ys-muted]="currentView !== 'subscription'"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer group"
            >
              <div class="flex items-center space-x-3 min-w-0">
                <div
                  [class.bg-ys-primary]="currentView === 'subscription'"
                  [class.text-white]="currentView === 'subscription'"
                  [class.bg-ys-surface]="currentView !== 'subscription'"
                  [class.text-ys-muted]="currentView !== 'subscription'"
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
      <div class="p-4 border-t border-[#E8E2DA] space-y-2">
        <div *ngIf="isSuperAdmin; else vaultBox" class="p-3 bg-[#F5EBF7] rounded-lg border border-[#E8E2DA]">
          <div class="flex items-center space-x-2 mb-1">
            <span class="w-2 h-2 rounded-full bg-[#38133E] animate-pulse"></span>
            <p class="text-[11px] font-bold text-[#38133E] uppercase tracking-tight">Control Global Activo</p>
          </div>
          <p class="text-xs text-[#5A5561] leading-relaxed">
            Gestión multitenant sin restricción de empresa.
          </p>
        </div>

        <ng-template #vaultBox>
          <div class="p-3 bg-[#FAF8F5] rounded-lg border border-[#E8E2DA]">
            <div class="flex items-center space-x-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-[#16A34A]"></span>
              <p class="text-[11px] font-bold text-[#17141A] uppercase tracking-tight">Bóveda de Zurich Activa</p>
            </div>
            <p class="text-xs text-[#5A5561] leading-relaxed">
              Sincronizada con ateliers de París y Ginza.
            </p>
          </div>
        </ng-template>

        <button
          *ngIf="!isSuperAdmin"
          (click)="viewAuthScreen.emit()"
          class="w-full py-2 px-3 rounded-lg bg-white hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#17141A] font-semibold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
        >
          <span class="material-symbols-outlined text-[16px] text-[#5A5561]">lock_reset</span>
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

  constructor(
    private authService: AuthService,
    private outboxService: OutboxService,
    public syncService: SyncService,
  ) {}

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

  get canAdjustInventory(): boolean {
    return this.authService.hasPermission('inventario.ajustar');
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

  get canViewSyncQueue(): boolean {
    const rol = this.authService.currentUser()?.rol;
    return rol === 'Cajero' || rol === 'Encargado de Sucursal' || rol === 'Administrador';
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
    const pending = this.outboxService.totalActiveCount();
    if (pending > 0) {
      const msg = `Tenés ${pending} ${pending === 1 ? 'operación' : 'operaciones'} sin sincronizar. Si cerrás sesión, quedarán guardadas localmente hasta que vuelvas a iniciar sesión con este usuario. ¿Deseás continuar?`;
      if (!window.confirm(msg)) {
        return;
      }
    }
    this.authService.logout();
    this.logout.emit();
  }

  getPlanBadgeColor(codigo: string): string {
    const c = (codigo || '').toLowerCase();
    if (c === 'avanzado') return 'bg-[#F5EBF7] text-[#38133E] border-[#E8E2DA]';
    if (c === 'intermedio') return 'bg-[#F3EFEA] text-[#17141A] border-[#E8E2DA]';
    return 'bg-[#FAF8F5] text-[#5A5561] border-[#E8E2DA]';
  }
}
