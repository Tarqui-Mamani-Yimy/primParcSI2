import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DispatchService } from '../../core/services/dispatch.service';
import { ArchiveService } from '../../core/services/archive.service';
import { InventoryService } from '../../core/services/inventory.service';
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
          <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Cumplimiento global</span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">Despachos y Operaciones Logísticas</h1>
          <p class="text-xs text-gray-500 mt-1">
            Tránsito asegurado de alto valor y traspasos entre boutiques regionales.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            (click)="openNewDispatchModal()"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[18px]">add_box</span>
            <span>Registrar despacho</span>
          </button>
        </div>
      </div>

      <!-- Dispatches List -->
      <div class="space-y-4">
        <div
          *ngFor="let order of dispatchService.dispatches()"
          class="bg-white rounded-xl border border-gray-200 p-5 shadow-xs hover:border-gray-300 transition-all space-y-4"
        >
          <!-- Top Row: Reference & Status -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100">
                <span class="material-symbols-outlined text-[20px]">local_shipping</span>
              </div>
              <div>
                <div class="flex items-center space-x-2">
                  <span class="text-sm font-bold text-gray-900">{{ order.referencia }}</span>
                  <span class="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                    Dispatch
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">
                  Created: {{ order.creado_en | date:'medium' }}
                </p>
              </div>
            </div>

            <div class="flex items-center space-x-2.5">
              <span
                class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                [ngClass]="{
                  'bg-emerald-50 text-emerald-700 border-emerald-200': order.estado === 'entregado',
                  'bg-sky-50 text-sky-700 border-sky-200': order.estado === 'en_transito',
                  'bg-amber-50 text-amber-700 border-amber-200': order.estado === 'despachado',
                  'bg-gray-100 text-gray-700 border-gray-200': order.estado === 'preparacion'
                }"
              >
                {{ order.estado.replace('_', ' ') }}
              </span>
            </div>
          </div>

          <!-- Middle Row: Route & Details -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Destinatario</p>
              <p class="text-sm font-bold text-gray-900 mt-0.5">{{ order.cliente }}</p>
            </div>

            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ruta</p>
              <p class="text-xs font-semibold text-gray-900 mt-0.5">
                {{ getLocationName(order.origen_id) }} → {{ getLocationName(order.destino_id) }}
              </p>
            </div>

            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Producto y cantidad</p>
              <p class="text-xs font-semibold text-gray-900 mt-0.5">
                {{ getProductName(order.producto_id) }} × {{ order.cantidad }}
              </p>
            </div>
          </div>

          <!-- FASE 2: Status Update Control -->
          <div class="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <p class="text-gray-500 italic">
              Status update: Phase 2 (pending backend support)
            </p>
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
          <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Cumplimiento asegurado</span>
          <h2 class="text-lg font-bold text-gray-900 mt-0.5">Registrar despacho</h2>
          <p class="text-xs text-gray-500">Registra un despacho nuevo entre ubicaciones.</p>
        </div>

        <form (ngSubmit)="submitNewDispatch()" class="space-y-4">
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Destinatario / organización</label>
            <input type="text" [(ngModel)]="newClientName" name="client" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="ej. Real Academia de Artes" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Ubicación de origen</label>
              <select [(ngModel)]="newOriginId" name="origin" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option *ngFor="let loc of inventoryService.locations()" [value]="loc.id">
                  {{ loc.nombre }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Ubicación de destino</label>
              <select [(ngModel)]="newDestId" name="dest" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option *ngFor="let loc of inventoryService.locations()" [value]="loc.id">
                  {{ loc.nombre }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Producto a despachar</label>
            <select [(ngModel)]="newProductId" name="product" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <option *ngFor="let p of archiveService.products()" [value]="p.id">
                {{ p.sku }} — {{ p.nombre }} ({{ p.precio }} Bs)
              </option>
            </select>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Cantidad</label>
            <input type="number" min="1" [(ngModel)]="newQuantity" name="qty" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>

          <button type="submit" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs mt-4">
            Registrar despacho
          </button>
        </form>
      </div>
    </div>
  `
})
export class LogisticsComponent implements OnInit {
  showNewDispatchModal = signal<boolean>(false);

  newClientName = '';
  newOriginId = 'loc_paris';
  newDestId = 'loc_zurich';
  newProductId = 'prd_01';
  newQuantity = 1;

  constructor(
    public dispatchService: DispatchService,
    public archiveService: ArchiveService,
    public inventoryService: InventoryService
  ) {}

  ngOnInit() {
    this.dispatchService.loadDispatches();
    this.archiveService.loadProducts();
    this.inventoryService.loadLocations();
  }

  getLocationName(locId: string): string {
    return this.inventoryService.locations().find(l => l.id === locId)?.nombre || 'N/A';
  }

  getProductName(productId: string): string {
    return this.archiveService.products().find(p => p.id === productId)?.nombre || 'N/A';
  }

  openNewDispatchModal() {
    this.showNewDispatchModal.set(true);
  }

  submitNewDispatch() {
    if (!this.newClientName || !this.newOriginId || !this.newDestId || !this.newProductId) return;

    this.dispatchService.createDispatch({
      cliente: this.newClientName,
      origen_id: this.newOriginId,
      destino_id: this.newDestId,
      producto_id: this.newProductId,
      cantidad: this.newQuantity,
    }).then(() => {
      this.showNewDispatchModal.set(false);
      this.newClientName = '';
      this.newQuantity = 1;
    });
  }
}
