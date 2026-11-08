import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatformService } from '../../core/services/platform.service';
import { NotificationService } from '../../core/services/notification.service';
import { BackupTipo, CreateEmpresaIn, PlatformEmpresa, PlatformPlan, TenantBackup } from '../../core/models';

@Component({
  selector: 'app-platform',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

      <!-- Encabezado de la vista -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E8E2DA]">
        <div>
          <div class="flex items-center space-x-2 text-xs font-bold text-[#38133E] uppercase tracking-wider mb-1">
            <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            <span>Operador Global de Plataforma</span>
          </div>
          <h1 class="text-2xl lg:text-3xl font-bold text-[#17141A] tracking-tight">Gestión de Empresas y Tenants</h1>
          <p class="text-sm text-[#5A5561] mt-1">
            Administración centralizada de boutiques clientes, planes de suscripción y aprovisionamiento de tenants.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            (click)="loadData()"
            class="px-3.5 py-2 bg-white hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#5A5561] rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer shadow-2xs"
          >
            <span class="material-symbols-outlined text-[16px]" [class.animate-spin]="isLoading()">refresh</span>
            <span>Refrescar</span>
          </button>

          <button
            (click)="openCreateModal()"
            class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer shadow-xs"
          >
            <span class="material-symbols-outlined text-[16px]">add_business</span>
            <span>Nueva Empresa</span>
          </button>
        </div>
      </div>

      <!-- Tarjetas KPI Resumen -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div class="bg-white p-5 rounded-2xl border border-[#E8E2DA] shadow-xs">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-[#9B94A3] uppercase tracking-wider">Total Empresas</span>
            <div class="w-8 h-8 rounded-lg bg-[#F5EBF7] text-[#38133E] flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">storefront</span>
            </div>
          </div>
          <p class="text-3xl font-black text-[#17141A]">{{ empresas().length }}</p>
          <span class="text-xs text-[#5A5561] mt-1 block">Tenants registrados en la base</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-[#E8E2DA] shadow-xs">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-[#9B94A3] uppercase tracking-wider">Empresas Activas</span>
            <div class="w-8 h-8 rounded-lg bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>
          <p class="text-3xl font-black text-[#16A34A]">{{ countActivas() }}</p>
          <span class="text-xs text-[#5A5561] mt-1 block">Operando con suscripción activa</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-[#E8E2DA] shadow-xs">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-[#9B94A3] uppercase tracking-wider">Empresas Suspendidas</span>
            <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">pause_circle</span>
            </div>
          </div>
          <p class="text-3xl font-black text-rose-600">{{ countSuspendidas() }}</p>
          <span class="text-xs text-[#5A5561] mt-1 block">Escrituras bloqueadas</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-[#E8E2DA] shadow-xs">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-[#9B94A3] uppercase tracking-wider">Planes Disponibles</span>
            <div class="w-8 h-8 rounded-lg bg-[#F5EBF7] text-[#38133E] flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">layers</span>
            </div>
          </div>
          <p class="text-3xl font-black text-[#38133E]">{{ plans().length }}</p>
          <span class="text-xs text-[#5A5561] mt-1 block">Básico, Intermedio, Profesional</span>
        </div>
      </div>

      <!-- Barra de Filtros y Búsqueda -->
      <div class="bg-white p-4 rounded-2xl border border-[#E8E2DA] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="relative w-full sm:w-80">
          <span class="material-symbols-outlined absolute left-3 top-2.5 text-[#9B94A3] text-[18px]">search</span>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Buscar por nombre o slug…"
            class="w-full pl-9 pr-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs focus:ring-2 focus:ring-[#38133E] focus:outline-none placeholder:text-[#9B94A3] text-[#17141A]"
          />
        </div>

        <div class="flex items-center space-x-2 w-full sm:w-auto">
          <button
            (click)="filterStatus = 'all'"
            [class.bg-ys-primary-soft]="filterStatus === 'all'"
            [class.text-ys-primary]="filterStatus === 'all'"
            [class.font-bold]="filterStatus === 'all'"
            class="px-3 py-1.5 rounded-lg text-xs text-[#5A5561] hover:bg-[#F3EFEA] transition-colors cursor-pointer"
          >
            Todas ({{ empresas().length }})
          </button>
          <button
            (click)="filterStatus = 'activa'"
            [class.bg-ys-success-soft]="filterStatus === 'activa'"
            [class.text-ys-success]="filterStatus === 'activa'"
            [class.font-bold]="filterStatus === 'activa'"
            class="px-3 py-1.5 rounded-lg text-xs text-[#5A5561] hover:bg-[#F3EFEA] transition-colors cursor-pointer"
          >
            Activas ({{ countActivas() }})
          </button>
          <button
            (click)="filterStatus = 'suspendida'"
            [class.bg-rose-50]="filterStatus === 'suspendida'"
            [class.text-rose-700]="filterStatus === 'suspendida'"
            [class.font-bold]="filterStatus === 'suspendida'"
            class="px-3 py-1.5 rounded-lg text-xs text-[#5A5561] hover:bg-[#F3EFEA] transition-colors cursor-pointer"
          >
            Suspendidas ({{ countSuspendidas() }})
          </button>
        </div>
      </div>

      <!-- Estado de carga -->
      <div *ngIf="isLoading()" class="flex flex-col items-center justify-center py-20 text-[#5A5561] space-y-3">
        <span class="material-symbols-outlined text-4xl text-[#38133E] animate-spin">progress_activity</span>
        <p class="text-sm font-medium">Cargando empresas de la plataforma…</p>
      </div>

      <!-- Tabla de Empresas -->
      <div *ngIf="!isLoading()" class="bg-white rounded-2xl border border-[#E8E2DA] shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#FAF8F5] border-b border-[#E8E2DA] text-[10px] font-bold text-[#5A5561] uppercase tracking-wider">
                <th class="py-3 px-6">Empresa</th>
                <th class="py-3 px-6">Plan Asignado</th>
                <th class="py-3 px-6">Estado Suscripción</th>
                <th class="py-3 px-6">Facturación</th>
                <th class="py-3 px-6">Uso de Capacidad</th>
                <th class="py-3 px-6 text-right">Acciones de Gestión</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E8E2DA]/60 text-xs">
              <tr *ngFor="let emp of filteredEmpresas()" class="hover:bg-[#FAF8F5]/60 transition-colors">

                <!-- Columna Empresa -->
                <td class="py-4 px-6">
                  <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-[#38133E] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                      {{ emp.nombre.substring(0, 2).toUpperCase() }}
                    </div>
                    <div>
                      <p class="font-bold text-[#17141A] text-sm tracking-tight">{{ emp.nombre }}</p>
                      <div class="flex items-center space-x-2 text-[11px] text-[#9B94A3] mt-0.5">
                        <span class="font-mono text-[#5A5561]">{{ emp.slug }}</span>
                        <span>•</span>
                        <span>ID #{{ emp.idEmpresa }}</span>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Columna Plan -->
                <td class="py-4 px-6">
                  <div class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-2xs"
                       [ngClass]="getPlanBadgeClass(emp.plan?.codigo || '')">
                    <span>{{ emp.plan?.nombre || 'Sin Plan' }}</span>
                  </div>
                  <p class="text-[10px] text-[#9B94A3] mt-1">Cód: {{ emp.plan?.codigo || 'N/A' }}</p>
                </td>

                <!-- Columna Estado -->
                <td class="py-4 px-6">
                  <div class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border"
                       [ngClass]="getEstadoBadgeClass(emp.suscripcion?.estado || emp.estado)">
                    <span class="w-1.5 h-1.5 rounded-full"
                          [ngClass]="(emp.suscripcion?.estado || emp.estado) === 'activa' ? 'bg-[#16A34A]' : 'bg-rose-500'"></span>
                    <span>{{ getEstadoLabel(emp.suscripcion?.estado || emp.estado) }}</span>
                  </div>
                  <p class="text-[10px] text-[#9B94A3] mt-1">
                    Vence: {{ emp.suscripcion?.fechaFin || 'Sin límite' }}
                  </p>
                </td>

                <!-- Columna Facturación (Stripe / Manual + Próximo Cobro) -->
                <td class="py-4 px-6">
                  <div *ngIf="emp.facturacion?.modo === 'stripe'; else manualBilling">
                    <div class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#F5EBF7] text-[#38133E] border border-[#E8E2DA]">
                      <span class="material-symbols-outlined text-[13px]">credit_card</span>
                      <span>Stripe{{ emp.facturacion?.ciclo ? (' (' + emp.facturacion.ciclo + ')') : '' }}</span>
                    </div>
                    <p class="text-[10px] text-[#5A5561] mt-1">
                      {{ emp.facturacion?.proximoCobro ? ('Cobro: ' + emp.facturacion?.proximoCobro) : 'Sin fecha de cobro' }}
                    </p>
                  </div>
                  <ng-template #manualBilling>
                    <div>
                      <div class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#F3EFEA] text-[#5A5561] border border-[#E8E2DA]">
                        <span class="material-symbols-outlined text-[13px]">tune</span>
                        <span>Manual</span>
                      </div>
                      <p class="text-[10px] text-[#9B94A3] mt-1">SuperAdmin</p>
                    </div>
                  </ng-template>
                </td>

                <!-- Columna Uso -->
                <td class="py-4 px-6">
                  <div class="space-y-1 text-[11px] text-[#5A5561]">
                    <div class="flex items-center space-x-1.5">
                      <span class="material-symbols-outlined text-[13px] text-[#9B94A3]">location_city</span>
                      <span>{{ emp.uso?.sucursales ?? 0 }} sucursales</span>
                    </div>
                    <div class="flex items-center space-x-1.5">
                      <span class="material-symbols-outlined text-[13px] text-[#9B94A3]">group</span>
                      <span>{{ emp.uso?.usuarios ?? 0 }} usuarios</span>
                    </div>
                    <div class="flex items-center space-x-1.5">
                      <span class="material-symbols-outlined text-[13px] text-[#9B94A3]">checkroom</span>
                      <span>{{ emp.uso?.productos ?? 0 }} productos</span>
                    </div>
                  </div>
                </td>

                <!-- Columna Acciones -->
                <td class="py-4 px-6 text-right">
                  <div class="flex items-center justify-end space-x-2">
                    <button
                      (click)="openChangePlanModal(emp)"
                      title="Cambiar Plan de Suscripción"
                      class="px-2.5 py-1.5 bg-white hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#5A5561] rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                    >
                      <span class="material-symbols-outlined text-[15px] text-[#38133E]">upgrade</span>
                      <span>Plan</span>
                    </button>

                    <button
                      (click)="openBackupsModal(emp)"
                      title="Copias de Seguridad (Backups)"
                      class="px-2.5 py-1.5 bg-white hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#5A5561] rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                    >
                      <span class="material-symbols-outlined text-[15px] text-[#38133E]">backup</span>
                      <span>Backups</span>
                    </button>

                    <button
                      *ngIf="(emp.suscripcion?.estado || emp.estado) === 'activa'"
                      (click)="toggleEstado(emp)"
                      title="Suspender Empresa"
                      class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                    >
                      <span class="material-symbols-outlined text-[15px]">pause</span>
                      <span>Suspender</span>
                    </button>

                    <button
                      *ngIf="(emp.suscripcion?.estado || emp.estado) !== 'activa'"
                      (click)="toggleEstado(emp)"
                      title="Reactivar Empresa"
                      class="px-2.5 py-1.5 bg-[#DCFCE7] hover:bg-[#d0f7dc] border border-[#16A34A]/30 text-[#16A34A] rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                    >
                      <span class="material-symbols-outlined text-[15px]">play_arrow</span>
                      <span>Reactivar</span>
                    </button>

                    <button
                      (click)="openEditModal(emp)"
                      title="Editar Datos"
                      class="p-1.5 text-[#9B94A3] hover:text-[#17141A] hover:bg-[#F3EFEA] rounded-lg transition-colors cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </div>
                </td>

              </tr>

              <tr *ngIf="filteredEmpresas().length === 0">
                <td colspan="6" class="py-12 text-center text-[#9B94A3]">
                  <span class="material-symbols-outlined text-3xl mb-1 text-[#9B94A3]">search_off</span>
                  <p class="text-sm font-medium">No se encontraron empresas con los criterios seleccionados.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sección: Planes de Suscripción Disponibles (290/690/1490 USD) -->
      <div class="bg-white rounded-2xl border border-[#E8E2DA] p-6 sm:p-8 shadow-xs space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E8E2DA] pb-4">
          <div>
            <div class="flex items-center space-x-2 text-xs font-bold text-[#38133E] uppercase tracking-wider mb-1">
              <span class="material-symbols-outlined text-[16px]">price_change</span>
              <span>Tarifas y Límites</span>
            </div>
            <h3 class="text-lg font-bold text-[#17141A] tracking-tight">Planes de Suscripción</h3>
            <p class="text-xs text-[#5A5561] mt-0.5">Precios oficiales y capacidades asignadas a cada nivel de tenant.</p>
          </div>
          <span class="text-xs font-bold text-[#5A5561] bg-[#FAF8F5] px-3 py-1 rounded-full border border-[#E8E2DA] self-start sm:self-auto">
            Moneda: USD (mensual / anual)
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            *ngFor="let p of plans()"
            class="rounded-xl border p-5 flex flex-col justify-between transition-all hover:shadow-xs"
            [ngClass]="p.codigo === 'avanzado' ? 'border-[#38133E]/30 bg-[#F5EBF7]/30' : (p.codigo === 'intermedio' ? 'border-[#E8E2DA] bg-white' : 'border-[#E8E2DA] bg-[#FAF8F5]/60')"
          >
            <div>
              <div class="flex items-center justify-between mb-3">
                <span
                  class="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs"
                  [ngClass]="getPlanBadgeClass(p.codigo)"
                >
                  {{ p.nombre }}
                </span>
                <span class="font-mono text-[11px] text-gray-400">#{{ p.codigo }}</span>
              </div>

              <div class="mb-4">
                <div class="flex items-baseline space-x-1">
                  <span class="text-3xl font-black text-gray-900">\${{ p.precioMensual }}</span>
                  <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">USD / mes</span>
                </div>
                <p class="text-[11px] text-gray-600 mt-0.5" *ngIf="p.precioAnual">
                  Anual: \${{ p.precioAnual }} USD / año (-20%)
                </p>
                <p class="text-[11px] text-gray-400 mt-0.5" *ngIf="!p.precioAnual">Facturación mensual por tenant</p>
              </div>

              <!-- Límites de capacidad -->
              <div class="space-y-2 py-3 border-y border-gray-100 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-gray-500 flex items-center space-x-1.5">
                    <span class="material-symbols-outlined text-[14px] text-gray-400">location_city</span>
                    <span>Sucursales:</span>
                  </span>
                  <span class="font-bold text-gray-900">{{ p.limites.sucursales === null ? 'Ilimitadas' : p.limites.sucursales }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-500 flex items-center space-x-1.5">
                    <span class="material-symbols-outlined text-[14px] text-gray-400">group</span>
                    <span>Usuarios:</span>
                  </span>
                  <span class="font-bold text-gray-900">{{ p.limites.usuarios === null ? 'Ilimitados' : p.limites.usuarios }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-500 flex items-center space-x-1.5">
                    <span class="material-symbols-outlined text-[14px] text-gray-400">checkroom</span>
                    <span>Productos:</span>
                  </span>
                  <span class="font-bold text-gray-900">{{ p.limites.productos === null ? 'Ilimitados' : p.limites.productos }}</span>
                </div>
              </div>

              <!-- Features tags -->
              <div class="mt-4">
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Módulos Incluidos ({{ p.features.length }})</span>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    *ngFor="let f of p.features"
                    class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-gray-200 text-gray-700"
                  >
                    {{ f }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Modal: Crear Nueva Empresa + Admin Inicial -->
    <div *ngIf="showCreateModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-[#17141A]/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-lg w-full p-6 sm:p-8 rounded-2xl border border-[#E8E2DA] shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button (click)="showCreateModal.set(false)" class="absolute top-4 right-4 text-[#9B94A3] hover:text-[#17141A] p-1 cursor-pointer">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-6">
          <div class="flex items-center space-x-2 text-[#38133E] text-xs font-bold uppercase tracking-wider mb-1">
            <span class="material-symbols-outlined text-[16px]">domain_add</span>
            <span>Aprovisionamiento Multitenant</span>
          </div>
          <h3 class="text-xl font-bold text-[#17141A]">Registrar Nueva Empresa</h3>
          <p class="text-xs text-[#5A5561] mt-1">Crea la empresa, activa su suscripción inicial y genera las credenciales de su primer Administrador.</p>
        </div>

        <form (ngSubmit)="submitCreateEmpresa()" class="space-y-5">
          <!-- Sección Empresa -->
          <div class="space-y-3">
            <h4 class="text-xs font-bold text-[#17141A] uppercase tracking-wide border-b border-[#E8E2DA] pb-1">
              Datos de la Empresa
            </h4>

            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider">Nombre de la Empresa</label>
              <input
                type="text"
                [(ngModel)]="newNombre"
                (ngModelChange)="onNombreChange($event)"
                name="newNombre"
                required
                placeholder="ej. Boutique Alta Costura"
                class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs focus:ring-2 focus:ring-[#38133E] focus:outline-none placeholder:text-[#9B94A3] text-[#17141A]"
              />
            </div>

            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider">Slug Identificador (único)</label>
              <input
                type="text"
                [(ngModel)]="newSlug"
                name="newSlug"
                required
                placeholder="ej. boutique-alta-costura"
                class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#38133E] focus:outline-none placeholder:text-[#9B94A3] text-[#17141A]"
              />
              <span class="text-[10px] text-[#9B94A3] mt-0.5 block">Usado para rutas y subdominios. Solo minúsculas y guiones.</span>
            </div>

            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider">Plan de Suscripción</label>
              <select
                [(ngModel)]="newCodigoPlan"
                name="newCodigoPlan"
                required
                class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs focus:ring-2 focus:ring-[#38133E] focus:outline-none bg-white text-[#17141A] cursor-pointer"
              >
                <option value="basico">Plan Básico (2 sucursales, 3 usuarios, 200 productos)</option>
                <option value="intermedio">Plan Intermedio (5 sucursales, 15 usuarios, 2000 productos)</option>
                <option value="avanzado">Plan Profesional (10 sucursales + IA + Probador)</option>
              </select>
            </div>
          </div>

          <!-- Sección Administrador -->
          <div class="space-y-3 pt-2">
            <h4 class="text-xs font-bold text-[#17141A] uppercase tracking-wide border-b border-[#E8E2DA] pb-1">
              Administrador Inicial de la Empresa
            </h4>

            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider">Nombre Completo</label>
              <input
                type="text"
                [(ngModel)]="newAdminNombre"
                name="newAdminNombre"
                required
                placeholder="ej. Valentina Rosales"
                class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs focus:ring-2 focus:ring-[#38133E] focus:outline-none placeholder:text-[#9B94A3] text-[#17141A]"
              />
            </div>

            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider">Correo Electrónico (Login)</label>
              <input
                type="email"
                [(ngModel)]="newAdminCorreo"
                name="newAdminCorreo"
                required
                placeholder="ej. valentina@boutique.com"
                class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs focus:ring-2 focus:ring-[#38133E] focus:outline-none placeholder:text-[#9B94A3] text-[#17141A]"
              />
            </div>

            <div>
              <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider">Contraseña Temporal</label>
              <input
                type="password"
                [(ngModel)]="newAdminPassword"
                name="newAdminPassword"
                required
                placeholder="Mínimo 10 caracteres (Mayús, Minús, Núm, Especial)"
                class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs focus:ring-2 focus:ring-[#38133E] focus:outline-none placeholder:text-[#9B94A3] text-[#17141A]"
              />
            </div>
          </div>

          <div class="pt-4 border-t border-[#E8E2DA] flex items-center justify-end space-x-3">
            <button
              type="button"
              (click)="showCreateModal.set(false)"
              class="px-4 py-2 border border-[#E8E2DA] text-[#5A5561] hover:bg-[#F3EFEA] rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="isSubmitting() || !isCreateFormValid()"
              class="px-5 py-2 bg-[#38133E] hover:bg-[#260B2B] disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-xs flex items-center space-x-2 cursor-pointer"
            >
              <span *ngIf="isSubmitting()" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              <span>Crear Empresa</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal: Cambiar Plan de Suscripción -->
    <div *ngIf="showPlanModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-[#17141A]/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-md w-full p-6 sm:p-8 rounded-2xl border border-[#E8E2DA] shadow-2xl relative">
        <button (click)="showPlanModal.set(false)" class="absolute top-4 right-4 text-[#9B94A3] hover:text-[#17141A] p-1 cursor-pointer">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-5">
          <span class="text-xs font-bold text-[#38133E] uppercase tracking-wider">Modificar Suscripción</span>
          <h3 class="text-lg font-bold text-[#17141A] mt-1">Cambiar Plan de {{ selectedEmpresa?.nombre }}</h3>
          <p class="text-xs text-[#5A5561] mt-1">Selecciona el nuevo nivel de plan para actualizar inmediatamente sus límites y módulos.</p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider">Plan Destino</label>
            <select
              [(ngModel)]="selectedPlanCode"
              class="w-full mt-1.5 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs focus:ring-2 focus:ring-[#38133E] focus:outline-none bg-white text-[#17141A] cursor-pointer"
            >
              <option value="basico">Plan Básico (2 sucursales, 3 usuarios, 200 productos)</option>
              <option value="intermedio">Plan Intermedio (5 sucursales, 15 usuarios, 2000 productos)</option>
              <option value="avanzado">Plan Profesional (10 sucursales + IA + Probador)</option>
            </select>
          </div>

          <div>
            <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider">Vigencia hasta (opcional)</label>
            <input
              type="date"
              [(ngModel)]="selectedFechaFin"
              [disabled]="selectedEmpresa?.facturacion?.modo === 'stripe'"
              class="w-full mt-1.5 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs focus:ring-2 focus:ring-[#38133E] focus:outline-none bg-white text-[#17141A] disabled:bg-[#F3EFEA] disabled:cursor-not-allowed"
            />
            <p class="text-[11px] text-[#5A5561] mt-1">
              {{ selectedEmpresa?.facturacion?.modo === 'stripe' ? 'La vigencia de esta suscripción la gestiona Stripe.' : 'Déjalo vacío para mantener la vigencia actual.' }}
            </p>
          </div>

          <div class="p-3 bg-[#FAF8F5] rounded-xl border border-[#E8E2DA] text-xs text-[#5A5561] space-y-1">
            <p class="font-bold text-[#17141A]">Efecto inmediato:</p>
            <p>El tenant adoptará las nuevas cuotas y permisos en su próximo inicio de sesión o refresco de token.</p>
          </div>

          <div class="pt-4 border-t border-[#E8E2DA] flex items-center justify-end space-x-3">
            <button
              (click)="showPlanModal.set(false)"
              class="px-4 py-2 border border-[#E8E2DA] text-[#5A5561] hover:bg-[#F3EFEA] rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              (click)="submitChangePlan()"
              [disabled]="isSubmitting()"
              class="px-5 py-2 bg-[#38133E] hover:bg-[#260B2B] disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
            >
              Confirmar Cambio
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Editar Datos de Empresa -->
    <div *ngIf="showEditModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-[#17141A]/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-md w-full p-6 sm:p-8 rounded-2xl border border-[#E8E2DA] shadow-2xl relative">
        <button (click)="showEditModal.set(false)" class="absolute top-4 right-4 text-[#9B94A3] hover:text-[#17141A] p-1 cursor-pointer">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-5">
          <span class="text-xs font-bold text-[#38133E] uppercase tracking-wider">Configuración</span>
          <h3 class="text-lg font-bold text-[#17141A] mt-1">Editar Empresa #{{ selectedEmpresa?.idEmpresa }}</h3>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider">Nombre Comercial</label>
            <input
              type="text"
              [(ngModel)]="editNombre"
              class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs focus:ring-2 focus:ring-[#38133E] focus:outline-none placeholder:text-[#9B94A3] text-[#17141A]"
            />
          </div>

          <div>
            <label class="text-xs font-bold text-[#17141A] uppercase tracking-wider">URL del Logo (Opcional)</label>
            <input
              type="text"
              [(ngModel)]="editLogoUrl"
              placeholder="https://ejemplo.com/logo.png"
              class="w-full mt-1 px-3.5 py-2 border border-[#E8E2DA] rounded-lg text-xs focus:ring-2 focus:ring-[#38133E] focus:outline-none placeholder:text-[#9B94A3] text-[#17141A]"
            />
          </div>

          <div class="pt-4 border-t border-[#E8E2DA] flex items-center justify-end space-x-3">
            <button
              (click)="showEditModal.set(false)"
              class="px-4 py-2 border border-[#E8E2DA] text-[#5A5561] hover:bg-[#F3EFEA] rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              (click)="submitEditEmpresa()"
              [disabled]="isSubmitting() || editNombre.trim().length === 0"
              class="px-5 py-2 bg-[#38133E] hover:bg-[#260B2B] disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Copias de Seguridad (Backups) por Empresa -->
    <div *ngIf="showBackupsModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-[#17141A]/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-3xl w-full p-6 sm:p-8 rounded-2xl border border-[#E8E2DA] shadow-2xl relative max-h-[90vh] flex flex-col">
        <button (click)="closeBackupsModal()" class="absolute top-4 right-4 text-[#9B94A3] hover:text-[#17141A] p-1 cursor-pointer">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <!-- Cabecera -->
        <div class="mb-5 pb-4 border-b border-[#E8E2DA]">
          <div class="flex items-center space-x-2 text-[#38133E] text-xs font-bold uppercase tracking-wider mb-1">
            <span class="material-symbols-outlined text-[16px]">cloud_sync</span>
            <span>Copias de Seguridad Multitenant</span>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 class="text-xl font-bold text-[#17141A]">
                Backups — {{ selectedEmpresaForBackups?.nombre }}
              </h3>
              <p class="text-xs text-[#5A5561] mt-0.5">
                Almacenamiento privado en Supabase Storage · Slug:
                <span class="font-mono text-[#17141A] font-semibold">{{ selectedEmpresaForBackups?.slug }}</span>
                (ID #{{ selectedEmpresaForBackups?.idEmpresa }})
              </p>
            </div>

            <!-- Botones de acción cabecera -->
            <div class="flex items-center space-x-2 shrink-0">
              <button
                (click)="loadBackups(selectedEmpresaForBackups!.idEmpresa)"
                [disabled]="isLoadingBackups() || isGeneratingBackup()"
                title="Actualizar lista de backups"
                class="px-3 py-2 bg-white hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#5A5561] rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <span class="material-symbols-outlined text-[16px]" [class.animate-spin]="isLoadingBackups()">refresh</span>
                <span class="hidden sm:inline">Refrescar</span>
              </button>

              <button
                (click)="generateBackup()"
                [disabled]="isGeneratingBackup() || isLoadingBackups()"
                class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <span *ngIf="isGeneratingBackup()" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                <span *ngIf="!isGeneratingBackup()" class="material-symbols-outlined text-[16px]">cloud_upload</span>
                <span>{{ isGeneratingBackup() ? 'Generando backup…' : 'Generar backup' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Banner de Error 503 (Supabase no configurado) -->
        <div *ngIf="storageError()" class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-3">
          <span class="material-symbols-outlined text-[20px] text-amber-700 shrink-0 mt-0.5">cloud_off</span>
          <div class="space-y-1">
            <p class="font-bold">Almacenamiento de backups no configurado</p>
            <p class="text-[#5A5561]">{{ storageError() }}</p>
            <p class="text-[11px] text-[#9B94A3]">
              Para habilitar la generación y descarga de respaldos, configure las variables de entorno de Supabase Storage en el servidor (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_BACKUP_BUCKET).
            </p>
          </div>
        </div>

        <!-- Contenido principal: Tabla o estados -->
        <div class="flex-1 overflow-y-auto min-h-[220px]">
          <!-- Cargando -->
          <div *ngIf="isLoadingBackups()" class="flex flex-col items-center justify-center py-16 text-[#5A5561] space-y-3">
            <span class="material-symbols-outlined text-3xl text-[#38133E] animate-spin">progress_activity</span>
            <p class="text-xs font-medium">Consultando copias de seguridad en Supabase Storage…</p>
          </div>

          <!-- Sin backups -->
          <div *ngIf="!isLoadingBackups() && backups().length === 0 && !storageError()" class="flex flex-col items-center justify-center py-16 text-[#9B94A3] space-y-2 text-center px-4">
            <span class="material-symbols-outlined text-4xl text-[#9B94A3]">history_toggle_off</span>
            <p class="text-sm font-bold text-[#17141A]">No hay copias de seguridad registradas</p>
            <p class="text-xs text-[#5A5561] max-w-md">
              Aún no se han generado respaldos para esta empresa. Podés crear uno de forma manual usando el botón superior "Generar backup".
            </p>
          </div>

          <!-- Tabla de Backups -->
          <div *ngIf="!isLoadingBackups() && backups().length > 0" class="border border-[#E8E2DA] rounded-xl overflow-hidden shadow-2xs">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-[#FAF8F5] border-b border-[#E8E2DA] text-[10px] font-bold text-[#5A5561] uppercase tracking-wider">
                  <th class="py-3 px-4">Fecha de Generación</th>
                  <th class="py-3 px-4">Tipo</th>
                  <th class="py-3 px-4">Tamaño</th>
                  <th class="py-3 px-4">Archivo</th>
                  <th class="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E8E2DA]/60 text-xs">
                <tr *ngFor="let b of backups()" class="hover:bg-[#FAF8F5]/60 transition-colors">
                  <!-- Fecha -->
                  <td class="py-3 px-4 font-medium text-[#17141A] whitespace-nowrap">
                    {{ formatFecha(b.fecha) }}
                  </td>

                  <!-- Tipo -->
                  <td class="py-3 px-4 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-2xs"
                      [ngClass]="getBackupTipoBadgeClass(b.tipo)"
                    >
                      {{ b.tipo === 'manual' ? 'Manual' : 'Automático' }}
                    </span>
                  </td>

                  <!-- Tamaño -->
                  <td class="py-3 px-4 font-mono text-[#5A5561] whitespace-nowrap">
                    {{ formatBytes(b.tamanoBytes) }}
                  </td>

                  <!-- Archivo -->
                  <td class="py-3 px-4 font-mono text-[11px] text-[#9B94A3] truncate max-w-[200px]" [title]="b.nombre">
                    {{ b.nombre }}
                  </td>

                  <!-- Descargar -->
                  <td class="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      (click)="downloadBackup(b.nombre)"
                      [disabled]="downloadingBackupName() === b.nombre"
                      title="Descargar archivo de respaldo"
                      class="px-2.5 py-1.5 bg-white hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#38133E] rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                    >
                      <span *ngIf="downloadingBackupName() === b.nombre" class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                      <span *ngIf="downloadingBackupName() !== b.nombre" class="material-symbols-outlined text-[15px]">download</span>
                      <span>{{ downloadingBackupName() === b.nombre ? 'Preparando…' : 'Descargar' }}</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pie del Modal -->
        <div class="pt-4 mt-4 border-t border-[#E8E2DA] flex items-center justify-between text-xs text-[#9B94A3]">
          <span>Los enlaces de descarga son firmados y expiran tras 5 minutos.</span>
          <button
            (click)="closeBackupsModal()"
            class="px-4 py-2 border border-[#E8E2DA] text-[#5A5561] hover:bg-[#F3EFEA] rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `
})
export class PlatformComponent implements OnInit {
  empresas = signal<PlatformEmpresa[]>([]);
  plans = signal<PlatformPlan[]>([]);
  isLoading = signal<boolean>(true);
  isSubmitting = signal<boolean>(false);

  searchQuery = '';
  filterStatus: 'all' | 'activa' | 'suspendida' = 'all';

  // Modales
  showCreateModal = signal<boolean>(false);
  showPlanModal = signal<boolean>(false);
  showEditModal = signal<boolean>(false);
  showBackupsModal = signal<boolean>(false);

  // Backups
  selectedEmpresaForBackups: PlatformEmpresa | null = null;
  backups = signal<TenantBackup[]>([]);
  isLoadingBackups = signal<boolean>(false);
  isGeneratingBackup = signal<boolean>(false);
  downloadingBackupName = signal<string | null>(null);
  storageError = signal<string | null>(null);

  selectedEmpresa: PlatformEmpresa | null = null;
  selectedPlanCode = 'basico';
  selectedFechaFin = '';

  // Form Crear
  newNombre = '';
  newSlug = '';
  newCodigoPlan = 'basico';
  newAdminNombre = '';
  newAdminCorreo = '';
  newAdminPassword = '';

  // Form Editar
  editNombre = '';
  editLogoUrl = '';

  constructor(
    private platformService: PlatformService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);

    this.platformService.getPlans().subscribe({
      next: (plans) => this.plans.set(plans),
      error: () => {
        // Fallback para planes estándar de acuerdo al contrato
        this.plans.set([
          { idPlan: 1, codigo: 'basico', nombre: 'Básico', precioMensual: 290, precioAnual: 2784, features: ['pos', 'inventario', 'ventas', 'reportes'], limites: { sucursales: 2, usuarios: 3, productos: 200 } },
          { idPlan: 2, codigo: 'intermedio', nombre: 'Intermedio', precioMensual: 690, precioAnual: 6624, features: ['pos', 'inventario', 'ventas', 'reportes', 'despachos', 'reservas', 'pagos_online', 'app_movil', 'reportes_avanzados', 'promociones', 'fidelizacion', 'tallas'], limites: { sucursales: 5, usuarios: 15, productos: 2000 } },
          { idPlan: 3, codigo: 'avanzado', nombre: 'Profesional', precioMensual: 1490, precioAnual: 14304, features: ['pos', 'inventario', 'ventas', 'reportes', 'despachos', 'reservas', 'pagos_online', 'app_movil', 'reportes_avanzados', 'reportes_export', 'ia', 'probador', 'promociones', 'fidelizacion', 'tallas'], limites: { sucursales: 10, usuarios: null, productos: null } }
        ]);
      }
    });

    this.platformService.getEmpresas().subscribe({
      next: (empresas) => {
        this.empresas.set(empresas);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.notificationService.error('Error al cargar empresas', err.error?.detail || 'No se pudo obtener el listado.');
        this.isLoading.set(false);
      }
    });
  }

  countActivas(): number {
    return this.empresas().filter(e => (e.suscripcion?.estado || e.estado) === 'activa').length;
  }

  countSuspendidas(): number {
    return this.empresas().filter(e => (e.suscripcion?.estado || e.estado) === 'suspendida').length;
  }

  filteredEmpresas(): PlatformEmpresa[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.empresas().filter(e => {
      const matchSearch = !q || e.nombre.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q);
      const estado = (e.suscripcion?.estado || e.estado || '').toLowerCase();
      const matchStatus = this.filterStatus === 'all' || estado === this.filterStatus;
      return matchSearch && matchStatus;
    });
  }

  onNombreChange(nombre: string) {
    if (!this.newSlug || this.isSlugDerived(this.newSlug, nombre)) {
      this.newSlug = this.slugify(nombre);
    }
  }

  private isSlugDerived(slug: string, nombre: string): boolean {
    return slug === this.slugify(nombre.slice(0, -1)) || slug === this.slugify(nombre);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  openCreateModal() {
    this.newNombre = '';
    this.newSlug = '';
    this.newCodigoPlan = 'basico';
    this.newAdminNombre = '';
    this.newAdminCorreo = '';
    this.newAdminPassword = '';
    this.showCreateModal.set(true);
  }

  isCreateFormValid(): boolean {
    return (
      this.newNombre.trim().length >= 2 &&
      this.newSlug.trim().length >= 2 &&
      this.newAdminNombre.trim().length >= 2 &&
      this.newAdminCorreo.includes('@') &&
      this.newAdminPassword.length >= 8
    );
  }

  submitCreateEmpresa() {
    if (!this.isCreateFormValid()) return;

    this.isSubmitting.set(true);
    const payload: CreateEmpresaIn = {
      nombre: this.newNombre.trim(),
      slug: this.newSlug.trim(),
      codigoPlan: this.newCodigoPlan,
      admin: {
        nombre: this.newAdminNombre.trim(),
        correo: this.newAdminCorreo.trim(),
        password: this.newAdminPassword,
      }
    };

    this.platformService.createEmpresa(payload).subscribe({
      next: (emp) => {
        this.notificationService.success('Empresa creada', `La empresa ${emp.nombre} y su administrador fueron creados exitosamente.`);
        this.isSubmitting.set(false);
        this.showCreateModal.set(false);
        this.loadData();
      },
      error: (err) => {
        this.notificationService.error('Error al crear empresa', err.error?.detail || 'Verificá los datos ingresados.');
        this.isSubmitting.set(false);
      }
    });
  }

  openChangePlanModal(emp: PlatformEmpresa) {
    this.selectedEmpresa = emp;
    this.selectedPlanCode = emp.plan?.codigo || 'basico';
    this.selectedFechaFin = emp.suscripcion?.fechaFin ?? '';
    this.showPlanModal.set(true);
  }

  submitChangePlan() {
    if (!this.selectedEmpresa) return;

    this.isSubmitting.set(true);
    const id = this.selectedEmpresa.idEmpresa;

    const fechaFin = this.selectedFechaFin && this.selectedFechaFin !== this.selectedEmpresa.suscripcion?.fechaFin
      ? this.selectedFechaFin
      : undefined;
    this.platformService.changePlan(id, this.selectedPlanCode, fechaFin).subscribe({
      next: () => {
        this.notificationService.success('Plan actualizado', `El plan de ${this.selectedEmpresa?.nombre} fue cambiado a ${this.selectedPlanCode}.`);
        this.isSubmitting.set(false);
        this.showPlanModal.set(false);
        this.loadData();
      },
      error: (err) => {
        this.notificationService.error('Error al cambiar plan', err.error?.detail || 'No se pudo actualizar el plan.');
        this.isSubmitting.set(false);
      }
    });
  }

  toggleEstado(emp: PlatformEmpresa) {
    const estadoActual = (emp.suscripcion?.estado || emp.estado) === 'activa' ? 'activa' : 'suspendida';
    const nuevoEstado = estadoActual === 'activa' ? 'suspendida' : 'activa';
    const accion = nuevoEstado === 'activa' ? 'reactivar' : 'suspender';

    if (!confirm(`¿Confirma que desea ${accion} la empresa "${emp.nombre}"?`)) {
      return;
    }

    this.platformService.changeEstado(emp.idEmpresa, nuevoEstado).subscribe({
      next: () => {
        this.notificationService.success(
          nuevoEstado === 'activa' ? 'Empresa reactivada' : 'Empresa suspendida',
          `La empresa ${emp.nombre} ahora está ${nuevoEstado}.`
        );
        this.loadData();
      },
      error: (err) => {
        this.notificationService.error('Error al cambiar estado', err.error?.detail || 'No se pudo actualizar el estado.');
      }
    });
  }

  openEditModal(emp: PlatformEmpresa) {
    this.selectedEmpresa = emp;
    this.editNombre = emp.nombre;
    this.editLogoUrl = emp.logoUrl || '';
    this.showEditModal.set(true);
  }

  submitEditEmpresa() {
    if (!this.selectedEmpresa) return;

    this.isSubmitting.set(true);
    const id = this.selectedEmpresa.idEmpresa;

    this.platformService.updateEmpresa(id, {
      nombre: this.editNombre.trim(),
      logoUrl: this.editLogoUrl.trim() || null,
    }).subscribe({
      next: () => {
        this.notificationService.success('Empresa actualizada', 'Los datos comerciales fueron actualizados.');
        this.isSubmitting.set(false);
        this.showEditModal.set(false);
        this.loadData();
      },
      error: (err) => {
        this.notificationService.error('Error al actualizar', err.error?.detail || 'No se pudo editar la empresa.');
        this.isSubmitting.set(false);
      }
    });
  }

  getPlanBadgeClass(codigo: string): string {
    const c = codigo.toLowerCase();
    if (c === 'avanzado') return 'bg-[#38133E] text-white border-[#38133E]';
    if (c === 'intermedio') return 'bg-[#F5EBF7] text-[#38133E] border-[#E8E2DA]';
    return 'bg-[#F3EFEA] text-[#5A5561] border-[#E8E2DA]';
  }

  getEstadoBadgeClass(estado: string): string {
    const e = (estado || '').toLowerCase();
    if (e === 'activa') return 'bg-[#DCFCE7] text-[#16A34A] border-[#16A34A]/20';
    if (e === 'suspendida') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }

  getEstadoLabel(estado: string): string {
    const e = (estado || '').toLowerCase();
    if (e === 'activa') return 'Activa';
    if (e === 'suspendida') return 'Suspendida';
    if (e === 'vencida') return 'Vencida';
    return estado || 'Desconocido';
  }

  // Métodos de Copias de Seguridad (Backups)
  openBackupsModal(emp: PlatformEmpresa) {
    this.selectedEmpresaForBackups = emp;
    this.storageError.set(null);
    this.backups.set([]);
    this.showBackupsModal.set(true);
    this.loadBackups(emp.idEmpresa);
  }

  closeBackupsModal() {
    this.showBackupsModal.set(false);
    this.selectedEmpresaForBackups = null;
    this.storageError.set(null);
    this.backups.set([]);
  }

  loadBackups(idEmpresa: number) {
    this.isLoadingBackups.set(true);
    this.storageError.set(null);
    this.platformService.getBackups(idEmpresa).subscribe({
      next: (data) => {
        this.backups.set(data || []);
        this.isLoadingBackups.set(false);
      },
      error: (err) => {
        this.isLoadingBackups.set(false);
        this.handleBackupError(err, 'No se pudieron cargar las copias de seguridad.');
      }
    });
  }

  generateBackup() {
    if (!this.selectedEmpresaForBackups) return;
    const idEmpresa = this.selectedEmpresaForBackups.idEmpresa;
    this.isGeneratingBackup.set(true);
    this.storageError.set(null);

    this.platformService.generateBackup(idEmpresa).subscribe({
      next: (newBackup) => {
        this.isGeneratingBackup.set(false);
        this.notificationService.success('Copia de seguridad generada', 'El respaldo manual fue creado exitosamente.');
        const current = this.backups();
        this.backups.set([newBackup, ...current]);
      },
      error: (err) => {
        this.isGeneratingBackup.set(false);
        this.handleBackupError(err, 'No se pudo generar la copia de seguridad.');
      }
    });
  }

  downloadBackup(nombre: string) {
    if (!this.selectedEmpresaForBackups) return;
    const idEmpresa = this.selectedEmpresaForBackups.idEmpresa;
    this.downloadingBackupName.set(nombre);

    this.platformService.downloadBackup(idEmpresa, nombre).subscribe({
      next: (res) => {
        this.downloadingBackupName.set(null);
        if (res?.url) {
          window.open(res.url, '_blank');
          this.notificationService.success('Enlace de descarga listo', 'Abriendo el archivo de respaldo…');
        } else {
          this.notificationService.error('Error de descarga', 'No se recibió la URL de descarga.');
        }
      },
      error: (err) => {
        this.downloadingBackupName.set(null);
        this.handleBackupError(err, 'No se pudo obtener el enlace de descarga.');
      }
    });
  }

  private handleBackupError(err: unknown, defaultMsg: string) {
    if (err && typeof err === 'object' && 'status' in err) {
      const httpErr = err as { status: number; error?: { detail?: string } };
      if (httpErr.status === 503) {
        const detail = httpErr.error?.detail || 'Supabase Storage no está configurado en el servidor.';
        this.storageError.set(detail);
        this.notificationService.error('Almacenamiento no disponible', detail);
        return;
      }
      if (httpErr.status === 404) {
        const detail = httpErr.error?.detail || 'Recurso no encontrado.';
        this.notificationService.error('No encontrado', detail);
        return;
      }
      if (httpErr.error?.detail) {
        this.notificationService.error('Error en backup', httpErr.error.detail);
        return;
      }
    }
    this.notificationService.error('Error', defaultMsg);
  }

  formatFecha(fechaIso: string): string {
    if (!fechaIso) return '—';
    try {
      const d = new Date(fechaIso);
      if (isNaN(d.getTime())) return fechaIso;
      return d.toLocaleString('es-BO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fechaIso;
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
    return `${val} ${sizes[i]}`;
  }

  getBackupTipoBadgeClass(tipo: BackupTipo): string {
    if (tipo === 'manual') {
      return 'bg-[#F5EBF7] text-[#38133E] border-[#E8E2DA]';
    }
    return 'bg-[#DCFCE7] text-[#16A34A] border-[#16A34A]/30';
  }
}
