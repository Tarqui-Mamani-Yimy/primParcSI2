import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { OfflineDbService } from '../../../core/services/offline-db.service';
import { SyncService } from '../../../core/services/sync.service';
import { OutboxService } from '../../../core/services/outbox.service';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';
import type { CachedCliente } from '../../../core/models';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`:host { display: block; }`],
  template: `
    <div class="max-w-2xl mx-auto p-6 sm:p-8">
      <div class="mb-6">
        <span class="text-[10px] font-bold tracking-wider text-[#38133E] uppercase">Mi Cuenta</span>
        <h2 class="text-xl font-bold text-[#17141A] mt-1">Datos de mi perfil</h2>
        <p class="text-sm text-[#5A5561] mt-1">
          Actualiza tus datos de contacto y medidas corporales para recomendaciones de talla.
        </p>
      </div>

      <!-- Offline Sync Notice if pending edit in outbox -->
      <div *ngIf="hasPendingProfileOp()" class="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start space-x-3">
        <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="text-xs text-amber-800">
          <p class="font-bold">Edición pendiente de sincronización</p>
          <p class="mt-0.5">Tienes cambios en tu perfil guardados localmente. Se enviarán al servidor cuando haya conexión.</p>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-[#E8E2DA] shadow-xs p-6 space-y-6" *ngIf="authService.currentUser() as user; else noUser">
        <!-- User avatar header -->
        <div class="flex items-center space-x-4">
          <div class="w-14 h-14 rounded-full bg-[#F5EBF7] flex items-center justify-center text-[#38133E] font-bold text-lg border border-[#E8E2DA]">
            {{ (nombre || user.nombre || 'U').substring(0, 2).toUpperCase() }}
          </div>
          <div>
            <p class="text-base font-bold text-[#17141A] leading-tight">{{ nombre || user.nombre }}</p>
            <span class="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#F5EBF7] text-[#38133E] text-[10px] font-bold uppercase border border-[#E8E2DA]">
              {{ user.rol }}
            </span>
          </div>
        </div>

        <form (ngSubmit)="saveProfile()" class="space-y-6">
          <!-- Read-only account info -->
          <div class="border-t border-[#E8E2DA] pt-4 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#9B94A3]">Cuenta</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-[#9B94A3] uppercase tracking-wider">Correo Electrónico</label>
                <input
                  type="email"
                  [value]="user.email"
                  disabled
                  class="mt-1 w-full px-3 py-2 text-sm bg-gray-50 border border-[#E8E2DA] rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-[#9B94A3] uppercase tracking-wider">Rol de Usuario</label>
                <input
                  type="text"
                  [value]="user.rol"
                  disabled
                  class="mt-1 w-full px-3 py-2 text-sm bg-gray-50 border border-[#E8E2DA] rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <!-- Contact details -->
          <div class="border-t border-[#E8E2DA] pt-4 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#9B94A3]">Datos de Contacto</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-[#17141A]">Nombre completo</label>
                <input
                  type="text"
                  [(ngModel)]="nombre"
                  name="nombre"
                  required
                  class="mt-1 w-full px-3 py-2 text-sm border border-[#E8E2DA] rounded-lg focus:outline-none focus:border-[#38133E]"
                  placeholder="Tu nombre completo"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-[#17141A]">Teléfono</label>
                  <input
                    type="tel"
                    [(ngModel)]="telefono"
                    name="telefono"
                    class="mt-1 w-full px-3 py-2 text-sm border border-[#E8E2DA] rounded-lg focus:outline-none focus:border-[#38133E]"
                    placeholder="+591 70000000"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-[#17141A]">Dirección</label>
                  <input
                    type="text"
                    [(ngModel)]="direccion"
                    name="direccion"
                    class="mt-1 w-full px-3 py-2 text-sm border border-[#E8E2DA] rounded-lg focus:outline-none focus:border-[#38133E]"
                    placeholder="Calle, número, zona"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Biometric measurements for virtual fitting room (CU11) -->
          <div class="border-t border-[#E8E2DA] pt-4 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-[#9B94A3]">Medidas Biométricas (cm)</h3>
              <span class="text-[10px] text-[#5A5561]">Opcional para probador virtual</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label class="block text-xs font-medium text-[#17141A]">Altura</label>
                <input
                  type="number"
                  [(ngModel)]="altura"
                  name="altura"
                  min="50"
                  max="250"
                  class="mt-1 w-full px-3 py-2 text-sm border border-[#E8E2DA] rounded-lg focus:outline-none focus:border-[#38133E]"
                  placeholder="cm"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-[#17141A]">Pecho</label>
                <input
                  type="number"
                  [(ngModel)]="pecho"
                  name="pecho"
                  min="30"
                  max="200"
                  class="mt-1 w-full px-3 py-2 text-sm border border-[#E8E2DA] rounded-lg focus:outline-none focus:border-[#38133E]"
                  placeholder="cm"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-[#17141A]">Cintura</label>
                <input
                  type="number"
                  [(ngModel)]="cintura"
                  name="cintura"
                  min="30"
                  max="200"
                  class="mt-1 w-full px-3 py-2 text-sm border border-[#E8E2DA] rounded-lg focus:outline-none focus:border-[#38133E]"
                  placeholder="cm"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-[#17141A]">Tiro</label>
                <input
                  type="number"
                  [(ngModel)]="tiro"
                  name="tiro"
                  min="30"
                  max="150"
                  class="mt-1 w-full px-3 py-2 text-sm border border-[#E8E2DA] rounded-lg focus:outline-none focus:border-[#38133E]"
                  placeholder="cm"
                />
              </div>
            </div>
          </div>

          <!-- Submit button -->
          <div class="border-t border-[#E8E2DA] pt-4 flex items-center justify-between">
            <span *ngIf="!syncService.isOnline()" class="text-xs text-amber-700 flex items-center space-x-1">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Se guardará en cola local (fuera de línea)</span>
            </span>
            <span *ngIf="syncService.isOnline()" class="text-xs text-green-700">En línea</span>

            <button
              type="submit"
              [disabled]="saving()"
              class="px-5 py-2.5 rounded-xl bg-[#38133E] hover:bg-[#2A0E2E] text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
            >
              {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </form>
      </div>

      <ng-template #noUser>
        <div class="bg-white rounded-2xl border border-[#E8E2DA] shadow-xs p-6 text-sm text-[#5A5561]">
          No se encontraron datos de la cuenta.
        </div>
      </ng-template>
    </div>
  `
})
export class CustomerProfileComponent implements OnInit {
  public authService = inject(AuthService);
  private http = inject(HttpClient);
  public syncService = inject(SyncService);
  private offlineDbService = inject(OfflineDbService);
  private outboxService = inject(OutboxService);
  private notificationService = inject(NotificationService);

  nombre = '';
  telefono = '';
  direccion = '';
  altura: number | null = null;
  pecho: number | null = null;
  cintura: number | null = null;
  tiro: number | null = null;

  saving = signal(false);
  hasPendingProfileOp = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadProfileData();
    await this.checkPendingProfileOp();
  }

  private async loadProfileData(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      this.nombre = user.nombre;
    }

    // First check local Dexie cache
    try {
      const db = this.offlineDbService.getActiveDb();
      const localClient = await db.cliente.toCollection().first();
      if (localClient) {
        this.nombre = localClient.nombre || this.nombre;
        this.telefono = localClient.telefono || '';
        this.direccion = localClient.direccion || '';
        this.altura = localClient.altura ?? null;
        this.pecho = localClient.pecho ?? null;
        this.cintura = localClient.cintura ?? null;
        this.tiro = localClient.tiro ?? null;
      }
    } catch (e) {
      console.warn('Could not read cliente from Dexie:', e);
    }

    // If online, fetch fresh from API
    if (this.syncService.isOnline()) {
      try {
        const clientData = await firstValueFrom(
          this.http.get<any>(`${environment.apiUrl}/api/customers/me`)
        );
        if (clientData) {
          this.nombre = clientData.nombre || this.nombre;
          this.telefono = clientData.telefono || '';
          this.direccion = clientData.direccion || '';
          this.altura = clientData.altura ?? null;
          this.pecho = clientData.pecho ?? null;
          this.cintura = clientData.cintura ?? null;
          this.tiro = clientData.tiro ?? null;

          // Save to Dexie cache
          try {
            const db = this.offlineDbService.getActiveDb();
            await db.cliente.put({
              idCliente: clientData.idCliente,
              idUser: clientData.idUser,
              idEmpresa: clientData.idEmpresa,
              nombre: clientData.nombre,
              telefono: clientData.telefono,
              direccion: clientData.direccion,
              altura: clientData.altura,
              pecho: clientData.pecho,
              cintura: clientData.cintura,
              tiro: clientData.tiro,
            });
          } catch (dexErr) {
            console.warn('Failed saving cliente to Dexie:', dexErr);
          }
        }
      } catch (err) {
        console.warn('Failed fetching customer profile from API, using cached data:', err);
      }
    }
  }

  private async checkPendingProfileOp(): Promise<void> {
    try {
      const db = this.offlineDbService.getActiveDb();
      const pending = await db.pending_ops
        .where('type')
        .equals('customer_profile')
        .and(op => op.status === 'pending' || op.status === 'failed')
        .first();
      this.hasPendingProfileOp.set(!!pending);
    } catch {
      this.hasPendingProfileOp.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    this.saving.set(true);

    const payload: any = {
      nombre: this.nombre.trim(),
      telefono: this.telefono.trim() || null,
      direccion: this.direccion.trim() || null,
      altura: this.altura ? Number(this.altura) : null,
      pecho: this.pecho ? Number(this.pecho) : null,
      cintura: this.cintura ? Number(this.cintura) : null,
      tiro: this.tiro ? Number(this.tiro) : null,
    };

    try {
      // 1. Update local Dexie immediately (optimistic UI update)
      const db = this.offlineDbService.getActiveDb();
      const cached = await db.cliente.toCollection().first();
      if (cached) {
        await db.cliente.update(cached.idCliente, {
          ...payload,
          idCliente: cached.idCliente,
          idUser: cached.idUser,
          idEmpresa: cached.idEmpresa,
        });
      }

      // Update current user in AuthService if name changed
      if (payload.nombre) {
        this.authService.updateCurrentUserName(payload.nombre);
      }

      // 2. Either sync online or queue offline (last write wins)
      if (this.syncService.isOnline()) {
        const idKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prof-${Date.now()}`;
        const headers = new HttpHeaders({ 'Idempotency-Key': idKey });
        await firstValueFrom(
          this.http.put(`${environment.apiUrl}/api/customers/me`, payload, { headers })
        );
        this.notificationService.success('Perfil actualizado', 'Tus datos se guardaron correctamente en el servidor.');
        this.hasPendingProfileOp.set(false);
      } else {
        // Queue in Outbox: last write wins (OutboxService deletes previous pending profile ops)
        await this.outboxService.queueOp('customer_profile', payload);
        this.notificationService.info(
          'Guardado sin conexión',
          'Los cambios de tu perfil se guardaron localmente y se sincronizarán al conectarse a internet.'
        );
        this.hasPendingProfileOp.set(true);
      }
    } catch (err: any) {
      console.error('Error saving profile:', err);
      // Fallback: if online call failed due to network, queue it
      if (this.syncService.isOnline()) {
        await this.outboxService.queueOp('customer_profile', payload);
        this.notificationService.info(
          'Guardado en cola',
          'No se pudo conectar con el servidor. La actualización se guardó en la cola local.'
        );
        this.hasPendingProfileOp.set(true);
      } else {
        this.notificationService.error('Error', 'No se pudieron guardar los cambios.');
      }
    } finally {
      this.saving.set(false);
    }
  }
}
