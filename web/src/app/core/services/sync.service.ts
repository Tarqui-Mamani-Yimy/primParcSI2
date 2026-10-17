import { Injectable, effect, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, firstValueFrom, timeout } from 'rxjs';
import { AuthService } from './auth.service';
import { OfflineDbService } from './offline-db.service';
import { environment } from '../../../environments/environment';
import type { SyncPullResponse } from '../models';

const API_URL = environment.apiUrl;
const SYNC_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

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
  readonly syncCompleted = new Subject<SyncPullResponse>();

  private now = signal<number>(Date.now());
  private periodicTimer?: ReturnType<typeof setInterval>;
  private tickTimer?: ReturnType<typeof setInterval>;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private offlineDbService: OfflineDbService,
  ) {
    this.initLastSyncTime();
    this.initNetworkListeners();
    this.initAuthEffect();
    this.startPeriodicSync();
    this.startTicker();

    // Trigger immediate pull on startup if session was already restored from localStorage
    if (this.authService.isAuthenticated() && this.isOnline()) {
      this.pull();
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
        this.pull();
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
            this.pull();
          }
        }
      }
    }, 1000);
  }

  private initAuthEffect(): void {
    effect(() => {
      const isAuth = this.authService.isAuthenticated();
      const user = this.authService.currentUser();
      if (isAuth && user && this.isOnline()) {
        // Trigger pull on authentication state update
        this.pull();
      }
    });
  }

  private startPeriodicSync(): void {
    if (typeof window === 'undefined') return;
    this.periodicTimer = setInterval(() => {
      if (this.isOnline() && this.authService.isAuthenticated()) {
        this.pull();
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
          [db.productos, db.sucursales, db.inventario, db.reservas, db.ventas, db.cliente, db.meta],
          async () => {
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
              if (response.inventario?.length) await db.inventario.bulkPut(response.inventario);
              if (response.reservas?.length) await db.reservas.bulkPut(response.reservas);
              if (response.ventas?.length) await db.ventas.bulkPut(response.ventas);
              if (response.cliente) await db.cliente.put(response.cliente);
            } else {
              // Delta updates
              if (response.productos?.length) await db.productos.bulkPut(response.productos);
              if (response.sucursales?.length) await db.sucursales.bulkPut(response.sucursales);
              if (response.inventario?.length) await db.inventario.bulkPut(response.inventario);
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
