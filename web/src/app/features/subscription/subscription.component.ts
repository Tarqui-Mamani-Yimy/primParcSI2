import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantService } from '../../core/services/tenant.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantMeResponse } from '../../core/models';

interface FeatureItem {
  key: string;
  nombre: string;
  descripcion: string;
  categoria: 'Operaciones' | 'Ventas y Logística' | 'Avanzado e IA';
  icono: string;
}

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

      <!-- Encabezado de la vista -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div class="flex items-center space-x-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
            <span class="material-symbols-outlined text-[16px]">workspace_premium</span>
            <span>Membresía Empresarial</span>
          </div>
          <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Mi Suscripción</h1>
          <p class="text-sm text-gray-500 mt-1">
            Supervisa el estado del plan contratado, tus límites de capacidad y las funciones habilitadas para tu empresa.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            (click)="loadData()"
            class="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer shadow-2xs"
          >
            <span class="material-symbols-outlined text-[16px]" [class.animate-spin]="isLoading()">refresh</span>
            <span>Actualizar Datos</span>
          </button>
        </div>
      </div>

      <!-- Estado de carga -->
      <div *ngIf="isLoading()" class="flex flex-col items-center justify-center py-20 text-gray-500 space-y-3">
        <span class="material-symbols-outlined text-4xl text-indigo-600 animate-spin">progress_activity</span>
        <p class="text-sm font-medium">Cargando detalles de tu suscripción…</p>
      </div>

      <!-- Error de carga con botón de reintento -->
      <div *ngIf="!isLoading() && error()" class="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center space-x-3 text-rose-800">
          <span class="material-symbols-outlined text-2xl">error</span>
          <div>
            <p class="font-bold text-sm">Error al obtener información de suscripción</p>
            <p class="text-xs text-rose-600 mt-0.5">{{ error() }}</p>
          </div>
        </div>
        <button
          (click)="loadData()"
          class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shrink-0"
        >
          Reintentar
        </button>
      </div>

      <!-- Contenido principal -->
      <div *ngIf="!isLoading() && tenant() as data" class="space-y-8 animate-in fade-in duration-200">

        <!-- Banner de estado principal -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <!-- Tarjeta de Empresa y Plan Actual -->
          <div class="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
            <div>
              <div class="flex items-start justify-between gap-4 mb-4">
                <div class="flex items-center space-x-4">
                  <div class="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                    {{ data.empresa.nombre.substring(0, 2).toUpperCase() }}
                  </div>
                  <div>
                    <h2 class="text-xl font-bold text-gray-900 tracking-tight">{{ data.empresa.nombre }}</h2>
                    <p class="text-xs text-gray-400 font-medium">Identificador: {{ data.empresa.slug }} (ID: {{ data.empresa.idEmpresa }})</p>
                  </div>
                </div>

                <!-- Badge de plan -->
                <div class="px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs"
                     [ngClass]="getPlanBadgeClass(data.plan.codigo)">
                  {{ data.plan.nombre }}
                </div>
              </div>

              <p class="text-sm text-gray-600 leading-relaxed mt-4">
                Tu empresa está suscrita al <strong>{{ data.plan.nombre }}</strong>. Cuentas con capacidades operativas escalables y acceso garantizado a los módulos contratados.
              </p>
            </div>

            <div class="pt-6 mt-6 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div class="flex items-center space-x-2 text-xs text-gray-500">
                <span class="material-symbols-outlined text-[18px] text-gray-400">check_circle</span>
                <span>Código interno de plan: <code class="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{{ data.plan.codigo }}</code></span>
              </div>
              <div class="text-xs font-semibold text-indigo-600 flex items-center space-x-1">
                <span class="material-symbols-outlined text-[16px]">verified</span>
                <span>Plataforma YouShop Multitenant</span>
              </div>
            </div>
          </div>

          <!-- Tarjeta de Estado de Suscripción -->
          <div class="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
            <div>
              <span class="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">Vigencia y Estado</span>

              <!-- Badge de estado -->
              <div class="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border mb-4"
                   [ngClass]="getEstadoBadgeClass(data.suscripcion.estado)">
                <span class="w-2 h-2 rounded-full"
                      [ngClass]="data.suscripcion.estado === 'activa' ? 'bg-emerald-500' : 'bg-rose-500'"></span>
                <span>Suscripción {{ getEstadoLabel(data.suscripcion.estado) }}</span>
              </div>

              <div class="space-y-3 mt-2">
                <div>
                  <span class="text-xs text-gray-400 block">Fecha de vencimiento</span>
                  <p class="text-base font-bold text-gray-900">
                    {{ formatFecha(data.suscripcion.fechaFin) }}
                  </p>
                </div>

                <div *ngIf="data.suscripcion.estado !== 'activa'" class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  <p class="font-bold">Acción requerida:</p>
                  <p class="mt-0.5">Las modificaciones en el sistema se encuentran temporalmente suspendidas. Contactá al administrador para reactivarla.</p>
                </div>
              </div>
            </div>

            <div class="pt-4 border-t border-gray-100 text-[11px] text-gray-400 flex items-center space-x-1.5">
              <span class="material-symbols-outlined text-[14px]">lock</span>
              <span>Protección activa con Row Level Security</span>
            </div>
          </div>
        </div>

        <!-- Sección de Límites y Métricas de Uso -->
        <div class="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
          <div class="mb-6">
            <h3 class="text-lg font-bold text-gray-900 tracking-tight">Capacidad y Uso del Plan</h3>
            <p class="text-xs text-gray-500 mt-1">Supervisión en tiempo real de los recursos consumidos respecto al límite contratado.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

            <!-- Métrica: Sucursales -->
            <div class="p-5 rounded-xl border border-gray-100 bg-gray-50/70 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <span class="material-symbols-outlined text-[18px]">location_city</span>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wide">Sucursales</h4>
                    <span class="text-[11px] text-gray-500">Puntos de venta</span>
                  </div>
                </div>
                <span class="text-xs font-black" [ngClass]="getUsageTextColor(data.uso.sucursales, data.plan.limites.sucursales)">
                  {{ data.plan.limites.sucursales === null ? 'Ilimitado' : (getPercentage(data.uso.sucursales, data.plan.limites.sucursales) + '%') }}
                </span>
              </div>

              <div>
                <div class="flex justify-between items-baseline mb-1">
                  <span class="text-2xl font-black text-gray-900">{{ data.uso.sucursales }}</span>
                  <span class="text-xs text-gray-500">de {{ data.plan.limites.sucursales === null ? '∞ ilimitadas' : data.plan.limites.sucursales }}</span>
                </div>
                <!-- Barra de progreso -->
                <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [ngClass]="getUsageBarClass(data.uso.sucursales, data.plan.limites.sucursales)"
                    [style.width.%]="getPercentage(data.uso.sucursales, data.plan.limites.sucursales)"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Métrica: Usuarios del Personal -->
            <div class="p-5 rounded-xl border border-gray-100 bg-gray-50/70 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <span class="material-symbols-outlined text-[18px]">group</span>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wide">Usuarios</h4>
                    <span class="text-[11px] text-gray-500">Cuentas del personal</span>
                  </div>
                </div>
                <span class="text-xs font-black" [ngClass]="getUsageTextColor(data.uso.usuarios, data.plan.limites.usuarios)">
                  {{ data.plan.limites.usuarios === null ? 'Ilimitado' : (getPercentage(data.uso.usuarios, data.plan.limites.usuarios) + '%') }}
                </span>
              </div>

              <div>
                <div class="flex justify-between items-baseline mb-1">
                  <span class="text-2xl font-black text-gray-900">{{ data.uso.usuarios }}</span>
                  <span class="text-xs text-gray-500">de {{ data.plan.limites.usuarios === null ? '∞ ilimitados' : data.plan.limites.usuarios }}</span>
                </div>
                <!-- Barra de progreso -->
                <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [ngClass]="getUsageBarClass(data.uso.usuarios, data.plan.limites.usuarios)"
                    [style.width.%]="getPercentage(data.uso.usuarios, data.plan.limites.usuarios)"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Métrica: Productos en Catálogo -->
            <div class="p-5 rounded-xl border border-gray-100 bg-gray-50/70 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <span class="material-symbols-outlined text-[18px]">checkroom</span>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wide">Productos</h4>
                    <span class="text-[11px] text-gray-500">Prendas archivadas</span>
                  </div>
                </div>
                <span class="text-xs font-black" [ngClass]="getUsageTextColor(data.uso.productos, data.plan.limites.productos)">
                  {{ data.plan.limites.productos === null ? 'Ilimitado' : (getPercentage(data.uso.productos, data.plan.limites.productos) + '%') }}
                </span>
              </div>

              <div>
                <div class="flex justify-between items-baseline mb-1">
                  <span class="text-2xl font-black text-gray-900">{{ data.uso.productos }}</span>
                  <span class="text-xs text-gray-500">de {{ data.plan.limites.productos === null ? '∞ ilimitados' : data.plan.limites.productos }}</span>
                </div>
                <!-- Barra de progreso -->
                <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [ngClass]="getUsageBarClass(data.uso.productos, data.plan.limites.productos)"
                    [style.width.%]="getPercentage(data.uso.productos, data.plan.limites.productos)"
                  ></div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Matriz de Funcionalidades del Plan -->
        <div class="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
          <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 class="text-lg font-bold text-gray-900 tracking-tight">Módulos y Funciones de la Plataforma</h3>
              <p class="text-xs text-gray-500 mt-1">Conoce qué módulos están activos en tu suscripción y cuáles requieren subir de nivel.</p>
            </div>
            <span class="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 self-start sm:self-auto">
              {{ data.plan.features.length }} de 12 funciones activas
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              *ngFor="let feat of allFeatures"
              class="p-4 rounded-xl border transition-all"
              [ngClass]="hasFeature(data, feat.key)
                ? 'bg-white border-gray-200 shadow-2xs'
                : 'bg-gray-50/60 border-gray-100 opacity-60'"
            >
              <div class="flex items-start justify-between gap-3 mb-2">
                <div class="flex items-center space-x-2.5">
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    [ngClass]="hasFeature(data, feat.key)
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-gray-200 text-gray-400'"
                  >
                    <span class="material-symbols-outlined text-[18px]">{{ feat.icono }}</span>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-gray-900">{{ feat.nombre }}</h4>
                    <span class="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{{ feat.categoria }}</span>
                  </div>
                </div>

                <!-- Estado del feature -->
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                  [ngClass]="hasFeature(data, feat.key)
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'"
                >
                  {{ hasFeature(data, feat.key) ? 'Habilitado' : 'Bloqueado' }}
                </span>
              </div>

              <p class="text-xs text-gray-500 leading-relaxed pl-10">
                {{ feat.descripcion }}
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  `
})
export class SubscriptionComponent implements OnInit {
  tenant = signal<TenantMeResponse | null>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  allFeatures: FeatureItem[] = [
    { key: 'pos', nombre: 'Punto de Venta (POS)', descripcion: 'Caja presencial en tienda física con emisión rápida de tickets.', categoria: 'Operaciones', icono: 'point_of_sale' },
    { key: 'inventario', nombre: 'Inventario Global', descripcion: 'Gestión multialmacén de stock y ajustes de prendas en tiempo real.', categoria: 'Operaciones', icono: 'inventory_2' },
    { key: 'ventas', nombre: 'Ventas y Facturación', descripcion: 'Registro histórico y balance detallado de todas las transacciones.', categoria: 'Operaciones', icono: 'receipt_long' },
    { key: 'reportes', nombre: 'Reportes Básicos', descripcion: 'Reportes de ventas e inventario con filtros de sucursal y fecha.', categoria: 'Operaciones', icono: 'summarize' },
    { key: 'despachos', nombre: 'Despachos y Logística', descripcion: 'Traspasos entre sucursales y despachos de mercadería asegurados.', categoria: 'Ventas y Logística', icono: 'local_shipping' },
    { key: 'reservas', nombre: 'Reservas de Clientes', descripcion: 'Reserva anticipada de prendas con seña digital en boutiques.', categoria: 'Ventas y Logística', icono: 'event_available' },
    { key: 'pagos_online', nombre: 'Pagos en Línea', descripcion: 'Pasarelas de cobro digitales integradas para compras remotas.', categoria: 'Ventas y Logística', icono: 'credit_card' },
    { key: 'app_movil', nombre: 'Aplicación Móvil', descripcion: 'Sincronización de catálogo y reservas con la aplicación móvil.', categoria: 'Ventas y Logística', icono: 'smartphone' },
    { key: 'reportes_avanzados', nombre: 'Reportes Avanzados e Indicadores', descripcion: 'Dashboard analítico con KPIs estratégicos y análisis temporal.', categoria: 'Avanzado e IA', icono: 'insights' },
    { key: 'reportes_export', nombre: 'Exportación de Datos', descripcion: 'Descarga de datos de ventas e inventario en hojas de cálculo y PDF.', categoria: 'Avanzado e IA', icono: 'file_download' },
    { key: 'ia', nombre: 'Asistente de IA', descripcion: 'Recomendaciones inteligentes de productos y análisis automático.', categoria: 'Avanzado e IA', icono: 'smart_toy' },
    { key: 'probador', nombre: 'Probador Virtual', descripcion: 'Experiencia interactiva con visualización aumentada de prendas.', categoria: 'Avanzado e IA', icono: 'styler' },
  ];

  constructor(
    private tenantService: TenantService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.error.set(null);

    this.tenantService.getTenantMe().subscribe({
      next: (res) => {
        this.tenant.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        // Fallback constructivo si el backend aún no responde o hay error
        const empresa = this.authService.empresa();
        const plan = this.authService.plan();
        const suscripcion = this.authService.suscripcion();

        if (empresa && plan && suscripcion) {
          this.tenant.set({
            empresa,
            plan,
            suscripcion,
            uso: { sucursales: 1, usuarios: 1, productos: 0 }
          });
          this.isLoading.set(false);
        } else {
          this.error.set(err.error?.detail?.message || err.error?.detail || 'No se pudo contactar al servidor de tenant.');
          this.isLoading.set(false);
        }
      }
    });
  }

  hasFeature(data: TenantMeResponse, key: string): boolean {
    return data.plan.features.includes(key);
  }

  getPercentage(current: number, limit: number | null): number {
    if (limit === null || limit <= 0) return 100;
    return Math.min(100, Math.round((current / limit) * 100));
  }

  getUsageBarClass(current: number, limit: number | null): string {
    if (limit === null) return 'bg-emerald-500';
    const pct = (current / limit) * 100;
    if (pct >= 100) return 'bg-rose-500';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-indigo-600';
  }

  getUsageTextColor(current: number, limit: number | null): string {
    if (limit === null) return 'text-emerald-700';
    const pct = (current / limit) * 100;
    if (pct >= 100) return 'text-rose-600';
    if (pct >= 80) return 'text-amber-600';
    return 'text-indigo-600';
  }

  getPlanBadgeClass(codigo: string): string {
    const c = codigo.toLowerCase();
    if (c === 'avanzado') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (c === 'intermedio') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  getEstadoBadgeClass(estado: string): string {
    const e = estado.toLowerCase();
    if (e === 'activa') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (e === 'suspendida') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }

  getEstadoLabel(estado: string): string {
    const e = estado.toLowerCase();
    if (e === 'activa') return 'Activa';
    if (e === 'suspendida') return 'Suspendida';
    if (e === 'vencida') return 'Vencida';
    return estado;
  }

  formatFecha(fecha: string | null): string {
    if (!fecha) return 'Sin fecha límite definida';
    return fecha;
  }
}
