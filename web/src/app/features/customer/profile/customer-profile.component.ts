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
import { SizeChartService } from '../../../core/services/size-chart.service';
import { PromotionsService } from '../../../core/services/promotions.service';
import { environment } from '../../../../environments/environment';
import type { CachedCliente, ClientFitFeedbackItem, FitResultado, LoyaltyMeResponse } from '../../../core/models';

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

      <!-- Sección: ¿Cómo te quedó? (CU36 / S8) -->
      <div class="mt-8 bg-white rounded-2xl border border-[#E8E2DA] shadow-xs p-6 space-y-6">
        <div>
          <span class="text-[10px] font-bold tracking-wider text-[#38133E] uppercase">Mis Compras • Ajuste</span>
          <h2 class="text-xl font-bold text-[#17141A] mt-1">¿Cómo te quedó?</h2>
          <p class="text-sm text-[#5A5561] mt-1">
            Indica cómo te quedaron las prendas que compraste. Tu opinión ayuda a otros clientes y a calibrar las medidas.
          </p>
        </div>

        <!-- Estado de carga -->
        <div *ngIf="loadingFeedback()" class="py-8 text-center text-xs text-[#9B94A3]">
          Cargando tus compras…
        </div>

        <!-- Sin compras para opinar -->
        <div *ngIf="!loadingFeedback() && boughtProducts().length === 0" class="py-8 text-center text-xs text-[#5A5561]">
          No tienes productos comprados pendientes de evaluar.
        </div>

        <!-- Lista de productos comprados -->
        <div *ngIf="!loadingFeedback() && boughtProducts().length > 0" class="space-y-4">
          <div
            *ngFor="let item of boughtProducts()"
            class="p-4 rounded-xl border border-[#E8E2DA] bg-[#FAF8F5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <!-- Info producto -->
            <div class="flex items-center space-x-3 min-w-0">
              <img
                [src]="item.imagen_url || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=200'"
                [alt]="item.nombre"
                class="w-12 h-12 rounded-lg object-cover border border-[#E8E2DA] shrink-0"
              />
              <div class="min-w-0">
                <p class="text-sm font-bold text-[#17141A] truncate">{{ item.nombre }}</p>
                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span class="text-xs font-semibold text-[#5A5561]">Talla: {{ item.talla }}</span>
                  <span
                    *ngIf="item.resultado"
                    class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    [ngClass]="{
                      'bg-amber-100 text-amber-800 border border-amber-200': item.resultado === 'pequena',
                      'bg-emerald-100 text-emerald-800 border border-emerald-200': item.resultado === 'bien',
                      'bg-blue-100 text-blue-800 border border-blue-200': item.resultado === 'grande'
                    }"
                  >
                    Guardado: Me quedó {{ labelResultado(item.resultado) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 3 Botones de retroalimentación (S8) -->
            <div class="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
              <button
                type="button"
                (click)="onSelectResultado(item, 'pequena')"
                [disabled]="submittingFeedbackId() === item.idProducto || !syncService.isOnline()"
                class="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border"
                [ngClass]="{
                  'bg-amber-500 text-white border-amber-600 shadow-xs': item.resultado === 'pequena',
                  'bg-white text-[#5A5561] border-[#E8E2DA] hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300': item.resultado !== 'pequena'
                }"
              >
                Me quedó pequeña
              </button>

              <button
                type="button"
                (click)="onSelectResultado(item, 'bien')"
                [disabled]="submittingFeedbackId() === item.idProducto || !syncService.isOnline()"
                class="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border"
                [ngClass]="{
                  'bg-emerald-600 text-white border-emerald-700 shadow-xs': item.resultado === 'bien',
                  'bg-white text-[#5A5561] border-[#E8E2DA] hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300': item.resultado !== 'bien'
                }"
              >
                Me quedó bien
              </button>

              <button
                type="button"
                (click)="onSelectResultado(item, 'grande')"
                [disabled]="submittingFeedbackId() === item.idProducto || !syncService.isOnline()"
                class="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border"
                [ngClass]="{
                  'bg-blue-600 text-white border-blue-700 shadow-xs': item.resultado === 'grande',
                  'bg-white text-[#5A5561] border-[#E8E2DA] hover:bg-blue-50 hover:text-blue-800 hover:border-blue-300': item.resultado !== 'grande'
                }"
              >
                Me quedó grande
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sección: Mis Puntos de Fidelización (CU43 / S9) -->
      <div class="mt-8 bg-white rounded-2xl border border-[#E8E2DA] shadow-xs p-6 space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-[10px] font-bold tracking-wider text-[#38133E] uppercase">Programa de Fidelización</span>
            <h2 class="text-xl font-bold text-[#17141A] mt-1">Mis Puntos y Beneficios</h2>
            <p class="text-sm text-[#5A5561] mt-1">
              Acumulá puntos con cada compra y canjealos por descuentos directos en caja o en línea.
            </p>
          </div>
          <div *ngIf="loyaltyData() as l" class="shrink-0">
            <span
              class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs"
              [ngClass]="{
                'bg-amber-100 text-amber-900 border-amber-300': l.nivel === 'Bronce',
                'bg-slate-200 text-slate-800 border-slate-300': l.nivel === 'Plata',
                'bg-yellow-100 text-yellow-800 border-yellow-300': l.nivel === 'Oro'
              }"
            >
              Nivel {{ l.nivel }} ({{ l.multiplicador }}×)
            </span>
          </div>
        </div>

        <div *ngIf="loadingLoyalty()" class="py-6 text-center text-xs text-[#9B94A3]">
          Cargando puntos…
        </div>

        <div *ngIf="!loadingLoyalty() && loyaltyData() as l" class="space-y-6">
          <!-- Tarjetas de resumen -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-4 rounded-xl bg-[#F5EBF7]/60 border border-[#E8E2DA]">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#5A5561]">Saldo Disponible</span>
              <p class="text-2xl font-black text-[#38133E] mt-1">{{ l.saldo }} pts</p>
              <p class="text-[11px] text-[#5A5561] mt-0.5">Equivalente a Bs {{ (l.saldo * 0.1).toFixed(2) }} de descuento</p>
            </div>

            <div class="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E2DA]">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#5A5561]">Total Histórico Acumulado</span>
              <p class="text-2xl font-black text-[#17141A] mt-1">{{ l.acumulado_historico }} pts</p>
              <p class="text-[11px] text-[#5A5561] mt-0.5">Determina tu nivel de cliente</p>
            </div>

            <div class="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E2DA]">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#5A5561]">Multiplicador</span>
              <p class="text-2xl font-black text-[#17141A] mt-1">{{ l.multiplicador }}×</p>
              <p class="text-[11px] text-[#5A5561] mt-0.5">Ganas {{ l.multiplicador }} pt por cada 10 Bs pagados</p>
            </div>
          </div>

          <!-- Barra de progreso hacia el siguiente nivel -->
          <div *ngIf="l.siguiente_nivel" class="p-4 rounded-xl bg-white border border-[#E8E2DA] space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-[#17141A]">Próximo nivel: {{ l.siguiente_nivel }}</span>
              <span class="text-[#38133E] font-semibold">Faltan {{ l.puntos_para_siguiente }} pts</span>
            </div>
            <p class="text-[11px] text-[#5A5561]">
              Continúa comprando para desbloquear más beneficios y mayor multiplicador de puntos.
            </p>
          </div>

          <div *ngIf="!l.siguiente_nivel" class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-bold flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px] text-amber-600">military_tech</span>
            <span>¡Felicitaciones! Has alcanzado el nivel máximo de fidelización (Oro).</span>
          </div>

          <!-- Historial de Movimientos -->
          <div class="space-y-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#9B94A3]">Historial de Movimientos</h3>

            <div *ngIf="l.movimientos.length === 0" class="py-4 text-center text-xs text-[#9B94A3]">
              Aún no tienes movimientos registrados.
            </div>

            <div *ngIf="l.movimientos.length > 0" class="border border-[#E8E2DA] rounded-xl overflow-hidden divide-y divide-[#E8E2DA]">
              <div
                *ngFor="let m of l.movimientos"
                class="p-3 bg-white flex items-center justify-between text-xs hover:bg-[#FAF8F5]"
              >
                <div class="space-y-0.5">
                  <div class="flex items-center gap-2">
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      [ngClass]="{
                        'bg-emerald-100 text-emerald-800': m.tipo === 'ganado',
                        'bg-amber-100 text-amber-800': m.tipo === 'canjeado',
                        'bg-rose-100 text-rose-800': m.tipo === 'revertido',
                        'bg-blue-100 text-blue-800': m.tipo === 'devuelto'
                      }"
                    >
                      {{ m.tipo }}
                    </span>
                    <span class="text-[11px] text-[#5A5561]">{{ formatearFechaMovimiento(m.fecha) }}</span>
                  </div>
                  <p *ngIf="m.nota" class="text-[11px] text-[#5A5561]">{{ m.nota }}</p>
                </div>
                <span
                  class="font-black text-sm"
                  [ngClass]="m.puntos >= 0 ? 'text-emerald-700' : 'text-rose-700'"
                >
                  {{ m.puntos >= 0 ? '+' + m.puntos : m.puntos }} pts
                </span>
              </div>
            </div>
          </div>
        </div>
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
  private sizeChartService = inject(SizeChartService);
  private promotionsService = inject(PromotionsService);

  nombre = '';
  telefono = '';
  direccion = '';
  altura: number | null = null;
  pecho: number | null = null;
  cintura: number | null = null;
  tiro: number | null = null;

  saving = signal(false);
  hasPendingProfileOp = signal(false);
  boughtProducts = signal<ClientFitFeedbackItem[]>([]);
  loadingFeedback = signal<boolean>(false);
  submittingFeedbackId = signal<number | null>(null);

  loyaltyData = signal<LoyaltyMeResponse | null>(null);
  loadingLoyalty = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.loadProfileData();
    await this.checkPendingProfileOp();
    void this.loadMyFeedback();
    void this.loadLoyalty();
  }

  async loadLoyalty(): Promise<void> {
    if (!this.syncService.isOnline()) return;
    this.loadingLoyalty.set(true);
    try {
      const data = await this.promotionsService.getMyLoyalty();
      this.loyaltyData.set(data);
    } catch {
      this.loyaltyData.set(null);
    } finally {
      this.loadingLoyalty.set(false);
    }
  }

  formatearFechaMovimiento(fecha: string): string {
    if (!fecha) return '';
    try {
      return new Date(fecha).toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fecha;
    }
  }

  async loadMyFeedback(): Promise<void> {
    if (!this.syncService.isOnline()) return;
    this.loadingFeedback.set(true);
    try {
      const items = await this.sizeChartService.getMyFitFeedback();
      this.boughtProducts.set(items || []);
    } catch {
      this.boughtProducts.set([]);
    } finally {
      this.loadingFeedback.set(false);
    }
  }

  labelResultado(res: FitResultado): string {
    switch (res) {
      case 'pequena': return 'pequeña';
      case 'bien': return 'bien';
      case 'grande': return 'grande';
      default: return res;
    }
  }

  async onSelectResultado(item: ClientFitFeedbackItem, resultado: FitResultado): Promise<void> {
    if (!this.syncService.isOnline()) {
      this.notificationService.warning('Sin conexión', 'Se requiere conexión a internet para opinar.');
      return;
    }

    this.submittingFeedbackId.set(item.idProducto);
    try {
      await this.sizeChartService.submitFitFeedback(item.idProducto, { resultado });
      item.resultado = resultado;
      item.fecha = new Date().toISOString();
      this.boughtProducts.update(list => [...list]);
      this.notificationService.success('Ajuste guardado', `Tu opinión sobre "${item.nombre}" se guardó correctamente.`);
    } catch (err: any) {
      const msg = err.error?.detail || 'No se pudo registrar tu opinión.';
      this.notificationService.error('Error', typeof msg === 'string' ? msg : 'Error al guardar opinión.');
    } finally {
      this.submittingFeedbackId.set(null);
    }
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
