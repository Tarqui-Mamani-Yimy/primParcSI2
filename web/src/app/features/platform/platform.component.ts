import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatformService } from '../../core/services/platform.service';
import { NotificationService } from '../../core/services/notification.service';
import { CreateEmpresaIn, PlatformEmpresa, PlatformPlan } from '../../core/models';

@Component({
  selector: 'app-platform',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

      <!-- Encabezado de la vista -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div class="flex items-center space-x-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
            <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            <span>Operador Global de Plataforma</span>
          </div>
          <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Gestión de Empresas y Tenants</h1>
          <p class="text-sm text-gray-500 mt-1">
            Administración centralizada de boutiques clientes, planes de suscripción y aprovisionamiento de tenants.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            (click)="loadData()"
            class="px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer shadow-2xs"
          >
            <span class="material-symbols-outlined text-[16px]" [class.animate-spin]="isLoading()">refresh</span>
            <span>Refrescar</span>
          </button>

          <button
            (click)="openCreateModal()"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer shadow-xs"
          >
            <span class="material-symbols-outlined text-[16px]">add_business</span>
            <span>Nueva Empresa</span>
          </button>
        </div>
      </div>

      <!-- Tarjetas KPI Resumen -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Empresas</span>
            <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">storefront</span>
            </div>
          </div>
          <p class="text-3xl font-black text-gray-900">{{ empresas().length }}</p>
          <span class="text-xs text-gray-500 mt-1 block">Tenants registrados en la base</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Empresas Activas</span>
            <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>
          <p class="text-3xl font-black text-emerald-600">{{ countActivas() }}</p>
          <span class="text-xs text-gray-500 mt-1 block">Operando con suscripción activa</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Empresas Suspendidas</span>
            <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">pause_circle</span>
            </div>
          </div>
          <p class="text-3xl font-black text-rose-600">{{ countSuspendidas() }}</p>
          <span class="text-xs text-gray-500 mt-1 block">Escrituras bloqueadas</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Planes Disponibles</span>
            <div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">layers</span>
            </div>
          </div>
          <p class="text-3xl font-black text-purple-600">{{ plans().length }}</p>
          <span class="text-xs text-gray-500 mt-1 block">Básico, Intermedio, Avanzado</span>
        </div>
      </div>

      <!-- Barra de Filtros y Búsqueda -->
      <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="relative w-full sm:w-80">
          <span class="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-[18px]">search</span>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Buscar por nombre o slug…"
            class="w-full pl-9 pr-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div class="flex items-center space-x-2 w-full sm:w-auto">
          <button
            (click)="filterStatus = 'all'"
            [class.bg-indigo-50]="filterStatus === 'all'"
            [class.text-indigo-700]="filterStatus === 'all'"
            [class.font-bold]="filterStatus === 'all'"
            class="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Todas ({{ empresas().length }})
          </button>
          <button
            (click)="filterStatus = 'activa'"
            [class.bg-emerald-50]="filterStatus === 'activa'"
            [class.text-emerald-700]="filterStatus === 'activa'"
            [class.font-bold]="filterStatus === 'activa'"
            class="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Activas ({{ countActivas() }})
          </button>
          <button
            (click)="filterStatus = 'suspendida'"
            [class.bg-rose-50]="filterStatus === 'suspendida'"
            [class.text-rose-700]="filterStatus === 'suspendida'"
            [class.font-bold]="filterStatus === 'suspendida'"
            class="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Suspendidas ({{ countSuspendidas() }})
          </button>
        </div>
      </div>

      <!-- Estado de carga -->
      <div *ngIf="isLoading()" class="flex flex-col items-center justify-center py-20 text-gray-500 space-y-3">
        <span class="material-symbols-outlined text-4xl text-indigo-600 animate-spin">progress_activity</span>
        <p class="text-sm font-medium">Cargando empresas de la plataforma…</p>
      </div>

      <!-- Tabla de Empresas -->
      <div *ngIf="!isLoading()" class="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-50/75 border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <th class="py-3 px-6">Empresa</th>
                <th class="py-3 px-6">Plan Asignado</th>
                <th class="py-3 px-6">Estado Suscripción</th>
                <th class="py-3 px-6">Uso de Capacidad</th>
                <th class="py-3 px-6 text-right">Acciones de Gestión</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-xs">
              <tr *ngFor="let emp of filteredEmpresas()" class="hover:bg-gray-50/50 transition-colors">

                <!-- Columna Empresa -->
                <td class="py-4 px-6">
                  <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                      {{ emp.nombre.substring(0, 2).toUpperCase() }}
                    </div>
                    <div>
                      <p class="font-bold text-gray-900 text-sm tracking-tight">{{ emp.nombre }}</p>
                      <div class="flex items-center space-x-2 text-[11px] text-gray-400 mt-0.5">
                        <span class="font-mono text-gray-500">{{ emp.slug }}</span>
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
                  <p class="text-[10px] text-gray-400 mt-1">Cód: {{ emp.plan?.codigo || 'N/A' }}</p>
                </td>

                <!-- Columna Estado -->
                <td class="py-4 px-6">
                  <div class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border"
                       [ngClass]="getEstadoBadgeClass(emp.suscripcion?.estado || emp.estado)">
                    <span class="w-1.5 h-1.5 rounded-full"
                          [ngClass]="(emp.suscripcion?.estado || emp.estado) === 'activa' ? 'bg-emerald-500' : 'bg-rose-500'"></span>
                    <span>{{ getEstadoLabel(emp.suscripcion?.estado || emp.estado) }}</span>
                  </div>
                  <p class="text-[10px] text-gray-400 mt-1">
                    Vence: {{ emp.suscripcion?.fechaFin || 'Sin límite' }}
                  </p>
                </td>

                <!-- Columna Uso -->
                <td class="py-4 px-6">
                  <div class="space-y-1 text-[11px] text-gray-600">
                    <div class="flex items-center space-x-1.5">
                      <span class="material-symbols-outlined text-[13px] text-gray-400">location_city</span>
                      <span>{{ emp.uso?.sucursales ?? 0 }} sucursales</span>
                    </div>
                    <div class="flex items-center space-x-1.5">
                      <span class="material-symbols-outlined text-[13px] text-gray-400">group</span>
                      <span>{{ emp.uso?.usuarios ?? 0 }} usuarios</span>
                    </div>
                    <div class="flex items-center space-x-1.5">
                      <span class="material-symbols-outlined text-[13px] text-gray-400">checkroom</span>
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
                      class="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                    >
                      <span class="material-symbols-outlined text-[15px] text-indigo-600">upgrade</span>
                      <span>Plan</span>
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
                      class="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                    >
                      <span class="material-symbols-outlined text-[15px]">play_arrow</span>
                      <span>Reactivar</span>
                    </button>

                    <button
                      (click)="openEditModal(emp)"
                      title="Editar Datos"
                      class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </div>
                </td>

              </tr>

              <tr *ngIf="filteredEmpresas().length === 0">
                <td colspan="5" class="py-12 text-center text-gray-400">
                  <span class="material-symbols-outlined text-3xl mb-1 text-gray-300">search_off</span>
                  <p class="text-sm font-medium">No se encontraron empresas con los criterios seleccionados.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sección: Planes de Suscripción Disponibles (19/49/99 USD) -->
      <div class="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <div class="flex items-center space-x-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
              <span class="material-symbols-outlined text-[16px]">price_change</span>
              <span>Tarifas y Límites</span>
            </div>
            <h3 class="text-lg font-bold text-gray-900 tracking-tight">Planes de Suscripción</h3>
            <p class="text-xs text-gray-500 mt-0.5">Precios oficiales y capacidades asignadas a cada nivel de tenant.</p>
          </div>
          <span class="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-200 self-start sm:self-auto">
            Moneda: USD mensual
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            *ngFor="let p of plans()"
            class="rounded-xl border p-5 flex flex-col justify-between transition-all hover:shadow-xs"
            [ngClass]="p.codigo === 'avanzado' ? 'border-purple-200 bg-purple-50/20' : (p.codigo === 'intermedio' ? 'border-indigo-200 bg-indigo-50/20' : 'border-gray-200 bg-gray-50/30')"
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
                  <span class="text-3xl font-black text-gray-900">{{ p.precioMensual }}</span>
                  <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">USD / mes</span>
                </div>
                <p class="text-[11px] text-gray-400 mt-0.5">Facturación mensual por tenant</p>
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
    <div *ngIf="showCreateModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-lg w-full p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button (click)="showCreateModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-6">
          <div class="flex items-center space-x-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <span class="material-symbols-outlined text-[16px]">domain_add</span>
            <span>Aprovisionamiento Multitenant</span>
          </div>
          <h3 class="text-xl font-bold text-gray-900">Registrar Nueva Empresa</h3>
          <p class="text-xs text-gray-500 mt-1">Crea la empresa, activa su suscripción inicial y genera las credenciales de su primer Administrador.</p>
        </div>

        <form (ngSubmit)="submitCreateEmpresa()" class="space-y-5">
          <!-- Sección Empresa -->
          <div class="space-y-3">
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-1">
              Datos de la Empresa
            </h4>

            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre de la Empresa</label>
              <input
                type="text"
                [(ngModel)]="newNombre"
                (ngModelChange)="onNombreChange($event)"
                name="newNombre"
                required
                placeholder="ej. Boutique Alta Costura"
                class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">Slug Identificador (único)</label>
              <input
                type="text"
                [(ngModel)]="newSlug"
                name="newSlug"
                required
                placeholder="ej. boutique-alta-costura"
                class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <span class="text-[10px] text-gray-400 mt-0.5 block">Usado para rutas y subdominios. Solo minúsculas y guiones.</span>
            </div>

            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">Plan de Suscripción</label>
              <select
                [(ngModel)]="newCodigoPlan"
                name="newCodigoPlan"
                required
                class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white cursor-pointer"
              >
                <option value="basico">Plan Básico (1 sucursal, 3 usuarios, 200 productos)</option>
                <option value="intermedio">Plan Intermedio (5 sucursales, 15 usuarios, 2000 productos)</option>
                <option value="avanzado">Plan Avanzado (Ilimitado + IA + Probador)</option>
              </select>
            </div>
          </div>

          <!-- Sección Administrador -->
          <div class="space-y-3 pt-2">
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-1">
              Administrador Inicial de la Empresa
            </h4>

            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre Completo</label>
              <input
                type="text"
                [(ngModel)]="newAdminNombre"
                name="newAdminNombre"
                required
                placeholder="ej. Valentina Rosales"
                class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">Correo Electrónico (Login)</label>
              <input
                type="email"
                [(ngModel)]="newAdminCorreo"
                name="newAdminCorreo"
                required
                placeholder="ej. valentina@boutique.com"
                class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">Contraseña Temporal</label>
              <input
                type="password"
                [(ngModel)]="newAdminPassword"
                name="newAdminPassword"
                required
                placeholder="Mínimo 10 caracteres (Mayús, Minús, Núm, Especial)"
                class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div class="pt-4 border-t border-gray-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              (click)="showCreateModal.set(false)"
              class="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="isSubmitting() || !isCreateFormValid()"
              class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-xs flex items-center space-x-2"
            >
              <span *ngIf="isSubmitting()" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              <span>Crear Empresa</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal: Cambiar Plan de Suscripción -->
    <div *ngIf="showPlanModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-md w-full p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-2xl relative">
        <button (click)="showPlanModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-5">
          <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider">Modificar Suscripción</span>
          <h3 class="text-lg font-bold text-gray-900 mt-1">Cambiar Plan de {{ selectedEmpresa?.nombre }}</h3>
          <p class="text-xs text-gray-500 mt-1">Selecciona el nuevo nivel de plan para actualizar inmediatamente sus límites y módulos.</p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">Plan Destino</label>
            <select
              [(ngModel)]="selectedPlanCode"
              class="w-full mt-1.5 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white cursor-pointer"
            >
              <option value="basico">Plan Básico (1 sucursal, 3 usuarios, 200 productos)</option>
              <option value="intermedio">Plan Intermedio (5 sucursales, 15 usuarios, 2000 productos)</option>
              <option value="avanzado">Plan Avanzado (Ilimitado + IA + Probador)</option>
            </select>
          </div>

          <div class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 space-y-1">
            <p class="font-bold text-gray-900">Efecto inmediato:</p>
            <p>El tenant adoptará las nuevas cuotas y permisos en su próximo inicio de sesión o refresco de token.</p>
          </div>

          <div class="pt-4 border-t border-gray-100 flex items-center justify-end space-x-3">
            <button
              (click)="showPlanModal.set(false)"
              class="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Cancelar
            </button>
            <button
              (click)="submitChangePlan()"
              [disabled]="isSubmitting()"
              class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
            >
              Confirmar Cambio
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Editar Datos de Empresa -->
    <div *ngIf="showEditModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-md w-full p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-2xl relative">
        <button (click)="showEditModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-5">
          <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider">Configuración</span>
          <h3 class="text-lg font-bold text-gray-900 mt-1">Editar Empresa #{{ selectedEmpresa?.idEmpresa }}</h3>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre Comercial</label>
            <input
              type="text"
              [(ngModel)]="editNombre"
              class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wider">URL del Logo (Opcional)</label>
            <input
              type="text"
              [(ngModel)]="editLogoUrl"
              placeholder="https://ejemplo.com/logo.png"
              class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div class="pt-4 border-t border-gray-100 flex items-center justify-end space-x-3">
            <button
              (click)="showEditModal.set(false)"
              class="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Cancelar
            </button>
            <button
              (click)="submitEditEmpresa()"
              [disabled]="isSubmitting() || editNombre.trim().length === 0"
              class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
            >
              Guardar Cambios
            </button>
          </div>
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

  selectedEmpresa: PlatformEmpresa | null = null;
  selectedPlanCode = 'basico';

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
          { idPlan: 1, codigo: 'basico', nombre: 'Básico', precioMensual: 19, features: ['pos', 'inventario', 'ventas', 'reportes'], limites: { sucursales: 1, usuarios: 3, productos: 200 } },
          { idPlan: 2, codigo: 'intermedio', nombre: 'Intermedio', precioMensual: 49, features: ['pos', 'inventario', 'ventas', 'reportes', 'despachos', 'reservas', 'pagos_online', 'app_movil', 'reportes_avanzados'], limites: { sucursales: 5, usuarios: 15, productos: 2000 } },
          { idPlan: 3, codigo: 'avanzado', nombre: 'Avanzado', precioMensual: 99, features: ['pos', 'inventario', 'ventas', 'reportes', 'despachos', 'reservas', 'pagos_online', 'app_movil', 'reportes_avanzados', 'reportes_export', 'ia', 'probador'], limites: { sucursales: null, usuarios: null, productos: null } }
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
    this.showPlanModal.set(true);
  }

  submitChangePlan() {
    if (!this.selectedEmpresa) return;

    this.isSubmitting.set(true);
    const id = this.selectedEmpresa.idEmpresa;

    this.platformService.changePlan(id, this.selectedPlanCode).subscribe({
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
    if (c === 'avanzado') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (c === 'intermedio') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  getEstadoBadgeClass(estado: string): string {
    const e = (estado || '').toLowerCase();
    if (e === 'activa') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
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
}
