import { Injectable, effect, signal, untracked } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, firstValueFrom, timeout } from 'rxjs';
import { AuthService } from './auth.service';
import { OfflineDbService, type OfflineOperation } from './offline-db.service';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';
import type { SyncPullResponse } from '../models';

const API_URL = environment.apiUrl;
const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds

export interface SyncPushResult {
  idLocal: string;
  status: 'synced' | 'conflict' | 'rejected';
  venta?: Record<string, any>;
  reserva?: Record<string, any>;
  inventario?: any[];
  conflict?: Record<string, any>;
  error?: Record<string, any>;
}

/**
 * Service orchestrating local-first sync pull, connectivity tracking,
 * and Dexie cache persistence (OW3).
 */
@Injectable({
  providedIn: 'root',
})
export class SyncService {
  readonly isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  readonly isSyncing = signal<boolean>(false);
  readonly lastSyncTime = signal<Date | null>(null);
  readonly syncError = signal<string | null>(null);
  readonly isPushing = signal<boolean>(false);
  readonly pendingCount = signal<number>(0);
  readonly syncConflicts = signal<OfflineOperation[]>([]);
  readonly queueOperations = signal<OfflineOperation[]>([]);
  readonly syncCompleted = new Subject<SyncPullResponse>();
  readonly offlineInventoryChanged = new Subject<void>();

  private now = signal<number>(Date.now());
  private periodicTimer?: ReturnType<typeof setInterval>;
  private tickTimer?: ReturnType<typeof setInterval>;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private offlineDbService: OfflineDbService,
    private notificationService: NotificationService,
  ) {
    void this.initQueueOnStart();
    this.initLastSyncTime();
    this.initNetworkListeners();
    this.initAuthEffect();
    this.startPeriodicSync();
    this.startTicker();
  }

  private async initQueueOnStart(): Promise<void> {
    await this.resetEnviadoToLocal();
    await this.refreshPendingState();
  }

  async resetEnviadoToLocal(): Promise<void> {
    try {
      const db = this.offlineDbService.getActiveDb();
      await db.operacionesPendientes
        .where('estado')
        .equals('enviado')
        .modify((op: OfflineOperation) => {
          op.estado = 'local';
        });
    } catch (err) {
      console.warn('Error resetting enviado ops to local:', err);
    }
  }

  private async initLastSyncTime(): Promise<void> {
    try {
      const serverTime = await this.offlineDbService.getLastServerTime();
      if (serverTime && !this.lastSyncTime()) {
        const d = new Date(serverTime);
        if (!isNaN(d.getTime())) {
          this.lastSyncTime.set(d);
        }
      }
    } catch {}
  }

  private startTicker(): void {
    if (typeof window === 'undefined') return;
    this.tickTimer = setInterval(() => {
      this.now.set(Date.now());
    }, 15000);
  }

  private initNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline.set(true);
      if (this.authService.isAuthenticated()) {
        void this.syncAll();
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });

    // Fallback sync with navigator.onLine (especially after page reload in headless/emulated offline)
    setInterval(() => {
      if (typeof navigator !== 'undefined') {
        const actual = navigator.onLine;
        if (this.isOnline() !== actual) {
          this.isOnline.set(actual);
          if (actual && this.authService.isAuthenticated()) {
            void this.syncAll();
          }
        }
      }
    }, 10000);
  }

  private initAuthEffect(): void {
    let lastSyncedUserId: string | number | null = null;

    effect(() => {
      const isAuth = this.authService.isAuthenticated();
      const user = this.authService.currentUser();
      const online = this.isOnline();
      const userId = isAuth && user ? user.id : null;

      // Only trigger pull when a user newly logs in or switches, without tracking pull()'s internal signals
      if (userId && online && userId !== lastSyncedUserId) {
        lastSyncedUserId = userId;
        untracked(() => {
          this.resetEnviadoToLocal().then(() => this.syncAll());
        });
      } else if (!userId) {
        lastSyncedUserId = null;
      }
    });
  }

  private startPeriodicSync(): void {
    if (typeof window === 'undefined') return;
    this.periodicTimer = setInterval(() => {
      if (this.isOnline() && this.authService.isAuthenticated()) {
        void this.syncAll();
      }
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Performs delta pull (or full snapshot if since is missing/expired).
   */
  async pull(): Promise<SyncPullResponse | null> {
    if (!this.isOnline()) return null;
    if (!this.authService.isAuthenticated()) return null;
    if (this.isSyncing()) return null;

    this.isSyncing.set(true);
    this.syncError.set(null);

    try {
      const db = this.offlineDbService.getActiveDb();

      const lastServerTime = await this.offlineDbService.getLastServerTime();
      let params = new HttpParams();
      if (lastServerTime) {
        params = params.set('since', lastServerTime);
      }

      const response = await firstValueFrom(
        this.http.get<SyncPullResponse>(`${API_URL}/api/sync/pull`, { params }).pipe(timeout(15000))
      );

      if (response) {
        await db.transaction(
          'rw',
          [db.productos, db.sucursales, db.inventario, db.reservas, db.ventas, db.cliente, db.meta, db.operacionesPendientes],
          async () => {
            const pending = await db.operacionesPendientes.where('estado').anyOf(['local', 'enviado']).toArray();
            const putInventory = async (rows: SyncPullResponse['inventario']) => {
              if (!rows.length) return;
              const projected = rows.map(row => {
                const copy = { ...row };
                for (const operation of pending) {
                  const payload = operation.payload;
                  if (operation.tipo === 'venta' && payload.codigoSucursal === copy.codigoSucursal) {
                    for (const item of payload.items ?? []) {
                      if (item.idProducto === copy.idProducto) {
                        copy.cantidad_actual = Math.max(0, copy.cantidad_actual - item.cantidad);
                      }
                    }
                  } else if (operation.tipo === 'reserva' &&
                      payload.codigoSucursal === copy.codigoSucursal && payload.idProducto === copy.idProducto) {
                    copy.cantidad_reservada += 1;
                  }
                }
                return copy;
              });
              await db.inventario.bulkPut(projected);
            };
            if (response.full) {
              await Promise.all([
                db.productos.clear(),
                db.sucursales.clear(),
                db.inventario.clear(),
                db.reservas.clear(),
                db.ventas.clear(),
                db.cliente.clear(),
              ]);
              if (response.productos?.length) await db.productos.bulkPut(response.productos);
              if (response.sucursales?.length) await db.sucursales.bulkPut(response.sucursales);
              if (response.inventario?.length) await putInventory(response.inventario);
              if (response.reservas?.length) await db.reservas.bulkPut(response.reservas);
              if (response.ventas?.length) await db.ventas.bulkPut(response.ventas);
              if (response.cliente) await db.cliente.put(response.cliente);
            } else {
              // Delta updates
              if (response.productos?.length) await db.productos.bulkPut(response.productos);
              if (response.sucursales?.length) await db.sucursales.bulkPut(response.sucursales);
              if (response.inventario?.length) await putInventory(response.inventario);
              if (response.reservas?.length) await db.reservas.bulkPut(response.reservas);
              if (response.ventas?.length) await db.ventas.bulkPut(response.ventas);
              if (response.cliente) await db.cliente.put(response.cliente);

              // Delta tombstones
              if (response.deleted) {
                if (response.deleted.productos?.length) {
                  await db.productos.bulkDelete(response.deleted.productos);
                }
                if (response.deleted.inventario?.length) {
                  await db.inventario.bulkDelete(response.deleted.inventario);
                }
                if (response.deleted.reservas?.length) {
                  await db.reservas.bulkDelete(response.deleted.reservas);
                }
              }
            }

            // Update meta serverTime
            if (response.serverTime) {
              await db.meta.put({ key: 'lastServerTime', value: response.serverTime });
            }
          }
        );

        this.lastSyncTime.set(new Date());
        this.syncCompleted.next(response);
        await this.refreshPendingState();
      }

      return response;
    } catch (err: any) {
      const errorMsg = err?.message || 'Error al sincronizar datos locales';
      this.syncError.set(errorMsg);
      console.warn('Sync pull error:', err);
      return null;
    } finally {
      this.isSyncing.set(false);
    }
  }

  private async syncAll(): Promise<void> {
    await this.pushPending(false);
    await this.pull();
  }

  async enqueueOfflineSale(payload: {
    comprobanteLocal: string;
    fechaLocal: string;
    codigoSucursal: number;
    idCliente: number;
    pago: { tipo: 'Efectivo'; monto: number };
    items: { idProducto: number; cantidad: number }[];
  }): Promise<string | null> {
    return this.enqueueOperation('venta', { ...payload, idLocal: crypto.randomUUID() });
  }

  async enqueueOfflineReservation(payload: {
    idCliente: number;
    fecha: string;
    horario: string;
    codigoSucursal: number;
    idProducto: number;
  }): Promise<string | null> {
    return this.enqueueOperation('reserva', { ...payload, idLocal: crypto.randomUUID() });
  }

  private async enqueueOperation(tipo: 'venta' | 'reserva', payload: Record<string, any>): Promise<string | null> {
    const idLocal = String(payload['idLocal']);
    const db = this.offlineDbService.getActiveDb();
    try {
      await db.transaction('rw', [db.inventario, db.operacionesPendientes], async () => {
        const items = tipo === 'venta' ? payload['items'] as { idProducto: number; cantidad: number }[]
          : [{ idProducto: payload['idProducto'] as number, cantidad: 1 }];
        const grouped = new Map<number, number>();
        for (const item of items) grouped.set(item.idProducto, (grouped.get(item.idProducto) ?? 0) + item.cantidad);
        const rows = [];
        for (const [idProducto, quantity] of grouped) {
          const row = await db.inventario.where('[codigoSucursal+idProducto]')
            .equals([payload['codigoSucursal'], idProducto]).first();
          if (!row || row.cantidad_actual - row.cantidad_reservada < quantity) {
            throw new Error(`Stock local insuficiente para el producto ${idProducto}`);
          }
          rows.push({ row, quantity });
        }
        for (const { row, quantity } of rows) {
          if (tipo === 'venta') row.cantidad_actual -= quantity;
          else row.cantidad_reservada += quantity;
          await db.inventario.put(row);
        }
        const operation: OfflineOperation = {
          idLocal, tipo, estado: 'local', creadoEn: new Date().toISOString(), payload,
        };
        await db.operacionesPendientes.add(operation);
      });
      this.offlineInventoryChanged.next();
      await this.refreshPendingState();
      return idLocal;
    } catch (error) {
      this.syncError.set(error instanceof Error ? error.message : 'No se pudo guardar la operación offline.');
      return null;
    }
  }

  async refreshPendingState(): Promise<void> {
    try {
      const operations = await this.offlineDbService.getActiveDb().operacionesPendientes.toArray();
      operations.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
      this.queueOperations.set(operations);
      this.pendingCount.set(
        operations.filter(item => item.estado === 'local' || item.estado === 'enviado').length
      );
      this.syncConflicts.set(
        operations.filter(item => item.estado === 'rechazado_conflicto')
      );
    } catch {
      this.queueOperations.set([]);
      this.pendingCount.set(0);
      this.syncConflicts.set([]);
    }
  }

  async pushPending(refreshPull = true): Promise<SyncPushResult[]> {
    if (!this.isOnline() || !this.authService.isAuthenticated() || this.isPushing()) return [];
    this.isPushing.set(true);
    this.syncError.set(null);
    let results: SyncPushResult[] = [];
    let pushedOperations: OfflineOperation[] = [];
    try {
      const db = this.offlineDbService.getActiveDb();
      const operations = (await db.operacionesPendientes.where('estado').anyOf(['local', 'enviado']).sortBy('creadoEn'))
        .slice(0, 100);
      if (!operations.length) return [];
      pushedOperations = operations;

      // Mark operations as 'enviado' during push
      const ids = operations.map(item => item.idLocal);
      await db.operacionesPendientes.where('idLocal').anyOf(ids).modify((op: OfflineOperation) => {
        op.estado = 'enviado';
      });
      await this.refreshPendingState();

      const response = await firstValueFrom(this.http.post<{ results: SyncPushResult[] }>(
        `${API_URL}/api/sync/push`, { operations: operations.map(item => ({
          idLocal: item.idLocal, tipo: item.tipo, payload: item.payload,
        })) },
      ).pipe(timeout(30000)));
      results = response.results ?? [];

      await db.transaction('rw', [db.operacionesPendientes, db.inventario, db.ventas, db.reservas], async () => {
        const processedIds = new Set<string>();
        for (const result of results) {
          processedIds.add(result.idLocal);
          const operation = await db.operacionesPendientes.get(result.idLocal);
          if (!operation) continue;
          if (result.inventario?.length) await db.inventario.bulkPut(result.inventario);
          if (result.status === 'synced') {
            if (result.venta) await db.ventas.put(result.venta as any);
            if (result.reserva) await db.reservas.put(result.reserva as any);
            operation.estado = 'confirmado';
            delete operation.conflicto;
            await db.operacionesPendientes.put(operation);
          } else {
            operation.estado = 'rechazado_conflicto';
            operation.conflicto = result.conflict ?? result.error ?? { code: 'sync_rejected' };
            await db.operacionesPendientes.put(operation);
          }
        }
        for (const op of operations) {
          if (!processedIds.has(op.idLocal)) {
            const fresh = await db.operacionesPendientes.get(op.idLocal);
            if (fresh && fresh.estado === 'enviado') {
              fresh.estado = 'local';
              await db.operacionesPendientes.put(fresh);
            }
          }
        }
      });
      this.offlineInventoryChanged.next();
      for (const result of results) {
        if (result.status === 'conflict' || result.status === 'rejected') {
          this.notificationService.warning(
            'Operación offline requiere atención',
            `${result.idLocal}: ${result.conflict?.['code'] ?? result.error?.['code'] ?? 'conflicto al sincronizar'}`,
          );
        }
      }
      await this.refreshPendingState();
      if (refreshPull && results.some(result => result.status === 'synced')) await this.pull();
      return results;
    } catch (error: any) {
      if (pushedOperations.length > 0) {
        try {
          const db = this.offlineDbService.getActiveDb();
          const ids = pushedOperations.map(item => item.idLocal);
          await db.operacionesPendientes.where('idLocal').anyOf(ids).modify((op: OfflineOperation) => {
            if (op.estado === 'enviado') {
              op.estado = 'local';
            }
          });
        } catch {}
      }
      this.syncError.set(error?.message || 'No se pudieron sincronizar las operaciones pendientes.');
      return [];
    } finally {
      this.isPushing.set(false);
      await this.refreshPendingState();
    }
  }

  async retryConflict(idLocal: string): Promise<SyncPushResult[]> {
    const db = this.offlineDbService.getActiveDb();
    const operation = await db.operacionesPendientes.get(idLocal);
    if (!operation || operation.estado !== 'rechazado_conflicto') return [];
    await db.transaction('rw', [db.inventario, db.operacionesPendientes], async () => {
      const items = operation.tipo === 'venta' ? operation.payload['items'] as { idProducto: number; cantidad: number }[]
        : [{ idProducto: operation.payload['idProducto'] as number, cantidad: 1 }];
      for (const item of items) {
        const row = await db.inventario.where('[codigoSucursal+idProducto]')
          .equals([operation.payload['codigoSucursal'], item.idProducto]).first();
        if (row) {
          if (operation.tipo === 'venta') row.cantidad_actual = Math.max(0, row.cantidad_actual - item.cantidad);
          else row.cantidad_reservada += item.cantidad;
          await db.inventario.put(row);
        }
      }
      operation.estado = 'local';
      delete operation.conflicto;
      await db.operacionesPendientes.put(operation);
    });
    this.offlineInventoryChanged.next();
    await this.refreshPendingState();
    return this.pushPending();
  }

  async discardConflict(idLocal: string): Promise<void> {
    await this.offlineDbService.getActiveDb().operacionesPendientes.delete(idLocal);
    await this.refreshPendingState();
  }

  async clearConfirmed(): Promise<number> {
    try {
      const db = this.offlineDbService.getActiveDb();
      const count = await db.operacionesPendientes.where('estado').equals('confirmado').delete();
      await this.refreshPendingState();
      return count;
    } catch (err) {
      console.warn('Error al limpiar operaciones confirmadas:', err);
      return 0;
    }
  }

  /**
   * Helper to format the time since last sync in natural Spanish.
   */
  getTimeSinceLastSyncLabel(): string {
    const last = this.lastSyncTime();
    if (!last) return 'recientemente';

    const diffMs = this.now() - last.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) return 'hace unos segundos';
    if (diffMins === 1) return 'hace 1 minuto';
    if (diffMins < 60) return `hace ${diffMins} minutos`;
    if (diffHours === 1) return 'hace 1 hora';
    if (diffHours < 24) return `hace ${diffHours} horas`;
    return `el ${last.toLocaleDateString()}`;
  }
}
