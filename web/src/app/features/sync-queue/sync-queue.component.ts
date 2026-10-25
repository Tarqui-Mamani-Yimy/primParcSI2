import { Component, EventEmitter, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncService } from '../../core/services/sync.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import type { OfflineOperation, OfflineOperationEstado } from '../../core/services/offline-db.service';
import type { AppView } from '../../shared/components/sidebar.component';

@Component({
  selector: 'app-sync-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`:host { display: block; }`],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">

      <!-- Header principal -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#E8E2DA]">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#38133E]">Dispositivo Local</span>
          <h1 class="text-2xl font-bold text-[#17141A] tracking-tight mt-0.5">Cola de Sincronización</h1>
          <p class="text-xs text-[#5A5561] mt-1">
            Gestión y consulta de operaciones fuera de línea (ventas y reservas) registradas en este equipo.
          </p>
        </div>

        <!-- Acciones globales -->
        <div class="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            (click)="recargarCola()"
            class="px-3.5 py-2 bg-white hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#17141A] rounded-xl text-xs font-semibold transition-colors shadow-2xs flex items-center space-x-1.5 cursor-pointer"
            title="Recargar cola local"
          >
            <span class="material-symbols-outlined text-[18px]">refresh</span>
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            (click)="limpiarConfirmadas()"
            [disabled]="confirmadasCount() === 0 || isClearing()"
            class="px-3.5 py-2 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Eliminar operaciones confirmadas que ya están en el servidor central"
          >
            <span class="material-symbols-outlined text-[18px]">delete_sweep</span>
            <span>Limpiar confirmadas</span>
          </button>

          <button
            type="button"
            (click)="sincronizarAhora()"
            [disabled]="!syncService.isOnline() || syncService.isPushing() || pendientesTotales() === 0"
            class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span class="material-symbols-outlined text-[18px]" [class.animate-spin]="syncService.isPushing()">sync</span>
            <span>{{ syncService.isPushing() ? 'Sincronizando...' : 'Sincronizar ahora' }}</span>
          </button>
        </div>
      </div>

      <!-- Control de acceso por rol (Cajero, Encargado de Sucursal, Administrador) -->
      <div *ngIf="!canAccessQueue()" class="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
        <span class="material-symbols-outlined text-rose-500 text-[42px]">lock</span>
        <h2 class="text-base font-bold text-rose-900">Acceso restringido</h2>
        <p class="text-xs text-rose-700 max-w-md mx-auto">
          Esta vista está reservada exclusivamente para el personal con rol de <strong>Cajero</strong> o <strong>Encargado de Sucursal</strong>.
        </p>
      </div>

      <ng-container *ngIf="canAccessQueue()">

        <!-- Banner de conectividad e información de sincronización -->
        <div
          class="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          [ngClass]="syncService.isOnline() ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'"
        >
          <div class="flex items-center space-x-2.5">
            <span class="material-symbols-outlined text-[20px]" [ngClass]="syncService.isOnline() ? 'text-emerald-700' : 'text-amber-700'">
              {{ syncService.isOnline() ? 'cloud_done' : 'cloud_off' }}
            </span>
            <div>
              <p class="font-bold">
                {{ syncService.isOnline() ? 'Conectado al servidor central' : 'Modo fuera de línea activo' }}
              </p>
              <p class="text-[11px] opacity-80 mt-0.5">
                Última comprobación: {{ syncService.getTimeSinceLastSyncLabel() }}
              </p>
            </div>
          </div>

          <div *ngIf="syncService.syncError() as err" class="text-rose-700 font-medium bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg max-w-md">
            {{ err }}
          </div>
        </div>

        <!-- Tarjetas de resumen métrico -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div class="p-4 bg-white rounded-xl border border-[#E8E2DA] shadow-xs">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-[#9B94A3] uppercase tracking-wider">Total en Cola</span>
              <span class="material-symbols-outlined text-[#9B94A3] text-[18px]">format_list_bulleted</span>
            </div>
            <p class="text-2xl font-black text-[#17141A] mt-2">{{ totalCount() }}</p>
          </div>

          <div class="p-4 bg-white rounded-xl border border-amber-200 shadow-xs bg-amber-50/20">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pendientes</span>
              <span class="material-symbols-outlined text-amber-600 text-[18px]">hourglass_empty</span>
            </div>
            <div class="flex items-baseline space-x-2 mt-2">
              <span class="text-2xl font-black text-amber-900">{{ pendientesTotales() }}</span>
              <span class="text-[10px] text-amber-700 font-semibold" *ngIf="enviadosCount() > 0">
                ({{ enviadosCount() }} enviando)
              </span>
            </div>
          </div>

          <div class="p-4 bg-white rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/20">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Confirmadas</span>
              <span class="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
            </div>
            <p class="text-2xl font-black text-emerald-900 mt-2">{{ confirmadasCount() }}</p>
          </div>

          <div class="p-4 bg-white rounded-xl border border-rose-200 shadow-xs bg-rose-50/20">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Conflictos</span>
              <span class="material-symbols-outlined text-rose-600 text-[18px]">warning</span>
            </div>
            <p class="text-2xl font-black text-rose-900 mt-2">{{ conflictosCount() }}</p>
          </div>
        </div>

        <!-- Filtros y barra de búsqueda -->
        <div class="p-4 bg-white rounded-xl border border-[#E8E2DA] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <!-- Pestañas de estado -->
          <div class="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              (click)="filtro.set('todas')"
              [class.bg-[#38133E]]="filtro() === 'todas'"
              [class.text-white]="filtro() === 'todas'"
              [class.bg-[#FAF8F5]]="filtro() !== 'todas'"
              [class.text-[#5A5561]]="filtro() !== 'todas'"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Todas ({{ totalCount() }})
            </button>

            <button
              type="button"
              (click)="filtro.set('pendientes')"
              [class.bg-amber-600]="filtro() === 'pendientes'"
              [class.text-white]="filtro() === 'pendientes'"
              [class.bg-amber-50]="filtro() !== 'pendientes'"
              [class.text-amber-900]="filtro() !== 'pendientes'"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Pendientes ({{ pendientesTotales() }})
            </button>

            <button
              type="button"
              (click)="filtro.set('confirmadas')"
              [class.bg-emerald-600]="filtro() === 'confirmadas'"
              [class.text-white]="filtro() === 'confirmadas'"
              [class.bg-emerald-50]="filtro() !== 'confirmadas'"
              [class.text-emerald-900]="filtro() !== 'confirmadas'"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Confirmadas ({{ confirmadasCount() }})
            </button>

            <button
              type="button"
              (click)="filtro.set('conflictos')"
              [class.bg-rose-600]="filtro() === 'conflictos'"
              [class.text-white]="filtro() === 'conflictos'"
              [class.bg-rose-50]="filtro() !== 'conflictos'"
              [class.text-rose-900]="filtro() !== 'conflictos'"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Conflictos ({{ conflictosCount() }})
            </button>
          </div>

          <!-- Búsqueda textual -->
          <div class="w-full md:w-72 relative">
            <span class="material-symbols-outlined text-[18px] text-[#9B94A3] absolute left-3 top-2.5">search</span>
            <input
              type="text"
              [ngModel]="busqueda()"
              (ngModelChange)="busqueda.set($event)"
              placeholder="Buscar por ID o comprobante..."
              class="w-full pl-9 pr-3 py-2 text-xs border border-[#E8E2DA] rounded-lg bg-[#FAF8F5] focus:bg-white focus:outline-hidden focus:border-[#38133E] transition-colors"
            />
          </div>
        </div>

        <!-- Tabla de operaciones de la cola -->
        <div class="bg-white rounded-xl border border-[#E8E2DA] shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-[#FAF8F5] text-[#5A5561] border-b border-[#E8E2DA] uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th class="px-4 py-3">Tipo</th>
                  <th class="px-4 py-3">Identificador</th>
                  <th class="px-4 py-3">Fecha</th>
                  <th class="px-4 py-3">Estado</th>
                  <th class="px-4 py-3">Detalle / Discrepancia</th>
                  <th class="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E8E2DA]">

                <!-- Estado vacío -->
                <tr *ngIf="operacionesFiltradas().length === 0">
                  <td colspan="6" class="px-6 py-12 text-center text-[#5A5561]">
                    <span class="material-symbols-outlined text-[44px] text-[#9B94A3] mb-2 block">inbox</span>
                    <p class="text-sm font-bold text-[#17141A]">No se encontraron operaciones</p>
                    <p class="text-xs text-[#5A5561] mt-1" *ngIf="totalCount() === 0">
                      No hay transacciones almacenadas localmente en este dispositivo.
                    </p>
                    <p class="text-xs text-[#5A5561] mt-1" *ngIf="totalCount() > 0">
                      No hay transacciones que coincidan con los filtros seleccionados.
                    </p>
                  </td>
                </tr>

                <!-- Filas de operaciones -->
                <tr
                  *ngFor="let op of operacionesFiltradas()"
                  class="hover:bg-[#FAF8F5] transition-colors"
                  [class.bg-rose-50/30]="op.estado === 'rechazado_conflicto'"
                >
                  <!-- Tipo -->
                  <td class="px-4 py-3.5 whitespace-nowrap">
                    <div class="flex items-center space-x-2">
                      <div
                        class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        [ngClass]="op.tipo === 'venta' ? 'bg-[#F5EBF7] text-[#38133E]' : 'bg-blue-50 text-blue-700'"
                      >
                        <span class="material-symbols-outlined text-[16px]">{{ getTipoIcon(op.tipo) }}</span>
                      </div>
                      <span class="font-bold text-[#17141A]">{{ getTipoLabel(op.tipo) }}</span>
                    </div>
                  </td>

                  <!-- Identificador / Comprobante -->
                  <td class="px-4 py-3.5">
                    <p class="font-mono text-[11px] text-[#17141A] font-semibold break-all">
                      {{ op.idLocal }}
                    </p>
                    <p *ngIf="op.payload['comprobanteLocal']" class="text-[11px] text-[#5A5561] mt-0.5">
                      Comprobante: <strong class="text-[#17141A]">{{ op.payload['comprobanteLocal'] }}</strong>
                    </p>
                  </td>

                  <!-- Fecha -->
                  <td class="px-4 py-3.5 whitespace-nowrap text-[#5A5561]">
                    <p class="font-medium text-[#17141A]">{{ formatearFecha(op.creadoEn) }}</p>
                    <p class="text-[10px] text-[#9B94A3]">{{ formatearHora(op.creadoEn) }}</p>
                  </td>

                  <!-- Estado (con etiqueta en español) -->
                  <td class="px-4 py-3.5 whitespace-nowrap">
                    <span
                      class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
                      [ngClass]="getEstadoBadgeClass(op.estado)"
                    >
                      <span class="material-symbols-outlined text-[14px]" [class.animate-spin]="op.estado === 'enviado'">
                        {{ getEstadoIcon(op.estado) }}
                      </span>
                      <span>{{ getEstadoLabel(op.estado) }}</span>
                    </span>
                  </td>

                  <!-- Detalle / Conflicto -->
                  <td class="px-4 py-3.5 max-w-md">
                    <!-- Detalle de conflicto -->
                    <div *ngIf="op.estado === 'rechazado_conflicto'" class="space-y-1">
                      <div class="flex items-center space-x-1.5 text-rose-800 font-bold">
                        <span class="material-symbols-outlined text-[16px] shrink-0">error</span>
                        <span>{{ getConflictoDetalle(op) }}</span>
                      </div>
                      <p *ngIf="op.conflicto?.['code']" class="text-[10px] font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">
                        Código: {{ op.conflicto?.['code'] }}
                      </p>
                    </div>

                    <!-- Detalle normal -->
                    <div *ngIf="op.estado !== 'rechazado_conflicto'" class="space-y-0.5 text-[#5A5561]">
                      <p class="text-[11px] text-[#17141A] font-medium">
                        {{ getPayloadSummary(op) }}
                      </p>
                      <p class="text-[10px] text-[#9B94A3]">
                        {{ getEstadoDescription(op.estado) }}
                      </p>
                    </div>
                  </td>

                  <!-- Acciones -->
                  <td class="px-4 py-3.5 whitespace-nowrap text-right">
                    <!-- Acciones para rechazado_conflicto -->
                    <div *ngIf="op.estado === 'rechazado_conflicto'" class="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        (click)="reintentar(op.idLocal)"
                        [disabled]="!syncService.isOnline() || processingId() === op.idLocal || syncService.isPushing()"
                        class="px-2.5 py-1 bg-white hover:bg-amber-50 border border-amber-300 text-amber-800 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs flex items-center space-x-1"
                        title="Reintentar sincronización con el servidor"
                      >
                        <span class="material-symbols-outlined text-[14px]">replay</span>
                        <span>Reintentar</span>
                      </button>

                      <button
                        type="button"
                        (click)="descartar(op.idLocal)"
                        [disabled]="processingId() === op.idLocal"
                        class="px-2.5 py-1 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs flex items-center space-x-1"
                        title="Descartar esta operación de la cola"
                      >
                        <span class="material-symbols-outlined text-[14px]">close</span>
                        <span>Descartar</span>
                      </button>
                    </div>

                    <!-- Información pasiva para otros estados -->
                    <span *ngIf="op.estado === 'confirmado'" class="text-[11px] font-semibold text-emerald-700">
                      Sincronizado
                    </span>
                    <span *ngIf="op.estado === 'enviado'" class="text-[11px] font-semibold text-blue-700">
                      En tránsito...
                    </span>
                    <span *ngIf="op.estado === 'local'" class="text-[11px] font-semibold text-amber-700">
                      En espera
                    </span>
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>

      </ng-container>

    </div>
  `
})
export class SyncQueueComponent implements OnInit {
  @Output() navigate = new EventEmitter<AppView>();

  filtro = signal<'todas' | 'pendientes' | 'confirmadas' | 'conflictos'>('todas');
  busqueda = signal<string>('');
  processingId = signal<string | null>(null);
  isClearing = signal<boolean>(false);

  constructor(
    public syncService: SyncService,
    private authService: AuthService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    void this.syncService.refreshPendingState();
  }

  canAccessQueue = computed(() => {
    const rol = this.authService.currentUser()?.rol;
    return rol === 'Cajero' || rol === 'Encargado de Sucursal' || rol === 'Administrador';
  });

  operations = computed(() => this.syncService.queueOperations());

  totalCount = computed(() => this.operations().length);

  localesCount = computed(() => this.operations().filter(o => o.estado === 'local').length);

  enviadosCount = computed(() => this.operations().filter(o => o.estado === 'enviado').length);

  pendientesTotales = computed(() => this.localesCount() + this.enviadosCount());

  confirmadasCount = computed(() => this.operations().filter(o => o.estado === 'confirmado').length);

  conflictosCount = computed(() => this.operations().filter(o => o.estado === 'rechazado_conflicto').length);

  operacionesFiltradas = computed(() => {
    const ops = this.operations();
    const f = this.filtro();
    const query = this.busqueda().trim().toLowerCase();

    let list = ops;

    if (f === 'pendientes') {
      list = list.filter(o => o.estado === 'local' || o.estado === 'enviado');
    } else if (f === 'confirmadas') {
      list = list.filter(o => o.estado === 'confirmado');
    } else if (f === 'conflictos') {
      list = list.filter(o => o.estado === 'rechazado_conflicto');
    }

    if (query) {
      list = list.filter(o => {
        const idMatches = o.idLocal.toLowerCase().includes(query);
        const compMatches = o.payload['comprobanteLocal']
          ? String(o.payload['comprobanteLocal']).toLowerCase().includes(query)
          : false;
        const tipoMatches = o.tipo.toLowerCase().includes(query);
        return idMatches || compMatches || tipoMatches;
      });
    }

    return list;
  });

  recargarCola(): void {
    void this.syncService.refreshPendingState();
    this.notificationService.info('Cola actualizada', 'Se recargó la cola de operaciones locales.');
  }

  async sincronizarAhora(): Promise<void> {
    if (!this.syncService.isOnline()) {
      this.notificationService.warning('Sin conexión', 'No es posible sincronizar sin acceso a internet.');
      return;
    }
    const results = await this.syncService.pushPending();
    if (results.length > 0) {
      const synced = results.filter(r => r.status === 'synced').length;
      const conflicts = results.filter(r => r.status === 'conflict' || r.status === 'rejected').length;
      if (conflicts > 0) {
        this.notificationService.warning(
          'Sincronización con novedades',
          `${synced} operación(es) confirmada(s), ${conflicts} con conflicto.`
        );
      } else {
        this.notificationService.success(
          'Sincronización completada',
          `${synced} operación(es) enviada(s) y confirmada(s) con éxito.`
        );
      }
    }
  }

  async reintentar(idLocal: string): Promise<void> {
    this.processingId.set(idLocal);
    try {
      const results = await this.syncService.retryConflict(idLocal);
      const match = results.find(r => r.idLocal === idLocal);
      if (match && match.status === 'synced') {
        this.notificationService.success('Operación sincronizada', `La operación ${idLocal} fue confirmada por el servidor.`);
      } else if (match && (match.status === 'conflict' || match.status === 'rejected')) {
        this.notificationService.warning(
          'Conflicto persistente',
          `La operación sigue en conflicto: ${match.conflict?.['code'] || match.error?.['code'] || 'stock_insufficient'}`
        );
      } else {
        this.notificationService.info('Operación reintentada', `La operación volvió al estado local.`);
      }
    } catch {
      this.notificationService.error('Error al reintentar', 'No se pudo procesar el reintento de la operación.');
    } finally {
      this.processingId.set(null);
    }
  }

  async descartar(idLocal: string): Promise<void> {
    this.processingId.set(idLocal);
    try {
      await this.syncService.discardConflict(idLocal);
      this.notificationService.info('Operación descartada', `Se eliminó la operación ${idLocal} de la cola.`);
    } catch {
      this.notificationService.error('Error al descartar', 'No se pudo eliminar la operación.');
    } finally {
      this.processingId.set(null);
    }
  }

  async limpiarConfirmadas(): Promise<void> {
    this.isClearing.set(true);
    try {
      const count = await this.syncService.clearConfirmed();
      this.notificationService.success(
        'Operaciones limpiadas',
        `Se eliminaron ${count} operación(es) confirmada(s) del dispositivo local.`
      );
    } catch {
      this.notificationService.error('Error al limpiar', 'No se pudieron limpiar las operaciones confirmadas.');
    } finally {
      this.isClearing.set(false);
    }
  }

  getEstadoLabel(estado: OfflineOperationEstado): string {
    switch (estado) {
      case 'local':
        return 'Local';
      case 'enviado':
        return 'Enviado';
      case 'confirmado':
        return 'Confirmado';
      case 'rechazado_conflicto':
        return 'Rechazado por conflicto';
      default:
        return estado;
    }
  }

  getEstadoBadgeClass(estado: OfflineOperationEstado): string {
    switch (estado) {
      case 'local':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'enviado':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'confirmado':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'rechazado_conflicto':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  getEstadoIcon(estado: OfflineOperationEstado): string {
    switch (estado) {
      case 'local':
        return 'hourglass_bottom';
      case 'enviado':
        return 'sync';
      case 'confirmado':
        return 'check_circle';
      case 'rechazado_conflicto':
        return 'error';
      default:
        return 'help';
    }
  }

  getEstadoDescription(estado: OfflineOperationEstado): string {
    switch (estado) {
      case 'local':
        return 'Guardada en el dispositivo (pendiente de envío)';
      case 'enviado':
        return 'En proceso de envío al servidor central';
      case 'confirmado':
        return 'Confirmada y registrada en el backend';
      case 'rechazado_conflicto':
        return 'Requiere resolución manual o descarte';
      default:
        return '';
    }
  }

  getTipoLabel(tipo: string): string {
    return tipo === 'venta' ? 'Venta' : 'Reserva';
  }

  getTipoIcon(tipo: string): string {
    return tipo === 'venta' ? 'point_of_sale' : 'event_available';
  }

  getConflictoDetalle(op: OfflineOperation): string {
    const code = op.conflicto?.['code'];
    if (code === 'stock_insufficient') {
      return 'Stock insuficiente en la sucursal seleccionada';
    }
    if (code === 'sync_rejected') {
      return 'Operación rechazada por el servidor central';
    }
    if (op.conflicto?.['detail']) {
      return String(op.conflicto['detail']);
    }
    if (op.conflicto?.['message']) {
      return String(op.conflicto['message']);
    }
    return code ? `Conflicto: ${code}` : 'Discrepancia detectada al sincronizar';
  }

  getPayloadSummary(op: OfflineOperation): string {
    if (op.tipo === 'venta') {
      const items = (op.payload['items'] as any[]) || [];
      const totalItems = items.reduce((sum, item) => sum + (item.cantidad || 1), 0);
      const monto = op.payload['pago']?.monto;
      const montoStr = typeof monto === 'number' ? `Bs. ${monto.toFixed(2)}` : '';
      return `${totalItems} prenda(s) ${montoStr ? '• ' + montoStr : ''}`;
    }
    if (op.tipo === 'reserva') {
      return `Prenda #${op.payload['idProducto']} • Sucursal #${op.payload['codigoSucursal']}`;
    }
    return 'Operación local';
  }

  formatearFecha(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoString;
    }
  }

  formatearHora(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  }
}
