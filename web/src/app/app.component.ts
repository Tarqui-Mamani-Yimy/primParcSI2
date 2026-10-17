import { Component, computed, effect, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { TenantBannerService } from './core/services/tenant-banner.service';
import { NotificationService } from './core/services/notification.service';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { LandingComponent } from './components/landing/landing.component';
import { HeaderComponent } from './shared/components/header.component';
import { SidebarComponent, AppView } from './shared/components/sidebar.component';
import { ToastContainerComponent } from './shared/components/toast-container.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ArchiveComponent } from './features/archive/archive.component';
import { InventoryComponent } from './features/inventory/inventory.component';
import { LogisticsComponent } from './features/logistics/logistics.component';
import { SuppliersComponent } from './features/suppliers/suppliers.component';
import { SeasonsComponent } from './features/seasons/seasons.component';
import { TeamComponent } from './features/team/team.component';
import { CustomerShellComponent } from './features/customer/customer-shell.component';
import { StaffReservationsComponent } from './features/reservations/staff-reservations.component';
import { PosComponent } from './features/pos/pos.component';
import { LocationsComponent } from './features/locations/locations.component';
import { ReportsComponent } from './features/reports/reports.component';
import { IndicadoresComponent } from './features/indicadores/indicadores.component';
import { SubscriptionComponent } from './features/subscription/subscription.component';
import { PlatformComponent } from './features/platform/platform.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LandingComponent,
    LoginComponent,
    RegisterComponent,
    HeaderComponent,
    SidebarComponent,
    ToastContainerComponent,
    DashboardComponent,
    ArchiveComponent,
    InventoryComponent,
    LogisticsComponent,
    SuppliersComponent,
    SeasonsComponent,
    TeamComponent,
    CustomerShellComponent,
    StaffReservationsComponent,
    PosComponent,
    LocationsComponent,
    ReportsComponent,
    IndicadoresComponent,
    SubscriptionComponent,
    PlatformComponent
  ],
  template: `
    <!-- Top Level Screen Router: Show Landing/Login/Register or Authenticated Portal -->
    <ng-container *ngIf="!authService.isAuthenticated() || showAuthScreen(); else authGate">
      <app-landing
        *ngIf="publicScreen() === 'landing' && !showAuthScreen()"
        (login)="goToLogin()"
      ></app-landing>

      <app-login
        *ngIf="publicScreen() === 'login' || (publicScreen() === 'landing' && showAuthScreen())"
        (loggedIn)="onLoginSuccess()"
        (showRegister)="goToRegister()"
        (backToLanding)="goToLanding()"
      ></app-login>

      <app-register
        *ngIf="publicScreen() === 'register'"
        (registered)="onRegisterSuccess()"
        (backToLogin)="goToLogin()"
        (backToLanding)="goToLanding()"
      ></app-register>

      <!-- Pantalla de Confirmación de Compra desde Landing (LW3) -->
      <section
        *ngIf="publicScreen() === 'signup-success'"
        class="min-h-screen w-full flex items-center justify-center p-6 bg-gray-50 text-gray-900 font-sans"
      >
        <div class="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-xl p-8 text-center animate-in fade-in zoom-in duration-200">
          <div class="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-xs">
            <span class="material-symbols-outlined text-[36px]">check_circle</span>
          </div>

          <span class="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            Suscripción Confirmada
          </span>

          <h2 class="text-2xl font-bold text-gray-900 mt-3 tracking-tight">¡Pago Recibido con Éxito!</h2>

          <p class="text-sm text-gray-600 mt-3 leading-relaxed">
            Te enviamos un correo electrónico a
            <strong class="text-indigo-600 break-all">{{ signupEmail() }}</strong>
            para crear tu contraseña de acceso y activar tu consola.
          </p>

          <div class="my-6 p-4 rounded-xl bg-gray-50 border border-gray-200 text-left text-xs text-gray-600 space-y-2">
            <div class="flex items-start space-x-2">
              <span class="material-symbols-outlined text-indigo-600 text-[18px] shrink-0 mt-0.5">mail</span>
              <span>Revisa tu bandeja de entrada o carpeta de spam.</span>
            </div>
            <div class="flex items-start space-x-2">
              <span class="material-symbols-outlined text-indigo-600 text-[18px] shrink-0 mt-0.5">schedule</span>
              <span>El enlace de activación es válido por <strong>48 horas</strong>.</span>
            </div>
          </div>

          <div class="space-y-3">
            <button
              type="button"
              (click)="goToLogin()"
              class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span class="material-symbols-outlined text-[18px]">login</span>
              <span>Ir a Iniciar Sesión</span>
            </button>

            <button
              type="button"
              (click)="goToLanding()"
              class="w-full py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Volver a la Página Principal
            </button>
          </div>
        </div>
      </section>
    </ng-container>

    <!-- Authenticated but currentUser() not yet resolved: neutral loading state to avoid
         flashing the staff shell for a Cliente that reloads the page (loadTokenFromStorage
         sets isAuthenticated before fetchCurrentUser() resolves). -->
    <ng-template #authGate>
      <ng-container *ngIf="authService.currentUser() !== null; else loadingState">
        <ng-container *ngIf="isCustomer(); else portalLayout">
          <app-customer-shell (logout)="onLogout()"></app-customer-shell>
        </ng-container>
      </ng-container>
    </ng-template>

    <ng-template #loadingState>
      <div class="flex h-screen w-screen items-center justify-center bg-gray-50 text-gray-500 text-sm font-medium">
        Cargando sesión…
      </div>
    </ng-template>

    <!-- Main Operational Workspace Shell -->
    <ng-template #portalLayout>
      <div class="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
        
        <!-- Desktop Sidebar Navigation -->
        <div class="hidden md:block h-full shrink-0">
          <app-sidebar
            [currentView]="activeView()"
            (viewChange)="onViewChange($event)"
            (viewAuthScreen)="toggleAuthScreen()"
            (logout)="onLogout()"
          ></app-sidebar>
        </div>

        <!-- Mobile Drawer Navigation -->
        <div
          *ngIf="mobileMenuOpen()"
          class="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-xs md:hidden animate-in fade-in"
          (click)="mobileMenuOpen.set(false)"
        >
          <div
            class="w-64 h-full bg-white shadow-2xl"
            (click)="$event.stopPropagation()"
          >
            <app-sidebar
              [currentView]="activeView()"
              (viewChange)="onViewChange($event); mobileMenuOpen.set(false)"
              (viewAuthScreen)="toggleAuthScreen(); mobileMenuOpen.set(false)"
              (logout)="onLogout(); mobileMenuOpen.set(false)"
            ></app-sidebar>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          
          <!-- Shared Header -->
          <app-header
            [activeViewTitle]="getViewTitle(activeView())"
            (toggleMobileMenu)="mobileMenuOpen.set(true)"
            (logout)="onLogout()"
          ></app-header>

          <!-- Banner Global de Tenant / Suscripción -->
          <div
            *ngIf="tenantBannerService.banner() as b"
            class="px-6 py-2.5 text-xs flex items-center justify-between border-b shrink-0 transition-all duration-200"
            [ngClass]="b.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'"
          >
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-[18px]">
                {{ b.type === 'error' ? 'error' : 'warning' }}
              </span>
              <span>
                <strong>{{ b.title }}:</strong> {{ b.message }}
              </span>
            </div>

            <div class="flex items-center space-x-2 shrink-0">
              <button
                *ngIf="b.type === 'error' && activeView() !== 'subscription' && !authService.isSuperAdmin()"
                (click)="onViewChange('subscription')"
                class="px-2.5 py-1 bg-white hover:bg-gray-50 border border-rose-300 text-rose-700 font-bold rounded-md text-[11px] uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
              >
                Pagar suscripción
              </button>

              <button
                *ngIf="b.dismissible"
                (click)="tenantBannerService.dismiss()"
                class="p-1 hover:bg-black/5 rounded text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                title="Cerrar aviso"
              >
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>

          <!-- Scrollable View Container -->
          <main class="flex-1 overflow-y-auto bg-gray-50">
            <app-dashboard
              *ngIf="activeView() === 'dashboard'"
              (navigate)="onViewChange($event)"
            ></app-dashboard>

            <app-archive
              *ngIf="activeView() === 'archive'"
            ></app-archive>

            <app-inventory
              *ngIf="activeView() === 'inventory'"
            ></app-inventory>

            <app-logistics
              *ngIf="activeView() === 'logistics'"
            ></app-logistics>

            <app-suppliers
              *ngIf="activeView() === 'suppliers'"
            ></app-suppliers>

            <app-seasons
              *ngIf="activeView() === 'seasons'"
            ></app-seasons>

            <app-team
              *ngIf="activeView() === 'team'"
            ></app-team>

            <app-staff-reservations
              *ngIf="activeView() === 'reservations'"
            ></app-staff-reservations>

            <app-pos
              *ngIf="activeView() === 'pos'"
            ></app-pos>

            <app-locations
              *ngIf="activeView() === 'locations'"
            ></app-locations>

            <app-reports
              *ngIf="activeView() === 'reports'"
            ></app-reports>

            <app-indicadores
              *ngIf="activeView() === 'indicadores'"
            ></app-indicadores>

            <app-subscription
              *ngIf="activeView() === 'subscription'"
            ></app-subscription>

            <app-platform
              *ngIf="activeView() === 'platform'"
            ></app-platform>
          </main>
        </div>
      </div>
    </ng-template>

    <!-- Global Toast Alert Messages -->
    <app-toast-container></app-toast-container>
  `
})
export class AppComponent implements OnInit {
  activeView = signal<AppView>('dashboard');
  showAuthScreen = signal<boolean>(false);
  mobileMenuOpen = signal<boolean>(false);

  private getInitialPublicScreen(): 'landing' | 'login' | 'register' | 'signup-success' {
    if (typeof window === 'undefined') return 'landing';
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === 'success') return 'signup-success';
    if (params.has('reset_token')) return 'login';
    return 'landing';
  }

  publicScreen = signal<'landing' | 'login' | 'register' | 'signup-success'>(this.getInitialPublicScreen());
  signupEmail = signal<string>('');

  isCustomer = computed(() => this.authService.currentUser()?.rol === 'Cliente');

  constructor(
    public authService: AuthService,
    public tenantBannerService: TenantBannerService,
    private notificationService: NotificationService
  ) {
    effect(() => {
      if (this.authService.isSuperAdmin()) {
        if (this.activeView() !== 'platform') {
          this.activeView.set('platform');
        }
      } else if (this.activeView() === 'platform') {
        this.activeView.set('dashboard');
      }
    });
  }

  ngOnInit() {
    this.handleUrlReturns();
  }

  private handleUrlReturns(): void {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    // Retorno de compra desde Landing (?signup=success|cancel)
    const signup = params.get('signup');
    if (signup === 'success') {
      const email = params.get('correo') ? decodeURIComponent(params.get('correo')!) : '';
      this.signupEmail.set(email);
      this.publicScreen.set('signup-success');
      this.showAuthScreen.set(false);
      this.cleanUrlParams(['signup', 'correo']);
    } else if (signup === 'cancel') {
      this.publicScreen.set('landing');
      this.showAuthScreen.set(false);
      this.notificationService.info(
        'Suscripción cancelada',
        'El proceso de compra en Stripe fue cancelado. No se realizó ningún cargo.'
      );
      this.cleanUrlParams(['signup']);
    }

    // Retorno de facturación interna de tenant (?billing=success|cancel)
    const billing = params.get('billing');
    if (billing === 'success') {
      this.activeView.set('subscription');
      this.showAuthScreen.set(false);
      this.notificationService.success(
        'Pago completado',
        'Tu suscripción se ha procesado con éxito en Stripe. Los datos de tu plan se actualizarán a la brevedad.'
      );
      if (this.authService.isAuthenticated()) {
        this.authService.fetchCurrentUser();
        // Webhook might take a moment to update DB, schedule follow-up refresh
        setTimeout(() => {
          if (this.authService.isAuthenticated()) {
            this.authService.fetchCurrentUser();
          }
        }, 3000);
      }
      this.cleanUrlParams(['billing']);
    } else if (billing === 'cancel') {
      this.activeView.set('subscription');
      this.showAuthScreen.set(false);
      this.notificationService.info(
        'Operación cancelada',
        'El proceso de suscripción en Stripe no se completó. No se realizó ningún cargo.'
      );
      this.cleanUrlParams(['billing']);
    }
  }

  private cleanUrlParams(keysToRemove: string[]): void {
    const url = new URL(window.location.href);
    for (const key of keysToRemove) {
      url.searchParams.delete(key);
    }
    const cleanUrl = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash;
    window.history.replaceState({}, '', cleanUrl);
  }

  goToLogin() {
    this.publicScreen.set('login');
  }

  goToRegister() {
    this.publicScreen.set('register');
  }

  goToLanding() {
    this.showAuthScreen.set(false);
    this.publicScreen.set('landing');
  }

  onLoginSuccess() {
    this.showAuthScreen.set(false);
    this.publicScreen.set('landing');
  }

  onRegisterSuccess() {
    this.showAuthScreen.set(false);
    this.publicScreen.set('landing');
  }

  onLogout() {
    this.showAuthScreen.set(false);
    this.publicScreen.set('landing');
  }

  toggleAuthScreen() {
    this.showAuthScreen.set(true);
    this.publicScreen.set('login');
  }

  onViewChange(view: AppView) {
    this.activeView.set(view);
    this.showAuthScreen.set(false);
  }

  getViewTitle(view: AppView): string {
    switch (view) {
      case 'dashboard':
        return 'Centro de Operaciones';
      case 'archive':
        return 'Archivo y Catálogo de Prendas';
      case 'inventory':
        return 'Asignación Global de Stock';
      case 'logistics':
        return 'Despachos y Tránsito Seguro';
      case 'suppliers':
        return 'Gestión de Proveedores';
      case 'seasons':
        return 'Temporadas y Colecciones';
      case 'team':
        return 'Personal y Acceso a Nodos';
      case 'reservations':
        return 'Reservas y Atención en Sucursal';
      case 'pos':
        return 'Caja — Venta Presencial';
      case 'locations':
        return 'Ciudades y Sucursales';
      case 'reports':
        return 'Reportes de Ventas e Inventario';
      case 'indicadores':
        return 'Dashboard de Indicadores Empresariales';
      case 'subscription':
        return 'Mi Suscripción y Capacidad de Plan';
      case 'platform':
        return 'Panel de Plataforma — Gestión Global';
      default:
        return 'Operaciones';
    }
  }
}
