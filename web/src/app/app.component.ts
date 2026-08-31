import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { LoginComponent } from './features/auth/login.component';
import { HeaderComponent } from './shared/components/header.component';
import { SidebarComponent, AppView } from './shared/components/sidebar.component';
import { ToastContainerComponent } from './shared/components/toast-container.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ArchiveComponent } from './features/archive/archive.component';
import { InventoryComponent } from './features/inventory/inventory.component';
import { LogisticsComponent } from './features/logistics/logistics.component';
import { TeamComponent } from './features/team/team.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LoginComponent,
    HeaderComponent,
    SidebarComponent,
    ToastContainerComponent,
    DashboardComponent,
    ArchiveComponent,
    InventoryComponent,
    LogisticsComponent,
    TeamComponent
  ],
  template: `
    <!-- Top Level Screen Router: Show Login or Authenticated Portal -->
    <ng-container *ngIf="!authService.isAuthenticated() || showAuthScreen(); else portalLayout">
      <app-login (loggedIn)="onLoginSuccess()"></app-login>
    </ng-container>

    <!-- Main Operational Workspace Shell -->
    <ng-template #portalLayout>
      <div class="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
        
        <!-- Desktop Sidebar Navigation -->
        <div class="hidden md:block h-full shrink-0">
          <app-sidebar
            [currentView]="activeView()"
            (viewChange)="onViewChange($event)"
            (viewAuthScreen)="toggleAuthScreen()"
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

            <app-team
              *ngIf="activeView() === 'team'"
            ></app-team>
          </main>
        </div>
      </div>
    </ng-template>

    <!-- Global Toast Alert Messages -->
    <app-toast-container></app-toast-container>
  `
})
export class AppComponent {
  activeView = signal<AppView>('dashboard');
  showAuthScreen = signal<boolean>(false);
  mobileMenuOpen = signal<boolean>(false);

  constructor(public authService: AuthService) {}

  onLoginSuccess() {
    this.showAuthScreen.set(false);
  }

  onLogout() {
    this.showAuthScreen.set(true);
  }

  toggleAuthScreen() {
    this.showAuthScreen.set(true);
  }

  onViewChange(view: AppView) {
    this.activeView.set(view);
    this.showAuthScreen.set(false);
  }

  getViewTitle(view: AppView): string {
    switch (view) {
      case 'dashboard':
        return 'Operations Center';
      case 'archive':
        return 'Garment Archive & Catalog';
      case 'inventory':
        return 'Global Stock Allocation';
      case 'logistics':
        return 'Dispatches & Secured Transit';
      case 'team':
        return 'Personnel & Node Access';
      default:
        return 'Operations';
    }
  }
}
