import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AppView = 'dashboard' | 'archive' | 'inventory' | 'logistics' | 'team';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="w-64 bg-white text-gray-900 flex flex-col justify-between h-full border-r border-gray-200 select-none">
      
      <!-- Top Section -->
      <div>
        <!-- Brand Header in Sidebar -->
        <div class="p-6 border-b border-gray-100 flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs">
              A
            </div>
            <div>
              <span class="font-bold text-base tracking-tight text-gray-900 block leading-tight">
                AETHER
              </span>
              <span class="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                Operations Node
              </span>
            </div>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200 uppercase">
            v26.4
          </span>
        </div>

        <!-- Navigation Section -->
        <nav class="flex-1 p-4 space-y-1">
          <div class="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2 px-2">
            Core Modules
          </div>

          <!-- Dashboard View -->
          <button
            (click)="selectView('dashboard')"
            [class.bg-indigo-50]="currentView === 'dashboard'"
            [class.text-indigo-700]="currentView === 'dashboard'"
            [class.font-semibold]="currentView === 'dashboard'"
            [class.text-gray-600]="currentView !== 'dashboard'"
            class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
          >
            <div
              [class.bg-indigo-600]="currentView === 'dashboard'"
              [class.text-white]="currentView === 'dashboard'"
              [class.bg-gray-100]="currentView !== 'dashboard'"
              [class.text-gray-500]="currentView !== 'dashboard'"
              class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">dashboard</span>
            </div>
            <span class="font-medium tracking-tight">
              Operations Center
            </span>
          </button>

          <!-- Archive & Garment Catalog -->
          <button
            (click)="selectView('archive')"
            [class.bg-indigo-50]="currentView === 'archive'"
            [class.text-indigo-700]="currentView === 'archive'"
            [class.font-semibold]="currentView === 'archive'"
            [class.text-gray-600]="currentView !== 'archive'"
            class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
          >
            <div
              [class.bg-indigo-600]="currentView === 'archive'"
              [class.text-white]="currentView === 'archive'"
              [class.bg-gray-100]="currentView !== 'archive'"
              [class.text-gray-500]="currentView !== 'archive'"
              class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">checkroom</span>
            </div>
            <span class="font-medium tracking-tight">
              Archive & Catalog
            </span>
          </button>

          <!-- Global Inventory Network -->
          <button
            (click)="selectView('inventory')"
            [class.bg-indigo-50]="currentView === 'inventory'"
            [class.text-indigo-700]="currentView === 'inventory'"
            [class.font-semibold]="currentView === 'inventory'"
            [class.text-gray-600]="currentView !== 'inventory'"
            class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
          >
            <div
              [class.bg-indigo-600]="currentView === 'inventory'"
              [class.text-white]="currentView === 'inventory'"
              [class.bg-gray-100]="currentView !== 'inventory'"
              [class.text-gray-500]="currentView !== 'inventory'"
              class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">inventory_2</span>
            </div>
            <span class="font-medium tracking-tight">
              Global Inventory
            </span>
          </button>

          <!-- Dispatches & Logistics -->
          <button
            (click)="selectView('logistics')"
            [class.bg-indigo-50]="currentView === 'logistics'"
            [class.text-indigo-700]="currentView === 'logistics'"
            [class.font-semibold]="currentView === 'logistics'"
            [class.text-gray-600]="currentView !== 'logistics'"
            class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
          >
            <div
              [class.bg-indigo-600]="currentView === 'logistics'"
              [class.text-white]="currentView === 'logistics'"
              [class.bg-gray-100]="currentView !== 'logistics'"
              [class.text-gray-500]="currentView !== 'logistics'"
              class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">local_shipping</span>
            </div>
            <span class="font-medium tracking-tight">
              Dispatches & VIP
            </span>
          </button>

          <div class="pt-4 text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2 px-2">
            Governance
          </div>

          <!-- Team & Security Governance -->
          <button
            (click)="selectView('team')"
            [class.bg-indigo-50]="currentView === 'team'"
            [class.text-indigo-700]="currentView === 'team'"
            [class.font-semibold]="currentView === 'team'"
            [class.text-gray-600]="currentView !== 'team'"
            class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 cursor-pointer group"
          >
            <div
              [class.bg-indigo-600]="currentView === 'team'"
              [class.text-white]="currentView === 'team'"
              [class.bg-gray-100]="currentView !== 'team'"
              [class.text-gray-500]="currentView !== 'team'"
              class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">shield_person</span>
            </div>
            <span class="font-medium tracking-tight">
              Personnel & Nodes
            </span>
          </button>
        </nav>
      </div>

      <!-- Bottom Card & Switch to Login Demo -->
      <div class="p-4 border-t border-gray-100 space-y-2">
        <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div class="flex items-center space-x-2 mb-1">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <p class="text-[11px] font-bold text-gray-900 uppercase tracking-tight">
              Zurich Vault Active
            </p>
          </div>
          <p class="text-xs text-gray-500 leading-relaxed">
            Synchronized with Paris & Ginza ateliers.
          </p>
        </div>

        <button
          (click)="viewAuthScreen.emit()"
          class="w-full py-2 px-3 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
        >
          <span class="material-symbols-outlined text-[16px] text-gray-500">lock_reset</span>
          <span>Switch to Login View</span>
        </button>
      </div>
    </aside>
  `
})
export class SidebarComponent {
  @Input() currentView: AppView = 'dashboard';
  @Output() viewChange = new EventEmitter<AppView>();
  @Output() viewAuthScreen = new EventEmitter<void>();

  selectView(view: AppView) {
    this.viewChange.emit(view);
  }
}
