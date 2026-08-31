import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { InventoryService, LOCATIONS } from '../../core/services/inventory.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="h-16 bg-white border-b border-gray-200 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30">
      
      <!-- Left: Mobile Menu Toggle & Breadcrumb / Brand -->
      <div class="flex items-center space-x-3">
        <button
          (click)="toggleMobileMenu.emit()"
          class="md:hidden text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Toggle Navigation"
        >
          <span class="material-symbols-outlined text-[20px]">menu</span>
        </button>

        <div class="flex items-center space-x-2 text-sm">
          <span class="font-bold text-gray-900 tracking-tight">AETHER</span>
          <span class="text-gray-300">/</span>
          <span class="text-gray-400 hidden sm:inline">Operations</span>
          <span class="text-gray-300 hidden sm:inline">/</span>
          <span class="font-medium text-gray-900">{{ activeViewTitle }}</span>
        </div>
      </div>

      <!-- Center: Hub Filter Switcher -->
      <div class="hidden lg:flex items-center space-x-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
        <button
          (click)="selectHub('ALL')"
          [class.bg-white]="inventoryService.selectedLocationId() === 'ALL'"
          [class.shadow-2xs]="inventoryService.selectedLocationId() === 'ALL'"
          [class.text-gray-900]="inventoryService.selectedLocationId() === 'ALL'"
          [class.font-semibold]="inventoryService.selectedLocationId() === 'ALL'"
          [class.text-gray-500]="inventoryService.selectedLocationId() !== 'ALL'"
          class="px-2.5 py-1 rounded text-xs transition-all cursor-pointer hover:text-gray-900"
        >
          Global Matrix
        </button>
        <button
          *ngFor="let loc of locations"
          (click)="selectHub(loc.id)"
          [class.bg-white]="inventoryService.selectedLocationId() === loc.id"
          [class.shadow-2xs]="inventoryService.selectedLocationId() === loc.id"
          [class.text-gray-900]="inventoryService.selectedLocationId() === loc.id"
          [class.font-semibold]="inventoryService.selectedLocationId() === loc.id"
          [class.text-gray-500]="inventoryService.selectedLocationId() !== loc.id"
          class="px-2.5 py-1 rounded text-xs transition-all cursor-pointer hover:text-gray-900"
        >
          {{ loc.city }}
        </button>
      </div>

      <!-- Right: Live Status & User Identity -->
      <div class="flex items-center space-x-3">
        
        <!-- Live System Status Indicator -->
        <div class="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-[11px] font-bold text-emerald-700 uppercase tracking-tight">
            Vault Sync Active
          </span>
        </div>

        <!-- Quick Switch Identity Menu -->
        <div class="relative" *ngIf="authService.currentUser() as user">
          <button
            (click)="showUserDropdown.update(v => !v)"
            class="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-left cursor-pointer border border-transparent hover:border-gray-200"
          >
            <img
              [src]="user.avatarUrl"
              [alt]="user.name"
              class="w-7 h-7 rounded-full object-cover border border-gray-200 bg-gray-100"
            />
            <div class="hidden md:block">
              <p class="text-xs font-bold text-gray-900 leading-tight">
                {{ user.name }}
              </p>
              <p class="text-[10px] text-gray-500 font-medium">
                {{ user.roleTitle }}
              </p>
            </div>
            <span class="material-symbols-outlined text-[16px] text-gray-400">expand_more</span>
          </button>

          <!-- Dropdown -->
          <div
            *ngIf="showUserDropdown()"
            class="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            <div class="px-3 py-2 border-b border-gray-100">
              <p class="text-xs font-bold text-gray-900">{{ user.name }}</p>
              <p class="text-xs text-gray-500 truncate">{{ user.email }}</p>
              <span class="inline-block mt-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase border border-indigo-100">
                {{ user.role }} • {{ user.location }}
              </span>
            </div>

            <div class="py-1">
              <p class="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Switch Demo Identity:
              </p>
              <button
                (click)="switchRole('DIRECTOR')"
                class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-gray-50 text-xs text-gray-700 flex items-center justify-between"
              >
                <span>Helena Vance (Director)</span>
                <span *ngIf="user.role === 'DIRECTOR'" class="text-indigo-600 font-bold">✓</span>
              </button>
              <button
                (click)="switchRole('CURATOR')"
                class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-gray-50 text-xs text-gray-700 flex items-center justify-between"
              >
                <span>Kenji Takahashi (Curator)</span>
                <span *ngIf="user.role === 'CURATOR'" class="text-indigo-600 font-bold">✓</span>
              </button>
              <button
                (click)="switchRole('SUPPLY_CHAIN')"
                class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-gray-50 text-xs text-gray-700 flex items-center justify-between"
              >
                <span>Astrid Lindholm (Logistics)</span>
                <span *ngIf="user.role === 'SUPPLY_CHAIN'" class="text-indigo-600 font-bold">✓</span>
              </button>
            </div>

            <div class="pt-1 border-t border-gray-100">
              <button
                (click)="onLogout()"
                class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-50 text-xs font-semibold text-rose-600 flex items-center space-x-2"
              >
                <span class="material-symbols-outlined text-[16px]">logout</span>
                <span>Sign Out / Lock Node</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  @Input() activeViewTitle = 'Dashboard Overview';
  @Output() toggleMobileMenu = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  locations = LOCATIONS;
  showUserDropdown = signal<boolean>(false);

  constructor(
    public authService: AuthService,
    public inventoryService: InventoryService
  ) {}

  selectHub(locationId: string) {
    this.inventoryService.setSelectedLocation(locationId);
  }

  switchRole(role: any) {
    this.authService.quickSwitchUser(role);
    this.showUserDropdown.set(false);
  }

  onLogout() {
    this.showUserDropdown.set(false);
    this.authService.logout();
    this.logout.emit();
  }
}
