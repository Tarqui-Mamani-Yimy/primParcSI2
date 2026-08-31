import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../core/services/inventory.service';
import { ArchiveService } from '../../core/services/archive.service';
import { InventoryStockEntry, ProductItem } from '../../core/models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Multi-Boutique Network
          </span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
            Global Stock Allocation Matrix
          </h1>
          <p class="text-xs text-gray-500 mt-1">
            Live inventory counts across Paris 8e, Tokyo Ginza, New York SoHo, Milan Montenapoleone, and Zurich Vault.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            (click)="openTransferModal()"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[18px]">swap_horiz</span>
            <span>Boutique Transfer</span>
          </button>
        </div>
      </div>

      <!-- Quick Location Filter Chips -->
      <div class="flex flex-wrap items-center gap-2 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
        <span class="text-xs font-bold uppercase tracking-wider text-gray-400 mr-1">
          Filter by Node:
        </span>
        <button
          (click)="selectedLocation.set('ALL')"
          [class.bg-indigo-600]="selectedLocation() === 'ALL'"
          [class.text-white]="selectedLocation() === 'ALL'"
          [class.text-gray-600]="selectedLocation() !== 'ALL'"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
        >
          All Hubs (Global)
        </button>
        <button
          *ngFor="let loc of inventoryService.locations()"
          (click)="selectedLocation.set(loc.id)"
          [class.bg-indigo-600]="selectedLocation() === loc.id"
          [class.text-white]="selectedLocation() === loc.id"
          [class.text-gray-600]="selectedLocation() !== loc.id"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
        >
          {{ loc.city }} ({{ loc.code }})
        </button>
      </div>

      <!-- Inventory Table -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                <th class="p-3.5 pl-6">Garment & SKU</th>
                <th class="p-3.5">Boutique Node</th>
                <th class="p-3.5 text-center">Size</th>
                <th class="p-3.5 text-center">Available Stock</th>
                <th class="p-3.5 text-center">Reserved (VIP)</th>
                <th class="p-3.5">Health Status</th>
                <th class="p-3.5 text-right pr-6">Quick Adjust</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-xs">
              <tr *ngFor="let item of filteredStock()" class="hover:bg-gray-50/70 transition-colors">
                
                <!-- Product SKU & Thumbnail -->
                <td class="p-3.5 pl-6">
                  <div class="flex items-center space-x-3">
                    <img
                      [src]="getProductImage(item.productId)"
                      [alt]="getProductName(item.productId)"
                      class="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200 shrink-0"
                    />
                    <div>
                      <span class="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">
                        {{ getProductSku(item.productId) }}
                      </span>
                      <p class="font-bold text-gray-900 leading-tight">
                        {{ getProductName(item.productId) }}
                      </p>
                    </div>
                  </div>
                </td>

                <!-- Location -->
                <td class="p-3.5">
                  <p class="font-bold text-gray-900">{{ getLocationName(item.locationId) }}</p>
                  <p class="text-[11px] text-gray-500">{{ getLocationCity(item.locationId) }}</p>
                </td>

                <!-- Size -->
                <td class="p-3.5 text-center font-bold text-gray-900">
                  <span class="px-2 py-0.5 bg-gray-100 rounded text-gray-700 text-xs">{{ item.size }}</span>
                </td>

                <!-- Available Stock -->
                <td class="p-3.5 text-center font-bold text-sm text-gray-900">
                  {{ item.quantity }}
                </td>

                <!-- Reserved -->
                <td class="p-3.5 text-center text-gray-500 font-medium">
                  {{ item.reserved }}
                </td>

                <!-- Health Status -->
                <td class="p-3.5">
                  <span
                    *ngIf="item.quantity <= item.minThreshold"
                    class="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold uppercase"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span>Low Stock</span>
                  </span>
                  <span
                    *ngIf="item.quantity > item.minThreshold"
                    class="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Optimal</span>
                  </span>
                </td>

                <!-- Quick Adjust Controls -->
                <td class="p-3.5 text-right pr-6">
                  <div class="inline-flex items-center space-x-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
                    <button
                      (click)="adjustStock(item.id, -1)"
                      class="w-6 h-6 rounded bg-white hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center transition-colors cursor-pointer text-xs shadow-xs"
                      title="Deduct 1 unit"
                    >
                      -
                    </button>
                    <span class="px-2 text-xs font-bold text-gray-900 min-w-[24px] text-center">
                      {{ item.quantity }}
                    </span>
                    <button
                      (click)="adjustStock(item.id, 1)"
                      class="w-6 h-6 rounded bg-white hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center transition-colors cursor-pointer text-xs shadow-xs"
                      title="Add 1 unit"
                    >
                      +
                    </button>
                  </div>
                </td>

              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Inter-Boutique Transfer Modal -->
    <div *ngIf="showTransferModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-lg w-full rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8 relative">
        <button (click)="showTransferModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-5">
          <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Internal Logistics</span>
          <h2 class="text-lg font-bold text-gray-900 mt-0.5">Boutique Rebalance Transfer</h2>
          <p class="text-xs text-gray-500">Transfer physical inventory pieces between regional boutiques or central vault.</p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Select Garment</label>
            <select [(ngModel)]="transferProductId" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <option *ngFor="let p of archiveService.products()" [value]="p.id">
                {{ p.sku }} — {{ p.name }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Source Origin</label>
              <select [(ngModel)]="transferFromLoc" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option *ngFor="let loc of inventoryService.locations()" [value]="loc.id">
                  {{ loc.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Destination Node</label>
              <select [(ngModel)]="transferToLoc" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option *ngFor="let loc of inventoryService.locations()" [value]="loc.id">
                  {{ loc.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Size Code</label>
              <select [(ngModel)]="transferSize" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="S">S (Small)</option>
                <option value="M">M (Medium)</option>
                <option value="L">L (Large)</option>
                <option value="XL">XL (Extra Large)</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Quantity (Pcs)</label>
              <input type="number" min="1" [(ngModel)]="transferQty" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>

          <button
            (click)="executeTransfer()"
            class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs mt-4"
          >
            Authorize & Schedule Transit
          </button>
        </div>
      </div>
    </div>
  `
})
export class InventoryComponent {
  selectedLocation = signal<string>('ALL');
  showTransferModal = signal<boolean>(false);

  transferProductId = 'prd_01';
  transferFromLoc = 'loc_zurich';
  transferToLoc = 'loc_paris';
  transferSize = 'M';
  transferQty = 2;

  constructor(
    public inventoryService: InventoryService,
    public archiveService: ArchiveService
  ) {}

  filteredStock = computed(() => {
    let list = this.inventoryService.stock();
    if (this.selectedLocation() !== 'ALL') {
      list = list.filter(s => s.locationId === this.selectedLocation());
    }
    return list;
  });

  getProduct(productId: string): ProductItem | undefined {
    return this.archiveService.getProductById(productId);
  }

  getProductName(productId: string): string {
    return this.getProduct(productId)?.name || 'Garment SKU';
  }

  getProductSku(productId: string): string {
    return this.getProduct(productId)?.sku || 'AETH';
  }

  getProductImage(productId: string): string {
    return (
      this.getProduct(productId)?.imageUrl ||
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=200&auto=format&fit=crop&q=80'
    );
  }

  getLocation(locId: string) {
    return this.inventoryService.locations().find(l => l.id === locId);
  }

  getLocationName(locId: string): string {
    return this.getLocation(locId)?.name || 'Central Vault';
  }

  getLocationCity(locId: string): string {
    return this.getLocation(locId)?.city || 'Global';
  }

  adjustStock(stockId: string, delta: number) {
    this.inventoryService.adjustStock(stockId, delta, 'Manual Operator Adjustment');
  }

  openTransferModal() {
    this.showTransferModal.set(true);
  }

  executeTransfer() {
    if (this.transferFromLoc === this.transferToLoc) {
      alert('Source and destination cannot be identical.');
      return;
    }
    const ok = this.inventoryService.transferStock(
      this.transferProductId,
      this.transferFromLoc,
      this.transferToLoc,
      this.transferSize,
      this.transferQty
    );
    if (ok) {
      this.showTransferModal.set(false);
    }
  }
}
