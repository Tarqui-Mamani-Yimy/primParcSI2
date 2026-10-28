import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { SyncService } from '../../core/services/sync.service';
import { PwaService } from '../../core/services/pwa.service';
import { OutboxService } from '../../core/services/outbox.service';
import { CustomerProfileComponent } from './profile/customer-profile.component';
import { CatalogComponent } from './catalog/catalog.component';
import { CustomerReservationsComponent } from './reservations/customer-reservations.component';
import { ChatWidgetComponent } from '../../shared/components/chat-widget.component';
import { PendingOpsModalComponent } from '../../shared/components/pending-ops-modal.component';

export type CustomerView = 'catalog' | 'reservations' | 'profile';

@Component({
  selector: 'app-customer-shell',
  standalone: true,
  imports: [
    CommonModule,
    CustomerProfileComponent,
    CatalogComponent,
    CustomerReservationsComponent,
    ChatWidgetComponent,
    PendingOpsModalComponent,
  ],
  template: `
    <div class="flex flex-col h-screen w-screen overflow-hidden bg-[#FAF8F5] text-[#17141A] font-sans">

      <!-- Navegación superior del cliente (sin sidebar tipo staff) -->
      <header class="h-16 bg-white border-b border-[#E8E2DA] px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div class="flex items-center space-x-6">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 bg-[#38133E] rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs">
              V
            </div>
            <span class="font-bold text-base tracking-tight text-[#17141A]">Voguely</span>
          </div>

          <nav class="hidden sm:flex items-center space-x-1">
            <button
              (click)="currentView.set('catalog')"
              [class.bg-ys-primary-soft]="currentView() === 'catalog'"
              [class.text-ys-primary]="currentView() === 'catalog'"
              [class.text-ys-muted]="currentView() !== 'catalog'"
              class="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer"
            >
              Catálogo
            </button>
            <button
              (click)="currentView.set('reservations')"
              [class.bg-ys-primary-soft]="currentView() === 'reservations'"
              [class.text-ys-primary]="currentView() === 'reservations'"
              [class.text-ys-muted]="currentView() !== 'reservations'"
              class="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer"
            >
              Mis Reservas
            </button>
            <button
              (click)="currentView.set('profile')"
              [class.bg-ys-primary-soft]="currentView() === 'profile'"
              [class.text-ys-primary]="currentView() === 'profile'"
              [class.text-ys-muted]="currentView() !== 'profile'"
              class="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:bg-[#F3EFEA] hover:text-[#17141A] cursor-pointer"
            >
              Mi Perfil
            </button>
          </nav>
        </div>

        <div class="flex items-center space-x-3" *ngIf="authService.currentUser() as user">
          <!-- Indicador de operaciones pendientes fuera de línea (OX5) -->
          <button
            *ngIf="outboxService.totalActiveCount() > 0"
            (click)="showPendingModal.set(true)"
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
            [class.bg-amber-50]="outboxService.failedCount() === 0"
            [class.border-amber-200]="outboxService.failedCount() === 0"
            [class.text-amber-800]="outboxService.failedCount() === 0"
            [class.bg-rose-50]="outboxService.failedCount() > 0"
            [class.border-rose-200]="outboxService.failedCount() > 0"
            [class.text-rose-800]="outboxService.failedCount() > 0"
            title="Ver operaciones pendientes de sincronización"
          >
            <span class="material-symbols-outlined text-[16px]" [class.animate-spin]="outboxService.isFlushing()">sync</span>
            <span class="text-[11px] font-bold">{{ outboxService.totalActiveCount() }}</span>
            <span *ngIf="outboxService.failedCount() > 0" class="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
          </button>

          <button
            (click)="onAbrirCarrito()"
            class="relative p-2 rounded-lg hover:bg-[#F5EBF7] text-[#5A5561] hover:text-[#38133E] transition-colors cursor-pointer"
            aria-label="Ver carrito"
            title="Ver carrito"
          >
            <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
            <span
              *ngIf="cartService.cantidadTotal() > 0"
              class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#38133E] text-white text-[10px] font-bold flex items-center justify-center"
            >
              {{ cartService.cantidadTotal() }}
            </span>
          </button>
          <div class="hidden md:block text-right">
            <p class="text-xs font-bold text-[#17141A] leading-tight">{{ user.nombre }}</p>
            <p class="text-[10px] text-[#5A5561] font-medium">{{ user.rol }}</p>
          </div>
          <div class="w-8 h-8 rounded-full bg-[#F5EBF7] flex items-center justify-center text-[#38133E] font-bold text-xs border border-[#E8E2DA]">
            {{ user.nombre.substring(0, 2).toUpperCase() }}
          </div>
          <button
            (click)="onLogout()"
            class="p-2 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <span class="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </header>

      <!-- Navegación inferior móvil -->
      <nav class="sm:hidden flex items-center justify-around bg-white border-b border-[#E8E2DA] py-1 shrink-0">
        <button
          (click)="currentView.set('catalog')"
          [class.text-ys-primary]="currentView() === 'catalog'"
          [class.text-ys-subtle]="currentView() !== 'catalog'"
          class="flex-1 text-center py-2 text-xs font-semibold cursor-pointer"
        >
          Catálogo
        </button>
        <button
          (click)="currentView.set('reservations')"
          [class.text-ys-primary]="currentView() === 'reservations'"
          [class.text-ys-subtle]="currentView() !== 'reservations'"
          class="flex-1 text-center py-2 text-xs font-semibold cursor-pointer"
        >
          Mis Reservas
        </button>
        <button
          (click)="currentView.set('profile')"
          [class.text-ys-primary]="currentView() === 'profile'"
          [class.text-ys-subtle]="currentView() !== 'profile'"
          class="flex-1 text-center py-2 text-xs font-semibold cursor-pointer"
        >
          Mi Perfil
        </button>
      </nav>

      <!-- Banner PWA Update (Customer Shell) -->
      <div
        *ngIf="pwaService.needRefresh()"
        class="px-4 sm:px-6 py-2.5 bg-[#38133E] text-white text-xs font-medium flex items-center justify-between shrink-0 shadow-xs"
      >
        <div class="flex items-center space-x-2">
          <span class="material-symbols-outlined text-[18px]">system_update</span>
          <span>Nueva versión disponible de Voguely.</span>
        </div>
        <div class="flex items-center space-x-2">
          <button
            (click)="pwaService.update()"
            class="px-3 py-1 bg-white hover:bg-[#F5EBF7] text-[#38133E] rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Actualizar
          </button>
          <button
            (click)="pwaService.dismiss()"
            class="p-1 hover:bg-white/10 rounded text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Cerrar aviso"
          >
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>

      <!-- Banner Offline (Customer Shell) -->
      <div
        *ngIf="!syncService.isOnline()"
        class="px-4 sm:px-6 py-2.5 bg-amber-500 text-white text-xs font-medium flex items-center justify-between shrink-0 shadow-xs"
      >
        <div class="flex items-center space-x-2">
          <span class="material-symbols-outlined text-[18px]">wifi_off</span>
          <span>Sin conexión — mostrando datos guardados (actualizado {{ syncService.getTimeSinceLastSyncLabel() }})</span>
        </div>
      </div>

      <!-- Contenido de la vista actual -->
      <main class="flex-1 overflow-y-auto bg-[#FAF8F5]">
        <app-customer-catalog *ngIf="currentView() === 'catalog'"></app-customer-catalog>

        <app-customer-reservations *ngIf="currentView() === 'reservations'"></app-customer-reservations>

        <app-customer-profile *ngIf="currentView() === 'profile'"></app-customer-profile>
      </main>

      <app-chat-widget></app-chat-widget>

      <!-- Modal de operaciones pendientes (OX5) -->
      <app-pending-ops-modal
        *ngIf="showPendingModal()"
        (close)="showPendingModal.set(false)"
      />
    </div>
  `
})
export class CustomerShellComponent {
  currentView = signal<CustomerView>('catalog');
  showPendingModal = signal<boolean>(false);

  @Output() logout = new EventEmitter<void>();

  public outboxService = inject(OutboxService);

  constructor(
    public authService: AuthService,
    public cartService: CartService,
    public syncService: SyncService,
    public pwaService: PwaService,
  ) {}

  onLogout() {
    const pending = this.outboxService.totalActiveCount();
    if (pending > 0) {
      const msg = `Tenés ${pending} ${pending === 1 ? 'operación' : 'operaciones'} sin sincronizar. Si cerrás sesión, quedarán guardadas localmente hasta que vuelvas a iniciar sesión con este usuario. ¿Deseás continuar?`;
      if (!window.confirm(msg)) {
        return;
      }
    }
    this.authService.logout();
    this.logout.emit();
  }

  onAbrirCarrito() {
    this.currentView.set('catalog');
    this.cartService.abrirPanel();
  }
}
