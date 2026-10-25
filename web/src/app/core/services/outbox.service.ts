import { Injectable, signal, computed, effect, untracked } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { OfflineDbService } from './offline-db.service';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import type { PendingOp, PendingOpType, PendingOpStatus } from '../models';

const API_URL = environment.apiUrl;

/**
 * Service managing persistent outbox in Dexie (OX1).
 * Operations are queued offline with a client UUID as Idempotency-Key,
 * flushed FIFO with exponential backoff per op, and 4xx definitive errors are marked failed with
 * Spanish user-facing reasons without duplicate retransmission.
 * Stale 'sending' ops are recovered on startup/flush, and 401 stops flush keeping ops pending.
 */
@Injectable({
  providedIn: 'root',
})
export class OutboxService {
  readonly pendingCount = signal<number>(0);
  readonly failedCount = signal<number>(0);
  readonly pendingOps = signal<PendingOp[]>([]);
  readonly isFlushing = signal<boolean>(false);

  readonly totalActiveCount = computed(() => this.pendingCount() + this.failedCount());

  constructor(
    private http: HttpClient,
    private offlineDbService: OfflineDbService,
    private notificationService: NotificationService,
    private authService: AuthService,
  ) {
    this.initAuthEffect();
    this.initNetworkListeners();
  }

  private initAuthEffect(): void {
    effect(() => {
      const user = this.authService.currentUser();
      untracked(() => {
        if (user) {
          this.resetStaleSendingOps().then(() => {
            this.refreshCounts();
            if (typeof navigator !== 'undefined' && navigator.onLine) {
              this.flush();
            }
          });
        } else {
          this.refreshCounts();
        }
      });
    });
  }

  private initNetworkListeners(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.flush();
    });
  }

  /**
   * Resets any stale 'sending' operations back to 'pending'.
   * Safe because each operation preserves its UUID Idempotency-Key.
   */
  async resetStaleSendingOps(): Promise<void> {
    try {
      if (!this.authService.isAuthenticated()) return;
      const db = this.offlineDbService.getActiveDb();
      const staleOps = await db.pending_ops.where('status').equals('sending').toArray();
      for (const op of staleOps) {
        await db.pending_ops.update(op.id, {
          status: 'pending',
          lastAttemptAt: null, // Safe to retry immediately with same Idempotency-Key
        });
      }
    } catch {
      // In case DB is not yet available
    }
  }

  /**
   * Refreshes the cached list and counts of outbox operations.
   */
  async refreshCounts(): Promise<void> {
    try {
      const user = this.authService.currentUser();
      if (!user) {
        this.pendingOps.set([]);
        this.pendingCount.set(0);
        this.failedCount.set(0);
        return;
      }

      const db = this.offlineDbService.getActiveDb();
      const all = await db.pending_ops.toArray();
      // Sort in reverse chronological order for UI display
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.pendingOps.set(all);

      const pending = all.filter(op => op.status === 'pending' || op.status === 'sending').length;
      const failed = all.filter(op => op.status === 'failed').length;

      this.pendingCount.set(pending);
      this.failedCount.set(failed);
    } catch {
      this.pendingOps.set([]);
      this.pendingCount.set(0);
      this.failedCount.set(0);
    }
  }

  /**
   * Enqueues a new operation in the persistent Dexie outbox.
   */
  async queueOp(type: PendingOpType | string, payload: any, customId?: string): Promise<PendingOp> {
    const id = customId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `op-${Date.now()}-${Math.random()}`);
    const op: PendingOp = {
      id,
      type,
      payload,
      createdAt: new Date().toISOString(),
      lastAttemptAt: null,
      status: 'pending',
      attempts: 0,
      lastError: null,
    };

    const db = this.offlineDbService.getActiveDb();

    // If customer profile, last write wins: remove earlier un-sent profile edits
    if (type === 'customer_profile') {
      const existing = await db.pending_ops
        .where('type')
        .equals('customer_profile')
        .and(o => o.status === 'pending' || o.status === 'failed')
        .toArray();
      for (const e of existing) {
        await db.pending_ops.delete(e.id);
      }
    }

    await db.pending_ops.put(op);
    await this.refreshCounts();
    return op;
  }

  /**
   * Retries a failed or stalled operation by marking it pending and attempting a flush.
   */
  async retryOp(id: string): Promise<void> {
    const db = this.offlineDbService.getActiveDb();
    const op = await db.pending_ops.get(id);
    if (!op) return;

    await db.pending_ops.update(id, {
      status: 'pending',
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
    });
    await this.refreshCounts();
    await this.flush();
  }

  /**
   * Permanently discards an operation from the outbox.
   */
  async discardOp(id: string): Promise<void> {
    const db = this.offlineDbService.getActiveDb();
    await db.pending_ops.delete(id);
    await this.refreshCounts();
  }

  /**
   * Flushes queued operations in strict FIFO order (by createdAt).
   * Per-op exponential backoff is tracked with lastAttemptAt.
   * 401 stops the flush without failing the op (waiting for fresh token).
   * Definitive 4xx marks failed permanently with Spanish reason.
   */
  async flush(): Promise<{ sent: number; failed: number }> {
    if (this.isFlushing()) {
      return { sent: 0, failed: 0 };
    }
    const initialUser = this.authService.currentUser();
    if (!initialUser || !this.authService.isAuthenticated()) {
      return { sent: 0, failed: 0 };
    }

    const targetUserId = initialUser.id;
    const targetEmpresaId = initialUser.empresa?.idEmpresa || this.authService.empresa()?.idEmpresa;

    this.isFlushing.set(true);
    let sentCount = 0;
    let failedCount = 0;

    try {
      // Step 1: Recover any stale 'sending' operations back to 'pending'
      await this.resetStaleSendingOps();

      const db = this.offlineDbService.getActiveDb();
      // Get all pending operations ordered chronologically (FIFO)
      const allOps = await db.pending_ops.where('status').equals('pending').sortBy('createdAt');

      for (const op of allOps) {
        // Step 2: Re-check that current authenticated identity matches the DB being flushed
        const currentUser = this.authService.currentUser();
        const currentEmpresaId = currentUser?.empresa?.idEmpresa || this.authService.empresa()?.idEmpresa;
        if (!currentUser || currentUser.id !== targetUserId || currentEmpresaId !== targetEmpresaId) {
          console.warn('Identity changed or logged out during outbox flush. Halting flush loop.');
          break;
        }

        // Step 3: Exponential backoff per op: measured from lastAttemptAt
        if (op.attempts > 0 && op.lastAttemptAt) {
          const backoffMs = Math.min(1000 * Math.pow(2, op.attempts), 60000);
          const elapsed = Date.now() - new Date(op.lastAttemptAt).getTime();
          if (elapsed < backoffMs) {
            continue; // Skip until backoff window passes
          }
        }

        await db.pending_ops.update(op.id, { status: 'sending' });
        await this.refreshCounts();

        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          'Idempotency-Key': op.id,
        });

        try {
          let response: any = null;

          if (op.type === 'pos_sale') {
            response = await firstValueFrom(
              this.http.post<any>(`${API_URL}/api/sync/sales`, op.payload, { headers }).pipe(timeout(15000))
            );
          } else if (op.type === 'reservation') {
            response = await firstValueFrom(
              this.http.post<any>(`${API_URL}/api/reservations`, op.payload, { headers }).pipe(timeout(15000))
            );
          } else if (op.type === 'customer_profile') {
            response = await firstValueFrom(
              this.http.put<any>(`${API_URL}/api/customers/me`, op.payload, { headers }).pipe(timeout(15000))
            );
          } else {
            console.warn(`Unknown outbox operation type: ${op.type}`);
          }

          // Marked done upon 2xx success
          await db.pending_ops.update(op.id, {
            status: 'done',
            attempts: op.attempts + 1,
            lastAttemptAt: new Date().toISOString(),
            lastError: null,
          });
          sentCount++;

          // Reconcile accepted POS sale: remove provisional local cache and upsert server venta
          if (op.type === 'pos_sale' && response) {
            await this.reconcileAcceptedSale(db, op.payload, response);
          }

          this.notifySuccess(op, response);
        } catch (err: any) {
          const httpStatus = err?.status ?? 0;
          const is401 = httpStatus === 401;

          if (is401) {
            // Token expired! DO NOT mark failed! Keep op pending and halt flush immediately
            await db.pending_ops.update(op.id, {
              status: 'pending',
              lastAttemptAt: new Date().toISOString(),
              lastError: 'Sesión expirada. Por favor inicie sesión nuevamente para continuar la sincronización.',
            });
            this.notificationService.warning(
              'Sesión expirada',
              'Tu sesión expiró. Las operaciones pendientes permanecerán guardadas localmente hasta que inicies sesión nuevamente.'
            );
            break; // Stop flush loop immediately on 401
          }

          const isDefinitive4xx = httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408 && httpStatus !== 429;

          if (isDefinitive4xx) {
            // Definitive client error: mark failed with Spanish message, do not re-send
            failedCount++;
            const spanishReason = this.extractSpanishErrorReason(op, err);
            await db.pending_ops.update(op.id, {
              status: 'failed',
              attempts: op.attempts + 1,
              lastAttemptAt: new Date().toISOString(),
              lastError: spanishReason,
            });

            this.notificationService.error(
              'Error al sincronizar operación',
              `${this.getOpTypeLabel(op.type)}: ${spanishReason}`
            );
          } else {
            // Transient network error or 5xx: keep pending, increment attempts with backoff timestamp
            const transientMsg = err?.message || 'Error temporal de conexión o servidor.';
            await db.pending_ops.update(op.id, {
              status: 'pending',
              attempts: op.attempts + 1,
              lastAttemptAt: new Date().toISOString(),
              lastError: transientMsg,
            });
            // Stop current flush batch on transient network drop or 5xx
            break;
          }
        }
      }
    } catch (err) {
      console.warn('Outbox flush error:', err);
    } finally {
      this.isFlushing.set(false);
      await this.refreshCounts();
    }

    return { sent: sentCount, failed: failedCount };
  }

  /**
   * Reconciles an accepted pos_sale by removing provisional cached rows (negative idVenta)
   * and storing the authoritative server-assigned Venta.
   */
  private async reconcileAcceptedSale(db: any, payload: any, serverVenta: any): Promise<void> {
    try {
      const comprobanteLocal = payload?.comprobanteLocal;
      const idLocal = payload?.idLocal;
      const provisional = await db.ventas
        .filter((v: any) => v.idVenta < 0 && ((comprobanteLocal && v.comprobanteLocal === comprobanteLocal) || (idLocal && v.idLocal === idLocal)))
        .toArray();
      for (const p of provisional) {
        await db.ventas.delete(p.idVenta);
      }
      if (serverVenta && serverVenta.idVenta) {
        await db.ventas.put(serverVenta);
      }
    } catch (err) {
      console.warn('Failed reconciling accepted sale in local cache:', err);
    }
  }

  private notifySuccess(op: PendingOp, res: any): void {
    if (op.type === 'pos_sale') {
      const comp = res?.comprobanteLocal || op.payload?.comprobanteLocal || '';
      if (res?.discrepanciaStock) {
        this.notificationService.warning(
          'Venta sincronizada',
          `Venta ${comp} registrada con discrepancia de stock (marcada para revisión de encargado).`
        );
      } else {
        this.notificationService.success(
          'Venta sincronizada',
          `Venta presencial ${comp} sincronizada correctamente con el servidor.`
        );
      }
    } else if (op.type === 'reservation') {
      const cod = res?.codigoReserva ? `#${res.codigoReserva}` : '';
      this.notificationService.success(
        'Reserva confirmada',
        `Tu solicitud de reserva ${cod} ha sido confirmada por el servidor.`
      );
    } else if (op.type === 'customer_profile') {
      this.notificationService.success(
        'Perfil sincronizado',
        'Los cambios de tu perfil se sincronizaron con el servidor.'
      );
    }
  }

  private extractSpanishErrorReason(op: PendingOp, err: any): string {
    const errorBody = err?.error;
    const detail = errorBody?.detail;
    const code = detail?.code || (typeof detail === 'string' ? detail : null);

    if (op.type === 'reservation') {
      if (code === 'stock_insufficient') {
        return 'Stock insuficiente en la sucursal seleccionada para confirmar la reserva.';
      }
      if (typeof detail === 'string' && detail.includes('Stock insuficiente')) {
        return 'Stock insuficiente en la sucursal seleccionada.';
      }
    }

    if (op.type === 'pos_sale') {
      if (code === 'walk_in_customer_unavailable') {
        return 'El sistema requiere asociar un cliente a la venta fuera de línea.';
      }
      if (code === 'offline_payment_not_allowed') {
        return 'Solo se permite registrar ventas fuera de línea con pago en efectivo.';
      }
      if (code === 'offline_payment_amount_mismatch') {
        return 'El monto del pago no coincide con el total de los productos.';
      }
      if (code === 'customer_not_found') {
        return 'El cliente seleccionado no existe en el servidor.';
      }
    }

    if (code === 'idempotency_key_reused') {
      return 'Conflicto: la clave de operación ya fue utilizada con datos diferentes.';
    }

    if (err.status === 403) {
      return 'No tenés permisos para realizar esta operación.';
    }
    if (err.status === 404) {
      return 'El recurso solicitado no fue encontrado en el servidor.';
    }
    if (err.status === 400 && typeof detail === 'string') {
      return detail;
    }

    return typeof detail === 'string' ? detail : `Rechazado por el servidor (HTTP ${err.status}).`;
  }

  getOpTypeLabel(type: string): string {
    switch (type) {
      case 'pos_sale':
        return 'Venta en caja (POS)';
      case 'reservation':
        return 'Solicitud de reserva';
      case 'customer_profile':
        return 'Edición de perfil';
      default:
        return type;
    }
  }
}
