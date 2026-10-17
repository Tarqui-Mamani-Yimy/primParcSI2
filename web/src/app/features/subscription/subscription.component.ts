import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantService } from '../../core/services/tenant.service';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { NotificationService } from '../../core/services/notification.service';
import { BillingCycle, TenantMeResponse } from '../../core/models';

interface FeatureItem {
  key: string;
  nombre: string;
  descripcion: string;
  categoria: 'Operaciones' | 'Ventas y Logística' | 'Avanzado e IA';
  icono: string;
}

interface PlanCard {
  codigo: string;
  nombre: string;
  precioMensual: number;
  precioAnual: number;
  descripcion: string;
  limites: {
    sucursales: number | null;
    usuarios: number | null;
    productos: number | null;
  };
  destacado?: boolean;
  features: string[];
}

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

      <!-- Encabezado de la vista -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E8E2DA]">
        <div>
          <div class="flex items-center space-x-2 text-xs font-bold text-[#38133E] uppercase tracking-wider mb-1">
            <span class="material-symbols-outlined text-[16px]">workspace_premium</span>
            <span>Membresía Empresarial</span>
          </div>
          <h1 class="text-2xl lg:text-3xl font-bold text-[#17141A] tracking-tight">Mi Suscripción</h1>
          <p class="text-sm text-[#5A5561] mt-1">
            Supervisa el estado del plan contratado, tus límites de capacidad, facturación automática y módulos habilitados.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            *ngIf="tenant()?.facturacion?.modo === 'stripe'"
            (click)="openPortal()"
            [disabled]="loadingPortal() || loadingPlan() !== null"
            class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer shadow-xs"
            title="Abrir portal de Stripe para gestionar métodos de pago y facturas"
          >
            <span *ngIf="loadingPortal()" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            <span *ngIf="!loadingPortal()" class="material-symbols-outlined text-[16px]">manage_accounts</span>
            <span>Gestionar Facturación</span>
          </button>

          <button
            (click)="loadData()"
            class="px-4 py-2 bg-white hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#17141A] rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer shadow-2xs"
          >
            <span class="material-symbols-outlined text-[16px]" [class.animate-spin]="isLoading()">refresh</span>
            <span>Actualizar Datos</span>
          </button>
        </div>
      </div>

      <!-- Estado de carga -->
      <div *ngIf="isLoading()" class="flex flex-col items-center justify-center py-20 text-[#5A5561] space-y-3">
        <span class="material-symbols-outlined text-4xl text-[#38133E] animate-spin">progress_activity</span>
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

        <!-- Llamado a la Acción para Empresa Vencida o Suspendida (SF5) -->
        <div
          *ngIf="data.suscripcion.estado !== 'activa'"
          class="p-6 bg-gradient-to-r from-rose-50 via-rose-100/50 to-amber-50 border-2 border-rose-300 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-sm"
        >
          <div class="flex items-start space-x-4 text-rose-950">
            <div class="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <span class="material-symbols-outlined text-2xl">error</span>
            </div>
            <div>
              <div class="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-200 text-rose-900 border border-rose-300 mb-1">
                <span>Estado: {{ getEstadoLabel(data.suscripcion.estado) }}</span>
              </div>
              <h2 class="text-lg font-bold text-rose-950 tracking-tight">Tu suscripción requiere regularización</h2>
              <p class="text-xs text-rose-800 mt-1 max-w-2xl leading-relaxed">
                Las operaciones de modificación, creación y facturación se encuentran bloqueadas temporalmente. Paga tu suscripción ahora con Stripe para restablecer el acceso completo a todas las funciones sin demoras.
              </p>
            </div>
          </div>

          <div class="shrink-0 flex items-center space-x-3 w-full md:w-auto">
            <button
              (click)="subscribeToPlan(data.plan.codigo)"
              [disabled]="loadingPlan() !== null || loadingPortal() || !canManageBilling"
              class="w-full md:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span *ngIf="loadingPlan() === data.plan.codigo" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              <span *ngIf="loadingPlan() !== data.plan.codigo" class="material-symbols-outlined text-[18px]">credit_card</span>
              <span>Pagar Suscripción</span>
            </button>
          </div>
        </div>

        <!-- Aviso de Cancelación al Final del Período (SF2) -->
        <div
          *ngIf="data.facturacion?.cancelaAlFinal"
          class="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900"
        >
          <div class="flex items-center space-x-3">
            <span class="material-symbols-outlined text-2xl text-amber-600">event_busy</span>
            <div>
              <p class="font-bold text-xs uppercase tracking-wider text-amber-800">Cancelación Programada</p>
              <p class="text-xs text-amber-700 mt-0.5">
                Tu suscripción no se renovará automáticamente al finalizar el período actual ({{ formatFecha(data.facturacion?.proximoCobro || data.suscripcion.fechaFin) }}). Puedes reanudar la renovación en cualquier momento desde el portal de Stripe.
              </p>
            </div>
          </div>
          <button
            (click)="openPortal()"
            [disabled]="loadingPortal() || loadingPlan() !== null || !canManageBilling"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shrink-0 flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <span *ngIf="loadingPortal()" class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
            <span>Reactivar en Portal</span>
          </button>
        </div>

        <!-- Tarjetas de Información Superior (3 Columnas) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

          <!-- Tarjeta 1: Empresa y Plan Actual -->
          <div class="bg-white rounded-2xl border border-[#E8E2DA] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div class="flex items-start justify-between gap-3 mb-4">
                <div class="flex items-center space-x-3 min-w-0">
                  <div class="w-12 h-12 rounded-2xl bg-[#38133E] text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
                    {{ data.empresa.nombre.substring(0, 2).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <h2 class="text-base font-bold text-[#17141A] tracking-tight truncate">{{ data.empresa.nombre }}</h2>
                    <p class="text-xs text-[#9B94A3] font-mono truncate">{{ data.empresa.slug }}</p>
                  </div>
                </div>

                <div class="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border shrink-0 shadow-2xs"
                     [ngClass]="getPlanBadgeClass(data.plan.codigo)">
                  {{ data.plan.nombre }}
                </div>
              </div>

              <p class="text-xs text-[#5A5561] leading-relaxed">
                Tu empresa está suscrita al <strong>{{ data.plan.nombre }}</strong> con límites adaptados a la escala de tu negocio.
              </p>
            </div>

            <div class="pt-4 mt-4 border-t border-[#E8E2DA] flex items-center justify-between text-xs text-[#5A5561]">
              <span>Cód. plan: <code class="font-mono text-[#17141A] bg-[#F3EFEA] px-1 py-0.5 rounded">{{ data.plan.codigo }}</code></span>
              <span>ID #{{ data.empresa.idEmpresa }}</span>
            </div>
          </div>

          <!-- Tarjeta 2: Vigencia y Estado -->
          <div class="bg-white rounded-2xl border border-[#E8E2DA] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <span class="text-xs font-bold text-[#9B94A3] uppercase tracking-wider block mb-3">Vigencia y Estado</span>

              <div class="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border mb-4"
                   [ngClass]="getEstadoBadgeClass(data.suscripcion.estado)">
                <span class="w-2 h-2 rounded-full"
                      [ngClass]="data.suscripcion.estado === 'activa' ? 'bg-[#16A34A]' : 'bg-rose-500'"></span>
                <span>Suscripción {{ getEstadoLabel(data.suscripcion.estado) }}</span>
              </div>

              <div class="space-y-2 mt-1">
                <div>
                  <span class="text-[11px] text-[#9B94A3] block">Vencimiento del período</span>
                  <p class="text-sm font-bold text-[#17141A]">
                    {{ formatFecha(data.suscripcion.fechaFin) }}
                  </p>
                </div>
                <p class="text-[11px] text-[#5A5561] leading-normal" *ngIf="data.suscripcion.estado === 'activa'">
                  Suscripción vigente con todas las capacidades habilitadas.
                </p>
              </div>
            </div>

            <div class="pt-4 border-t border-[#E8E2DA] text-[11px] text-[#9B94A3] flex items-center space-x-1.5">
              <span class="material-symbols-outlined text-[14px]">shield</span>
              <span>Seguridad RLS y aislamiento tenant</span>
            </div>
          </div>

          <!-- Tarjeta 3: Facturación Automática (SF2) -->
          <div class="bg-white rounded-2xl border border-[#E8E2DA] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold text-[#9B94A3] uppercase tracking-wider">Facturación y Cobro</span>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                  [ngClass]="data.facturacion?.modo === 'stripe' ? 'bg-[#F5EBF7] text-[#38133E] border-[#E8E2DA]' : 'bg-[#F3EFEA] text-[#5A5561] border-[#E8E2DA]'"
                >
                  {{ data.facturacion?.modo === 'stripe' ? 'Stripe Auto' : 'Manual' }}
                </span>
              </div>

              <div class="space-y-3">
                <div>
                  <span class="text-[11px] text-[#9B94A3] block">Próximo cobro</span>
                  <p class="text-sm font-bold text-[#17141A]">
                    {{ formatFecha(data.facturacion?.proximoCobro) }}
                  </p>
                </div>

                <div>
                  <span class="text-[11px] text-[#9B94A3] block">Ciclo de facturación</span>
                  <p class="text-xs font-semibold capitalize text-[#17141A]">
                    {{ data.facturacion?.ciclo ? (data.facturacion?.ciclo === 'anual' ? 'Anual (-20%)' : 'Mensual') : 'Mensual' }}
                  </p>
                </div>

                <div>
                  <span class="text-[11px] text-[#9B94A3] block">Renovación</span>
                  <p class="text-xs font-semibold" [ngClass]="data.facturacion?.renovacionAutomatica ? 'text-[#16A34A]' : 'text-[#5A5561]'">
                    {{ data.facturacion?.renovacionAutomatica ? 'Automática por tarjeta' : 'Manual / No configurada' }}
                  </p>
                </div>
              </div>
            </div>

            <div class="pt-4 mt-4 border-t border-[#E8E2DA]">
              <button
                *ngIf="data.facturacion?.modo === 'stripe'"
                (click)="openPortal()"
                [disabled]="loadingPortal() || loadingPlan() !== null || !canManageBilling"
                class="w-full py-2 px-3 bg-[#F5EBF7] hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#38133E] rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
              >
                <span *ngIf="loadingPortal()" class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                <span *ngIf="!loadingPortal()" class="material-symbols-outlined text-[15px]">credit_card</span>
                <span>Portal de Facturación</span>
              </button>

              <div *ngIf="data.facturacion?.modo !== 'stripe'" class="text-[11px] text-[#9B94A3] flex items-center space-x-1.5">
                <span class="material-symbols-outlined text-[14px]">info</span>
                <span>Facturación manual por SuperAdmin</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Sección: Planes Disponibles con Checkout y Portal (SF2) -->
        <div class="bg-white rounded-2xl border border-[#E8E2DA] p-6 sm:p-8 shadow-xs space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E8E2DA] pb-4">
            <div>
              <div class="flex items-center space-x-2 text-xs font-bold text-[#38133E] uppercase tracking-wider mb-1">
                <span class="material-symbols-outlined text-[16px]">price_change</span>
                <span>Tarifas Oficiales</span>
              </div>
              <h3 class="text-lg font-bold text-[#17141A] tracking-tight">Planes de Suscripción</h3>
              <p class="text-xs text-[#5A5561] mt-0.5">
                Actualiza tu suscripción automáticamente con tarjeta de crédito mediante Stripe Checkout o administra tu plan desde el portal.
              </p>
            </div>

            <!-- Selector de ciclo: Mensual / Anual -->
            <div class="flex items-center bg-[#F3EFEA] p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                (click)="selectedCiclo.set('mensual')"
                [class.bg-white]="selectedCiclo() === 'mensual'"
                [class.shadow-xs]="selectedCiclo() === 'mensual'"
                [class.text-ys-primary]="selectedCiclo() === 'mensual'"
                [class.font-bold]="selectedCiclo() === 'mensual'"
                [class.text-ys-muted]="selectedCiclo() !== 'mensual'"
                class="px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
              >
                Mensual
              </button>
              <button
                type="button"
                (click)="selectedCiclo.set('anual')"
                [class.bg-white]="selectedCiclo() === 'anual'"
                [class.shadow-xs]="selectedCiclo() === 'anual'"
                [class.text-ys-primary]="selectedCiclo() === 'anual'"
                [class.font-bold]="selectedCiclo() === 'anual'"
                [class.text-ys-muted]="selectedCiclo() !== 'anual'"
                class="px-3 py-1.5 rounded-lg text-xs transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Anual</span>
                <span class="px-1.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-[#DCFCE7] text-[#16A34A]">
                  -20%
                </span>
              </button>
            </div>
          </div>

          <!-- Mensaje informativo de permisos si no es admin -->
          <div *ngIf="!canManageBilling" class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-2">
            <span class="material-symbols-outlined text-[18px]">lock</span>
            <span>Solo los usuarios con rol Administrador pueden contratar o cambiar el plan de suscripción.</span>
          </div>

          <!-- Tarjetas de planes -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              *ngFor="let p of availablePlans"
              class="rounded-2xl border p-6 flex flex-col justify-between transition-all relative"
              [ngClass]="p.codigo === data.plan.codigo
                ? 'border-[#38133E] bg-[#F5EBF7]/30 ring-2 ring-[#38133E]/20 shadow-sm'
                : (p.destacado ? 'border-[#38133E]/40 bg-[#FAF8F5] shadow-2xs' : 'border-[#E8E2DA] bg-white')"
            >
              <!-- Badge de Plan Actual o Recomendado -->
              <div *ngIf="p.codigo === data.plan.codigo" class="absolute -top-3 right-5">
                <span class="px-3 py-1 bg-[#38133E] text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs">
                  Tu Plan Actual
                </span>
              </div>
              <div *ngIf="p.codigo !== data.plan.codigo && p.destacado" class="absolute -top-3 right-5">
                <span class="px-3 py-1 bg-[#260B2B] text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs">
                  Recomendado
                </span>
              </div>

              <div>
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-base font-bold text-[#17141A]">{{ p.nombre }}</h4>
                  <span class="font-mono text-[11px] text-[#9B94A3]">#{{ p.codigo }}</span>
                </div>

                <!-- Precio -->
                <div class="mb-4">
                  <div class="flex items-baseline space-x-1.5">
                    <span class="text-3xl font-black text-[#17141A]">\${{ getPlanMonthlyEquivalent(p) }}</span>
                    <span class="text-xs font-bold text-[#5A5561] uppercase tracking-wider">USD / mes</span>
                  </div>
                  <p class="text-[11px] text-[#16A34A] font-medium mt-1" *ngIf="selectedCiclo() === 'anual'">
                    Facturado anualmente: \${{ p.precioAnual }} USD / año (-20%)
                  </p>
                  <p class="text-xs text-[#5A5561] mt-1.5 leading-relaxed">{{ p.descripcion }}</p>
                </div>

                <!-- Límites de capacidad -->
                <div class="space-y-2 py-4 border-y border-[#E8E2DA] text-xs">
                  <div class="flex items-center justify-between">
                    <span class="text-[#5A5561] flex items-center space-x-1.5">
                      <span class="material-symbols-outlined text-[15px] text-[#9B94A3]">location_city</span>
                      <span>Sucursales:</span>
                    </span>
                    <span class="font-bold text-[#17141A]">
                      {{ p.limites.sucursales === null ? 'Ilimitadas' : p.limites.sucursales }}
                    </span>
                  </div>

                  <div class="flex items-center justify-between">
                    <span class="text-[#5A5561] flex items-center space-x-1.5">
                      <span class="material-symbols-outlined text-[15px] text-[#9B94A3]">group</span>
                      <span>Usuarios staff:</span>
                    </span>
                    <span class="font-bold text-[#17141A]">
                      {{ p.limites.usuarios === null ? 'Ilimitados' : p.limites.usuarios }}
                    </span>
                  </div>

                  <div class="flex items-center justify-between">
                    <span class="text-[#5A5561] flex items-center space-x-1.5">
                      <span class="material-symbols-outlined text-[15px] text-[#9B94A3]">checkroom</span>
                      <span>Productos:</span>
                    </span>
                    <span class="font-bold text-[#17141A]">
                      {{ p.limites.productos === null ? 'Ilimitados' : p.limites.productos }}
                    </span>
                  </div>
                </div>

                <!-- Lista de funciones clave -->
                <div class="py-4 space-y-2">
                  <span class="text-[10px] font-bold text-[#9B94A3] uppercase tracking-wider block">Incluye:</span>
                  <div *ngFor="let f of p.features" class="flex items-center space-x-2 text-xs text-[#17141A]">
                    <span class="material-symbols-outlined text-[15px] text-[#16A34A]">check_circle</span>
                    <span>{{ f }}</span>
                  </div>
                </div>
              </div>

              <!-- Botones de Acción (Suscribirme / Cambiar Plan / Pagar Suscripción) -->
              <div class="pt-4 mt-2 border-t border-[#E8E2DA]">

                <!-- CASO 1: Es el plan actual -->
                <ng-container *ngIf="p.codigo === data.plan.codigo">
                  <!-- Si la suscripción está activa y en modo stripe -->
                  <button
                    *ngIf="data.suscripcion.estado === 'activa' && data.facturacion?.modo === 'stripe'"
                    (click)="openPortal()"
                    [disabled]="loadingPortal() || loadingPlan() !== null || !canManageBilling"
                    class="w-full py-2.5 px-4 bg-[#F5EBF7] hover:bg-[#F3EFEA] disabled:opacity-50 border border-[#E8E2DA] text-[#38133E] rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
                  >
                    <span *ngIf="loadingPortal()" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span *ngIf="!loadingPortal()" class="material-symbols-outlined text-[16px]">manage_accounts</span>
                    <span>Gestionar en Portal</span>
                  </button>

                  <!-- Si la suscripción está activa y en modo manual -->
                  <button
                    *ngIf="data.suscripcion.estado === 'activa' && data.facturacion?.modo !== 'stripe'"
                    (click)="subscribeToPlan(p.codigo)"
                    [disabled]="loadingPlan() !== null || loadingPortal() || !canManageBilling"
                    class="w-full py-2.5 px-4 bg-[#38133E] hover:bg-[#260B2B] disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                  >
                    <span *ngIf="loadingPlan() === p.codigo" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span *ngIf="loadingPlan() !== p.codigo" class="material-symbols-outlined text-[16px]">autorenew</span>
                    <span>Activar Cobro Automático</span>
                  </button>

                  <!-- Si la suscripción NO está activa (vencida o suspendida) -->
                  <button
                    *ngIf="data.suscripcion.estado !== 'activa'"
                    (click)="subscribeToPlan(p.codigo)"
                    [disabled]="loadingPlan() !== null || loadingPortal() || !canManageBilling"
                    class="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                  >
                    <span *ngIf="loadingPlan() === p.codigo" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span *ngIf="loadingPlan() !== p.codigo" class="material-symbols-outlined text-[16px]">credit_card</span>
                    <span>Pagar Suscripción (\${{ getPlanBilledAmount(p) }} {{ selectedCiclo() === 'anual' ? 'USD/año' : 'USD/mes' }})</span>
                  </button>
                </ng-container>

                <!-- CASO 2: Es un plan diferente -->
                <ng-container *ngIf="p.codigo !== data.plan.codigo">
                  <!-- Si la empresa ya tiene Stripe activo, el cambio de plan se hace vía Customer Portal -->
                  <button
                    *ngIf="data.suscripcion.estado === 'activa' && data.facturacion?.modo === 'stripe'"
                    (click)="openPortal()"
                    [disabled]="loadingPortal() || loadingPlan() !== null || !canManageBilling"
                    class="w-full py-2.5 px-4 bg-[#38133E] hover:bg-[#260B2B] disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                  >
                    <span *ngIf="loadingPortal()" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span *ngIf="!loadingPortal()" class="material-symbols-outlined text-[16px]">upgrade</span>
                    <span>Cambiar Plan</span>
                  </button>

                  <!-- Si está en modo manual o inactivo, se suscribe con Stripe Checkout -->
                  <button
                    *ngIf="!(data.suscripcion.estado === 'activa' && data.facturacion?.modo === 'stripe')"
                    (click)="subscribeToPlan(p.codigo)"
                    [disabled]="loadingPlan() !== null || loadingPortal() || !canManageBilling"
                    class="w-full py-2.5 px-4 bg-[#38133E] hover:bg-[#260B2B] disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                  >
                    <span *ngIf="loadingPlan() === p.codigo" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span *ngIf="loadingPlan() !== p.codigo" class="material-symbols-outlined text-[16px]">shopping_cart_checkout</span>
                    <span>Suscribirme (\${{ getPlanBilledAmount(p) }} {{ selectedCiclo() === 'anual' ? 'USD/año' : 'USD/mes' }})</span>
                  </button>
                </ng-container>

              </div>
            </div>
          </div>
        </div>

        <!-- Sección de Límites y Métricas de Uso -->
        <div class="bg-white rounded-2xl border border-[#E8E2DA] p-6 sm:p-8 shadow-xs">
          <div class="mb-6">
            <h3 class="text-lg font-bold text-[#17141A] tracking-tight">Capacidad y Uso del Plan</h3>
            <p class="text-xs text-[#5A5561] mt-1">Supervisión en tiempo real de los recursos consumidos respecto al límite contratado.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

            <!-- Métrica: Sucursales -->
            <div class="p-5 rounded-xl border border-[#E8E2DA] bg-[#FAF8F5] space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-[#F5EBF7] text-[#38133E] flex items-center justify-center">
                    <span class="material-symbols-outlined text-[18px]">location_city</span>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Sucursales</h4>
                    <span class="text-[11px] text-[#5A5561]">Puntos de venta</span>
                  </div>
                </div>
                <span class="text-xs font-black" [ngClass]="getUsageTextColor(data.uso.sucursales, data.plan.limites.sucursales)">
                  {{ data.plan.limites.sucursales === null ? 'Ilimitado' : (getPercentage(data.uso.sucursales, data.plan.limites.sucursales) + '%') }}
                </span>
              </div>

              <div>
                <div class="flex justify-between items-baseline mb-1">
                  <span class="text-2xl font-black text-[#17141A]">{{ data.uso.sucursales }}</span>
                  <span class="text-xs text-[#5A5561]">de {{ data.plan.limites.sucursales === null ? '∞ ilimitadas' : data.plan.limites.sucursales }}</span>
                </div>
                <!-- Barra de progreso -->
                <div class="w-full h-2 bg-[#E8E2DA] rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [ngClass]="getUsageBarClass(data.uso.sucursales, data.plan.limites.sucursales)"
                    [style.width.%]="getPercentage(data.uso.sucursales, data.plan.limites.sucursales)"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Métrica: Usuarios del Personal -->
            <div class="p-5 rounded-xl border border-[#E8E2DA] bg-[#FAF8F5] space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-[#F5EBF7] text-[#38133E] flex items-center justify-center">
                    <span class="material-symbols-outlined text-[18px]">group</span>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Usuarios</h4>
                    <span class="text-[11px] text-[#5A5561]">Cuentas del personal</span>
                  </div>
                </div>
                <span class="text-xs font-black" [ngClass]="getUsageTextColor(data.uso.usuarios, data.plan.limites.usuarios)">
                  {{ data.plan.limites.usuarios === null ? 'Ilimitado' : (getPercentage(data.uso.usuarios, data.plan.limites.usuarios) + '%') }}
                </span>
              </div>

              <div>
                <div class="flex justify-between items-baseline mb-1">
                  <span class="text-2xl font-black text-[#17141A]">{{ data.uso.usuarios }}</span>
                  <span class="text-xs text-[#5A5561]">de {{ data.plan.limites.usuarios === null ? '∞ ilimitados' : data.plan.limites.usuarios }}</span>
                </div>
                <!-- Barra de progreso -->
                <div class="w-full h-2 bg-[#E8E2DA] rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    [ngClass]="getUsageBarClass(data.uso.usuarios, data.plan.limites.usuarios)"
                    [style.width.%]="getPercentage(data.uso.usuarios, data.plan.limites.usuarios)"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Métrica: Productos en Catálogo -->
            <div class="p-5 rounded-xl border border-[#E8E2DA] bg-[#FAF8F5] space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
                    <span class="material-symbols-outlined text-[18px]">checkroom</span>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-[#17141A] uppercase tracking-wide">Productos</h4>
                    <span class="text-[11px] text-[#5A5561]">Prendas archivadas</span>
                  </div>
                </div>
                <span class="text-xs font-black" [ngClass]="getUsageTextColor(data.uso.productos, data.plan.limites.productos)">
                  {{ data.plan.limites.productos === null ? 'Ilimitado' : (getPercentage(data.uso.productos, data.plan.limites.productos) + '%') }}
                </span>
              </div>

              <div>
                <div class="flex justify-between items-baseline mb-1">
                  <span class="text-2xl font-black text-[#17141A]">{{ data.uso.productos }}</span>
                  <span class="text-xs text-[#5A5561]">de {{ data.plan.limites.productos === null ? '∞ ilimitados' : data.plan.limites.productos }}</span>
                </div>
                <!-- Barra de progreso -->
                <div class="w-full h-2 bg-[#E8E2DA] rounded-full overflow-hidden">
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
        <div class="bg-white rounded-2xl border border-[#E8E2DA] p-6 sm:p-8 shadow-xs">
          <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 class="text-lg font-bold text-[#17141A] tracking-tight">Módulos y Funciones de la Plataforma</h3>
              <p class="text-xs text-[#5A5561] mt-1">Conoce qué módulos están activos en tu suscripción y cuáles requieren subir de nivel.</p>
            </div>
            <span class="text-xs font-bold text-[#38133E] bg-[#F5EBF7] px-3 py-1 rounded-full border border-[#E8E2DA] self-start sm:self-auto">
              {{ data.plan.features.length }} de 12 funciones activas
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              *ngFor="let feat of allFeatures"
              class="p-4 rounded-xl border transition-all"
              [ngClass]="hasFeature(data, feat.key)
                ? 'bg-white border-[#E8E2DA] shadow-2xs'
                : 'bg-[#FAF8F5]/60 border-[#E8E2DA]/50 opacity-60'"
            >
              <div class="flex items-start justify-between gap-3 mb-2">
                <div class="flex items-center space-x-2.5">
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    [ngClass]="hasFeature(data, feat.key)
                      ? 'bg-[#F5EBF7] text-[#38133E]'
                      : 'bg-[#F3EFEA] text-[#9B94A3]'"
                  >
                    <span class="material-symbols-outlined text-[18px]">{{ feat.icono }}</span>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-[#17141A]">{{ feat.nombre }}</h4>
                    <span class="text-[10px] uppercase tracking-wider text-[#9B94A3] font-semibold">{{ feat.categoria }}</span>
                  </div>
                </div>

                <!-- Estado del feature -->
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                  [ngClass]="hasFeature(data, feat.key)
                    ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#DCFCE7]'
                    : 'bg-[#F3EFEA] text-[#5A5561] border border-[#E8E2DA]'"
                >
                  {{ hasFeature(data, feat.key) ? 'Habilitado' : 'Bloqueado' }}
                </span>
              </div>

              <p class="text-xs text-[#5A5561] leading-relaxed pl-10">
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

  loadingPlan = signal<string | null>(null);
  loadingPortal = signal<boolean>(false);
  selectedCiclo = signal<BillingCycle>('mensual');

  availablePlans: PlanCard[] = [
    {
      codigo: 'basico',
      nombre: 'Básico',
      precioMensual: 290,
      precioAnual: 2784,
      descripcion: 'Ideal para boutiques que inician su digitalización y operaciones.',
      limites: { sucursales: 1, usuarios: 3, productos: 200 },
      features: ['Punto de Venta (POS)', 'Inventario Global', 'Ventas y Facturación', 'Reportes Básicos'],
    },
    {
      codigo: 'intermedio',
      nombre: 'Intermedio',
      precioMensual: 690,
      precioAnual: 6624,
      descripcion: 'Para marcas en expansión con múltiples sucursales y canales online.',
      limites: { sucursales: 5, usuarios: 15, productos: 2000 },
      destacado: true,
      features: ['Todo lo de Básico', 'Despachos y Logística', 'Reservas de Clientes', 'Pagos en Línea', 'Aplicación Móvil', 'Reportes Avanzados'],
    },
    {
      codigo: 'avanzado',
      nombre: 'Avanzado',
      precioMensual: 1490,
      precioAnual: 14304,
      descripcion: 'Potencia empresarial sin límites con inteligencia artificial y probador virtual.',
      limites: { sucursales: null, usuarios: null, productos: null },
      features: ['Todo lo de Intermedio', 'Sucursales y productos ilimitados', 'Exportación de Datos', 'Asistente de IA', 'Probador Virtual'],
    },
  ];

  getPlanMonthlyEquivalent(p: PlanCard): number {
    return this.selectedCiclo() === 'anual' ? Math.round(p.precioAnual / 12) : p.precioMensual;
  }

  getPlanBilledAmount(p: PlanCard): number {
    return this.selectedCiclo() === 'anual' ? p.precioAnual : p.precioMensual;
  }

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
    private authService: AuthService,
    private billingService: BillingService,
    private notificationService: NotificationService
  ) {}

  get canManageBilling(): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    return user.rol === 'Administrador' || user.permisos.includes('suscripcion.gestionar');
  }

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
            uso: { sucursales: 1, usuarios: 1, productos: 0 },
            facturacion: {
              modo: 'manual',
              renovacionAutomatica: false,
              proximoCobro: suscripcion.fechaFin,
              cancelaAlFinal: false,
            }
          });
          this.isLoading.set(false);
        } else {
          this.error.set(err.error?.detail?.message || err.error?.detail || 'No se pudo contactar al servidor de tenant.');
          this.isLoading.set(false);
        }
      }
    });
  }

  subscribeToPlan(codigoPlan: string): void {
    if (!this.canManageBilling) {
      this.notificationService.warning(
        'Acceso denegado',
        'Solo los administradores de la empresa pueden gestionar la suscripción.'
      );
      return;
    }

    const t = this.tenant();
    // Si ya tiene Stripe activo y quiere cambiar de plan, el contrato indica usar el Portal
    if (t?.facturacion?.modo === 'stripe' && t.suscripcion.estado === 'activa' && t.plan.codigo !== codigoPlan) {
      this.openPortal();
      return;
    }

    this.loadingPlan.set(codigoPlan);

    this.billingService.createCheckoutSession(codigoPlan, this.selectedCiclo()).subscribe({
      next: (res) => {
        if (res.url) {
          window.location.href = res.url;
        } else {
          this.loadingPlan.set(null);
          this.notificationService.error(
            'Error al procesar pago',
            'No se recibió la dirección de Stripe Checkout.'
          );
        }
      },
      error: (err) => {
        this.loadingPlan.set(null);
        // Si el backend devuelve 409 billing_already_active, dirigir al portal
        if (err.status === 409 && err.error?.detail?.code === 'billing_already_active') {
          this.openPortal();
        } else if (!err.multitenantHandled) {
          this.notificationService.error(
            'Error al iniciar suscripción',
            err.error?.detail || 'No se pudo iniciar la sesión de pago con Stripe.'
          );
        }
      }
    });
  }

  openPortal(): void {
    if (!this.canManageBilling) {
      this.notificationService.warning(
        'Acceso denegado',
        'Solo los administradores de la empresa pueden gestionar la facturación.'
      );
      return;
    }

    this.loadingPortal.set(true);

    this.billingService.createPortalSession().subscribe({
      next: (res) => {
        if (res.url) {
          window.location.href = res.url;
        } else {
          this.loadingPortal.set(false);
          this.notificationService.error(
            'Error al abrir portal',
            'No se recibió la dirección del portal de Stripe.'
          );
        }
      },
      error: (err) => {
        this.loadingPortal.set(false);
        if (!err.multitenantHandled) {
          this.notificationService.error(
            'Error en portal de facturación',
            err.error?.detail || 'No se pudo generar la sesión del portal.'
          );
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
    if (limit === null) return 'bg-[#16A34A]';
    const pct = (current / limit) * 100;
    if (pct >= 100) return 'bg-rose-500';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-[#38133E]';
  }

  getUsageTextColor(current: number, limit: number | null): string {
    if (limit === null) return 'text-[#16A34A]';
    const pct = (current / limit) * 100;
    if (pct >= 100) return 'text-rose-600';
    if (pct >= 80) return 'text-amber-600';
    return 'text-[#38133E]';
  }

  getPlanBadgeClass(codigo: string): string {
    const c = (codigo || '').toLowerCase();
    if (c === 'avanzado') return 'bg-[#F5EBF7] text-[#38133E] border-[#E8E2DA]';
    if (c === 'intermedio') return 'bg-[#F3EFEA] text-[#17141A] border-[#E8E2DA]';
    return 'bg-[#FAF8F5] text-[#5A5561] border-[#E8E2DA]';
  }

  getEstadoBadgeClass(estado: string): string {
    const e = (estado || '').toLowerCase();
    if (e === 'activa') return 'bg-[#DCFCE7] text-[#16A34A] border border-[#DCFCE7]';
    if (e === 'suspendida') return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-rose-50 text-rose-700 border border-rose-200';
  }

  getEstadoLabel(estado: string): string {
    const e = (estado || '').toLowerCase();
    if (e === 'activa') return 'Activa';
    if (e === 'suspendida') return 'Suspendida';
    if (e === 'vencida') return 'Vencida';
    return estado || 'Desconocido';
  }

  formatFecha(fecha: string | null | undefined): string {
    if (!fecha) return 'Sin fecha programada';
    return fecha;
  }
}
