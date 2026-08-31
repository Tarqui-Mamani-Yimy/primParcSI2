import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DispatchService } from '../../core/services/dispatch.service';
import { ArchiveService } from '../../core/services/archive.service';
import { DispatchOrder } from '../../core/models';

@Component({
  selector: 'app-logistics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Global Fulfillment & White-Glove Courier
          </span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
            VIP Dispatches & Logistics Operations
          </h1>
          <p class="text-xs text-gray-500 mt-1">
            High-value secured transit with Ferrari Group Secured, DHL Global, and regional boutique transfers.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            (click)="openNewDispatchModal()"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[18px]">add_box</span>
            <span>Book VIP Dispatch</span>
          </button>
        </div>
      </div>

      <!-- Dispatches List & Filters -->
      <div class="space-y-4">
        <div
          *ngFor="let order of dispatchService.dispatches()"
          class="bg-white rounded-xl border border-gray-200 p-5 shadow-xs hover:border-gray-300 transition-all space-y-4"
        >
          <!-- Top Row: Reference, Courier & Status Badge -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100">
                <span class="material-symbols-outlined text-[20px]">local_shipping</span>
              </div>
              <div>
                <div class="flex items-center space-x-2">
                  <span class="text-sm font-bold text-gray-900">
                    {{ order.referenceNumber }}
                  </span>
                  <span class="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                    {{ order.clientType.replace('_', ' ') }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">
                  Tracking: <strong class="text-gray-900 font-mono text-[11px]">{{ order.trackingCode }}</strong> • Courier: {{ order.courier }}
                </p>
              </div>
            </div>

            <!-- Status Control Dropdown -->
            <div class="flex items-center space-x-2.5">
              <span
                class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                [ngClass]="{
                  'bg-emerald-50 text-emerald-700 border-emerald-200': order.status === 'DELIVERED',
                  'bg-sky-50 text-sky-700 border-sky-200': order.status === 'IN_TRANSIT',
                  'bg-amber-50 text-amber-700 border-amber-200': order.status === 'CUSTOMS_CLEARANCE',
                  'bg-gray-100 text-gray-700 border-gray-200': order.status === 'PREPARATION'
                }"
              >
                {{ order.status.replace('_', ' ') }}
              </span>

              <select
                [ngModel]="order.status"
                (ngModelChange)="updateOrderStatus(order.id, $event)"
                class="px-2.5 py-1 text-xs font-semibold uppercase border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PREPARATION">Preparation</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="CUSTOMS_CLEARANCE">Customs Clearance</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
          </div>

          <!-- Middle Row: Client, Route & Items -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Recipient & Destination
              </p>
              <p class="text-sm font-bold text-gray-900 mt-0.5">
                {{ order.clientName }}
              </p>
              <p class="text-xs text-gray-600 mt-0.5">
                {{ order.destinationHub }}
              </p>
              <p class="text-xs text-indigo-600 mt-1 font-semibold">
                ETA: {{ order.estimatedDelivery }}
              </p>
            </div>

            <div class="md:col-span-2">
              <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Enclosed Archival Pieces (Declared Value: €{{ order.totalValueEUR.toLocaleString() }})
              </p>
              <div class="space-y-1.5">
                <div *ngFor="let item of order.items" class="p-2.5 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between text-xs">
                  <div class="flex items-center space-x-2">
                    <span class="text-[10px] font-bold px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-700">
                      {{ item.sku }}
                    </span>
                    <span class="font-bold text-gray-900">{{ item.productName }}</span>
                    <span class="text-gray-500">(Size {{ item.size }} × {{ item.quantity }})</span>
                  </div>
                  <span class="font-bold text-gray-900">€{{ item.valueEUR.toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom: Notes & Manifest Action -->
          <div *ngIf="order.notes" class="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <p class="text-gray-500 italic">Special Handling: "{{ order.notes }}"</p>
            <button
              (click)="printManifest(order)"
              class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              Print Air Waybill & Manifest →
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- Booking Modal -->
    <div *ngIf="showNewDispatchModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-lg w-full rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8 max-h-[90vh] overflow-y-auto relative">
        <button (click)="showNewDispatchModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-5">
          <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Secured Fulfillment</span>
          <h2 class="text-lg font-bold text-gray-900 mt-0.5">Book VIP Dispatch</h2>
          <p class="text-xs text-gray-500">Generate encrypted dispatch declaration and priority courier booking.</p>
        </div>

        <form (ngSubmit)="submitNewDispatch()" class="space-y-4">
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Recipient / Organization</label>
            <input type="text" [(ngModel)]="newClientName" name="client" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="e.g. Royal Academy of Arts Archive" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Dispatch Classification</label>
              <select [(ngModel)]="newClientType" name="type" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="VIP_PRIVATE">VIP Private Client</option>
                <option value="BOUTIQUE_TRANSFER">Boutique Transfer</option>
                <option value="EDITORIAL_LOAN">Editorial Loan</option>
                <option value="ARCHIVE_ACQUISITION">Archive Acquisition</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Courier Partner</label>
              <select [(ngModel)]="newCourier" name="courier" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="Ferrari Luxury Secured">Ferrari Luxury Secured</option>
                <option value="DHL Express Global">DHL Express Global</option>
                <option value="Tokyo Express VIP">Tokyo Express VIP</option>
                <option value="Direct Courier">Direct White Glove</option>
              </select>
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Delivery Destination Address</label>
            <input type="text" [(ngModel)]="newDestination" name="destination" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="e.g. 24 Burlington Gardens, Mayfair London" />
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Garment SKU to Enclose</label>
            <select [(ngModel)]="newProductId" name="product" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <option *ngFor="let p of archiveService.products()" [value]="p.id">
                {{ p.sku }} — {{ p.name }} (€{{ p.priceEUR }})
              </option>
            </select>
          </div>

          <button type="submit" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs mt-4">
            Book Secured Dispatch
          </button>
        </form>
      </div>
    </div>
  `
})
export class LogisticsComponent {
  showNewDispatchModal = signal<boolean>(false);

  newClientName = '';
  newClientType: DispatchOrder['clientType'] = 'VIP_PRIVATE';
  newCourier: DispatchOrder['courier'] = 'Ferrari Luxury Secured';
  newDestination = '';
  newProductId = 'prd_01';

  constructor(
    public dispatchService: DispatchService,
    public archiveService: ArchiveService
  ) {}

  updateOrderStatus(orderId: string, status: DispatchOrder['status']) {
    this.dispatchService.updateStatus(orderId, status);
  }

  openNewDispatchModal() {
    this.showNewDispatchModal.set(true);
  }

  submitNewDispatch() {
    if (!this.newClientName || !this.newDestination) return;

    const prod = this.archiveService.getProductById(this.newProductId) || this.archiveService.products()[0];

    this.dispatchService.createDispatch({
      clientName: this.newClientName,
      clientType: this.newClientType,
      originLocationId: 'loc_paris',
      destinationHub: this.newDestination,
      courier: this.newCourier,
      trackingCode: 'SEC-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      status: 'PREPARATION',
      items: [
        {
          productName: prod.name,
          sku: prod.sku,
          size: 'M',
          quantity: 1,
          valueEUR: prod.priceEUR
        }
      ],
      totalValueEUR: prod.priceEUR,
      estimatedDelivery: '3 Business Days (Express Air)',
      notes: 'Standard AETHER luxury garment bag and archival box included.'
    });

    this.showNewDispatchModal.set(false);
  }

  printManifest(order: DispatchOrder) {
    alert(`Manifest Document Generated for ${order.referenceNumber}\nTracking: ${order.trackingCode}\nDeclared Value: €${order.totalValueEUR}\nCustoms Classification Verified.`);
  }
}
