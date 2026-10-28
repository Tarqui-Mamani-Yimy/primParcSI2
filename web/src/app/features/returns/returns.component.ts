import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CreateExchangeIn,
  CreateReturnIn,
  ProductSearchResult,
  ReturnDetailOut,
  ReturnOut,
  ReturnableItemOut,
  ReturnsService,
  parseReturnErrorMessage,
} from '../../core/services/returns.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { CardPaymentComponent } from '../../shared/components/card-payment.component';

type TabType = 'nueva' | 'historial';
type OperationType = 'devolucion' | 'cambio';

@Component({
  selector: 'app-returns',
  standalone: true,
  imports: [CommonModule, FormsModule, CardPaymentComponent],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">

      <!-- Encabezado -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#38133E]">Operaciones de Tienda</span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">Gestión de Cambios y Devoluciones</h1>
          <p class="text-xs text-gray-500 mt-1">
            Recepción de prendas devueltas, reintegro a stock y gestión de cambios con cobro o reembolso de diferencia.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="recargarHistorial()"
            [disabled]="loadingReturns()"
            class="px-3.5 py-2 bg-white hover:bg-[#F3EFEA] border border-[#E8E2DA] text-[#17141A] rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-[16px]">refresh</span>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <!-- Pestañas (Tabs) -->
      <div class="flex items-center gap-2 border-b border-gray-200">
        <button
          *ngIf="canManage()"
          type="button"
          (click)="activeTab.set('nueva')"
          [class.text-ys-primary]="activeTab() === 'nueva'"
          [class.border-ys-primary]="activeTab() === 'nueva'"
          [class.text-gray-500]="activeTab() !== 'nueva'"
          [class.border-transparent]="activeTab() !== 'nueva'"
          class="px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors cursor-pointer flex items-center space-x-2"
        >
          <span class="material-symbols-outlined text-[16px]">add_circle</span>
          <span>Nueva Operación</span>
        </button>

        <button
          type="button"
          (click)="activeTab.set('historial')"
          [class.text-ys-primary]="activeTab() === 'historial'"
          [class.border-ys-primary]="activeTab() === 'historial'"
          [class.text-gray-500]="activeTab() !== 'historial'"
          [class.border-transparent]="activeTab() !== 'historial'"
          class="px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors cursor-pointer flex items-center space-x-2"
        >
          <span class="material-symbols-outlined text-[16px]">history</span>
          <span>Historial de Operaciones</span>
        </button>
      </div>

      <!-- ============================================================== -->
      <!-- TAB 1: NUEVA OPERACIÓN (Visible solo con devolucion.gestionar) -->
      <!-- ============================================================== -->
      <div *ngIf="activeTab() === 'nueva' && canManage()" class="space-y-6">

        <!-- Paso 1: Búsqueda de Venta -->
        <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div class="flex items-center space-x-2 text-gray-800">
            <span class="material-symbols-outlined text-[#38133E] text-[20px]">search</span>
            <h2 class="text-sm font-bold uppercase tracking-wider text-gray-700">1. Buscar Venta por ID</h2>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div class="w-full sm:w-64">
              <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Número de Venta *
              </label>
              <input
                type="number"
                min="1"
                placeholder="Ej. 1024"
                [ngModel]="saleIdInput()"
                (ngModelChange)="saleIdInput.set($event)"
                (keyup.enter)="buscarVenta()"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#38133E]"
              />
            </div>

            <button
              type="button"
              (click)="buscarVenta()"
              [disabled]="searchingSale() || !saleIdInput()"
              class="mt-auto sm:mt-5 px-5 py-2.5 rounded-lg bg-[#38133E] text-white text-xs font-bold uppercase tracking-wide hover:bg-[#260B2B] transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <span *ngIf="searchingSale()" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              <span>{{ searchingSale() ? 'Buscando…' : 'Buscar Venta' }}</span>
            </button>

            <button
              *ngIf="currentSaleId() !== null"
              type="button"
              (click)="limpiarBusqueda()"
              class="mt-auto sm:mt-5 px-3 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              Nueva Búsqueda
            </button>
          </div>

          <!-- Mensaje de error al buscar venta -->
          <div *ngIf="saleSearchError()" class="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center space-x-2">
            <span class="material-symbols-outlined text-[18px]">error</span>
            <span>{{ saleSearchError() }}</span>
          </div>
        </div>

        <!-- Paso 2: Ítems Devolvibles de la Venta -->
        <div *ngIf="currentSaleId() !== null && returnableItems().length > 0" class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div class="flex items-center justify-between pb-3 border-b border-gray-100">
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-[#38133E] text-[20px]">inventory</span>
              <h2 class="text-sm font-bold uppercase tracking-wider text-gray-700">
                2. Ítems de la Venta #{{ currentSaleId() }}
              </h2>
            </div>
            <span class="text-xs text-gray-500">
              Período de validez: 30 días desde la fecha de compra
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead>
                <tr class="text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-gray-100 bg-gray-50/50">
                  <th class="py-2.5 px-3">Producto</th>
                  <th class="py-2.5 px-3 text-center">Vendidos</th>
                  <th class="py-2.5 px-3 text-center">Ya Devueltos</th>
                  <th class="py-2.5 px-3 text-center">Disponibles</th>
                  <th class="py-2.5 px-3 text-right">Precio Unit.</th>
                  <th class="py-2.5 px-3 text-center">Cantidad a Devolver / Cambiar</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr *ngFor="let item of returnableItems()" class="hover:bg-gray-50/60 transition-colors">
                  <td class="py-3 px-3">
                    <p class="font-medium text-gray-900">{{ item.product_name }}</p>
                    <p class="text-[11px] text-gray-400">ID Ítem Venta: {{ item.sale_item_id }}</p>
                  </td>
                  <td class="py-3 px-3 text-center text-gray-600 font-semibold">{{ item.sold_quantity }}</td>
                  <td class="py-3 px-3 text-center text-gray-500">{{ item.returned_quantity }}</td>
                  <td class="py-3 px-3 text-center">
                    <span
                      class="px-2 py-0.5 rounded-full text-xs font-bold"
                      [ngClass]="item.returnable_quantity > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400'"
                    >
                      {{ item.returnable_quantity }}
                    </span>
                  </td>
                  <td class="py-3 px-3 text-right font-medium text-gray-800">
                    {{ formatCurrency(item.unit_price) }}
                  </td>
                  <td class="py-3 px-3 text-center">
                    <!-- Si la operación es DEVOLUCIÓN: selección múltiple con input numérico -->
                    <div *ngIf="operationType() === 'devolucion'" class="inline-flex items-center space-x-1">
                      <button
                        type="button"
                        (click)="decrementItemQuantity(item.sale_item_id)"
                        [disabled]="getQuantityToReturn(item.sale_item_id) <= 0"
                        class="w-7 h-7 rounded border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        [max]="item.returnable_quantity"
                        [ngModel]="getQuantityToReturn(item.sale_item_id)"
                        (ngModelChange)="setItemQuantity(item.sale_item_id, $event, item.returnable_quantity)"
                        class="w-14 text-center text-xs font-bold border border-gray-200 rounded px-1 py-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        (click)="incrementItemQuantity(item.sale_item_id, item.returnable_quantity)"
                        [disabled]="getQuantityToReturn(item.sale_item_id) >= item.returnable_quantity"
                        class="w-7 h-7 rounded border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>

                    <!-- Si la operación es CAMBIO: radio button para elegir el único ítem a cambiar -->
                    <div *ngIf="operationType() === 'cambio'" class="flex items-center justify-center">
                      <input
                        type="radio"
                        name="exchangeItem"
                        [disabled]="item.returnable_quantity <= 0"
                        [checked]="exchangeSaleItemId() === item.sale_item_id"
                        (change)="selectItemForExchange(item)"
                        class="w-4 h-4 text-[#38133E] focus:ring-[#38133E] cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Paso 3: Selector de Tipo de Operación (Devolución vs Cambio) -->
          <div class="pt-4 border-t border-gray-200 space-y-4">
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-[#38133E] text-[20px]">swap_horiz</span>
              <h2 class="text-sm font-bold uppercase tracking-wider text-gray-700">3. Tipo de Operación</h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Opción Devolución -->
              <label
                (click)="operationType.set('devolucion')"
                [class.border-[#38133E]]="operationType() === 'devolucion'"
                [class.bg-[#F5EBF7]/30]="operationType() === 'devolucion'"
                class="p-4 rounded-xl border border-gray-200 cursor-pointer flex items-start space-x-3 transition-colors hover:border-gray-300"
              >
                <input
                  type="radio"
                  name="opType"
                  [checked]="operationType() === 'devolucion'"
                  class="mt-1 text-[#38133E] focus:ring-[#38133E]"
                />
                <div>
                  <p class="font-bold text-sm text-gray-900">Devolución de Prenda(s)</p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    El cliente devuelve los ítems seleccionados. El dinero se reembolsa según el método de pago original (efectivo en caja o reversión en Stripe).
                  </p>
                </div>
              </label>

              <!-- Opción Cambio -->
              <label
                (click)="operationType.set('cambio')"
                [class.border-[#38133E]]="operationType() === 'cambio'"
                [class.bg-[#F5EBF7]/30]="operationType() === 'cambio'"
                class="p-4 rounded-xl border border-gray-200 cursor-pointer flex items-start space-x-3 transition-colors hover:border-gray-300"
              >
                <input
                  type="radio"
                  name="opType"
                  [checked]="operationType() === 'cambio'"
                  class="mt-1 text-[#38133E] focus:ring-[#38133E]"
                />
                <div>
                  <p class="font-bold text-sm text-gray-900">Cambio de Prenda</p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    Se devuelve un ítem y se entrega otro producto de la sucursal. Si el nuevo cuesta más, se cobra la diferencia; si cuesta menos, se reembolsa.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <!-- Sección específica para CAMBIO: Elección de Producto de Reemplazo -->
          <div *ngIf="operationType() === 'cambio'" class="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-[#38133E] text-[18px]">add_shopping_cart</span>
              <h3 class="text-xs font-bold uppercase tracking-wider text-gray-800">
                Selección de Producto de Reemplazo
              </h3>
            </div>

            <div *ngIf="!selectedItemForExchange()" class="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
              Seleccioná arriba en la tabla el ítem que se entregará en cambio.
            </div>

            <div *ngIf="selectedItemForExchange()" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Cantidad a cambiar del ítem original (Máx. {{ selectedItemForExchange()?.returnable_quantity }})
                  </label>
                  <input
                    type="number"
                    min="1"
                    [max]="selectedItemForExchange()?.returnable_quantity || 1"
                    [ngModel]="exchangeQuantity()"
                    (ngModelChange)="setExchangeQuantity($event)"
                    class="w-32 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Cantidad de la nueva prenda a entregar
                  </label>
                  <input
                    type="number"
                    min="1"
                    [ngModel]="replacementQuantity()"
                    (ngModelChange)="setReplacementQuantity($event)"
                    class="w-32 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none"
                  />
                </div>
              </div>

              <!-- Buscador de producto de reemplazo en catálogo -->
              <div class="space-y-2">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Buscar Producto de Reemplazo en Catálogo
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre, tipo o color de la prenda…"
                    [ngModel]="replacementSearchQuery()"
                    (ngModelChange)="replacementSearchQuery.set($event)"
                    (keyup.enter)="buscarProductosReemplazo()"
                    class="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#38133E]"
                  />
                  <button
                    type="button"
                    (click)="buscarProductosReemplazo()"
                    [disabled]="searchingProducts()"
                    class="px-4 py-2 bg-[#38133E] text-white rounded-lg text-xs font-semibold hover:bg-[#260B2B] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {{ searchingProducts() ? 'Buscando…' : 'Buscar' }}
                  </button>
                </div>

                <!-- Lista de resultados de búsqueda -->
                <div *ngIf="replacementResults().length > 0" class="max-h-52 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
                  <div
                    *ngFor="let prod of replacementResults()"
                    (click)="seleccionarProductoReemplazo(prod)"
                    class="p-2.5 flex items-center justify-between hover:bg-[#F5EBF7]/40 cursor-pointer transition-colors"
                  >
                    <div>
                      <p class="font-bold text-xs text-gray-900">{{ prod.nombre }}</p>
                      <p class="text-[10px] text-gray-400">
                        {{ prod.tipo ? prod.tipo + ' · ' : '' }}
                        {{ prod.talla ? 'Talla ' + prod.talla + ' · ' : '' }}
                        {{ prod.color ? prod.color : '' }}
                      </p>
                    </div>
                    <div class="text-right">
                      <span class="text-xs font-bold text-gray-900">{{ formatCurrency(prod.venta) }}</span>
                      <button
                        type="button"
                        class="block text-[10px] font-bold text-[#38133E] uppercase mt-0.5"
                      >
                        Seleccionar
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Producto de reemplazo seleccionado -->
                <div *ngIf="selectedReplacement()" class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Prenda Elegida:</span>
                    <p class="text-xs font-bold text-gray-900">{{ selectedReplacement()?.nombre }}</p>
                    <p class="text-[11px] text-gray-600">
                      Precio: {{ formatCurrency(selectedReplacement()?.venta || 0) }} c/u
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="selectedReplacement.set(null)"
                    class="text-xs text-rose-700 hover:underline font-semibold cursor-pointer"
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Resumen de Importes y Confirmación -->
          <div class="pt-4 border-t border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <!-- Resumen Devolución -->
              <div *ngIf="operationType() === 'devolucion'">
                <span class="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Monto Total a Reembolsar:</span>
                <p class="text-2xl font-black text-gray-900">{{ formatCurrency(totalRefundAmount()) }}</p>
                <p class="text-xs text-gray-500">
                  {{ selectedReturnItemsCount() }} ítem(s) seleccionado(s) para devolución.
                </p>
              </div>

              <!-- Resumen Cambio -->
              <div *ngIf="operationType() === 'cambio'">
                <div *ngIf="exchangeFinancialSummary() as sum">
                  <div *ngIf="sum.difference > 0">
                    <span class="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Diferencia a Cobrar al Cliente:</span>
                    <p class="text-2xl font-black text-amber-900">{{ formatCurrency(sum.difference) }}</p>
                    <p class="text-xs text-gray-500">La nueva prenda tiene mayor valor. Se cobrará en efectivo o tarjeta.</p>
                  </div>

                  <div *ngIf="sum.difference < 0">
                    <span class="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Diferencia a Reembolsar al Cliente:</span>
                    <p class="text-2xl font-black text-emerald-900">{{ formatCurrency(sum.absDifference) }}</p>
                    <p class="text-xs text-gray-500">La nueva prenda tiene menor valor. Se devolverá la diferencia.</p>
                  </div>

                  <div *ngIf="sum.difference === 0 && selectedReplacement()">
                    <span class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Diferencia de Precio:</span>
                    <p class="text-2xl font-black text-gray-900">{{ formatCurrency(0) }}</p>
                    <p class="text-xs text-gray-500">Cambio directo sin importe adicional.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Botón de Confirmación Principal -->
            <div>
              <button
                type="button"
                (click)="confirmarOperacion()"
                [disabled]="submitting() || !isFormValid()"
                class="w-full md:w-auto px-6 py-3 rounded-xl bg-[#38133E] hover:bg-[#260B2B] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-xs flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span *ngIf="submitting()" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                <span>{{ submitting() ? 'Procesando…' : (operationType() === 'devolucion' ? 'Confirmar Devolución' : 'Confirmar Cambio') }}</span>
              </button>
            </div>
          </div>

          <!-- Mensajes de feedback -->
          <div *ngIf="submitError()" class="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center space-x-2">
            <span class="material-symbols-outlined text-[18px]">error</span>
            <span>{{ submitError() }}</span>
          </div>

          <div *ngIf="submitSuccess()" class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2">
            <span class="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{{ submitSuccess() }}</span>
          </div>
        </div>

        <!-- Si no hay ítems devolvibles en la venta -->
        <div *ngIf="currentSaleId() !== null && returnableItems().length === 0 && !searchingSale()" class="p-6 bg-white rounded-xl border border-gray-200 text-center space-y-2">
          <span class="material-symbols-outlined text-gray-400 text-3xl">production_quantity_limits</span>
          <p class="text-sm font-bold text-gray-800">Esta venta no tiene prendas disponibles para devolución.</p>
          <p class="text-xs text-gray-500">Es posible que todos los ítems ya hayan sido devueltos previamente.</p>
        </div>

        <!-- Modal / Widget de Pago con Tarjeta Stripe para Cambios con Diferencia a Cobrar -->
        <div *ngIf="stripeClientSecret()" class="fixed inset-0 z-50 bg-[#17141A]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-gray-100">
              <div class="flex items-center space-x-2">
                <span class="material-symbols-outlined text-[#38133E] text-[22px]">credit_card</span>
                <h3 class="font-bold text-sm text-gray-900">Cobro de Diferencia con Tarjeta</h3>
              </div>
              <span class="text-xs font-bold text-[#38133E]">
                {{ formatCurrency(stripeAmountDue()) }}
              </span>
            </div>

            <p class="text-xs text-gray-600">
              Ingresá los datos de la tarjeta para completar el cobro de la diferencia del cambio (#{{ pendingReturnId() }}).
            </p>

            <app-card-payment
              [clientSecret]="stripeClientSecret()"
              concepto="Diferencia por cambio de prenda"
              (pagado)="onStripePaid($event)"
              (fallo)="onStripeFailed($event)"
              (cancelado)="onStripeCancelled()"
            ></app-card-payment>
          </div>
        </div>

      </div>

      <!-- ============================================================== -->
      <!-- TAB 2: HISTORIAL DE DEVOLUCIONES Y CAMBIOS (Visible con devolucion.ver) -->
      <!-- ============================================================== -->
      <div *ngIf="activeTab() === 'historial'" class="space-y-4">

        <!-- Barra de Filtros del Historial -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipo:</label>
            <select
              [ngModel]="historyTypeFilter()"
              (ngModelChange)="historyTypeFilter.set($event)"
              class="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white cursor-pointer focus:outline-none"
            >
              <option value="all">Todos los Tipos</option>
              <option value="devolucion">Solo Devoluciones</option>
              <option value="cambio">Solo Cambios</option>
            </select>

            <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-2">Estado:</label>
            <select
              [ngModel]="historyStatusFilter()"
              (ngModelChange)="historyStatusFilter.set($event)"
              class="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white cursor-pointer focus:outline-none"
            >
              <option value="all">Todos los Estados</option>
              <option value="completed">Completados</option>
              <option value="payment_pending">Pago/Reembolso Pendiente</option>
              <option value="payment_failed">Pago/Reembolso Fallido</option>
            </select>
          </div>

          <div class="text-xs text-gray-500">
            Total registros: <span class="font-bold text-gray-800">{{ filteredReturns().length }}</span>
          </div>
        </div>

        <!-- Tabla del Historial -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div *ngIf="loadingReturns()" class="p-8 text-center text-xs text-gray-500">
            <span class="material-symbols-outlined text-[24px] animate-spin mb-1">progress_activity</span>
            <p>Cargando registros de devoluciones y cambios…</p>
          </div>

          <div *ngIf="!loadingReturns() && filteredReturns().length === 0" class="p-8 text-center text-xs text-gray-400 space-y-1">
            <span class="material-symbols-outlined text-[28px] text-gray-300">receipt_long</span>
            <p class="font-medium">No se encontraron operaciones registradas con los filtros actuales.</p>
          </div>

          <div *ngIf="!loadingReturns() && filteredReturns().length > 0" class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead>
                <tr class="text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-gray-100 bg-gray-50/50">
                  <th class="py-2.5 px-3"># ID</th>
                  <th class="py-2.5 px-3">ID Venta</th>
                  <th class="py-2.5 px-3">Tipo</th>
                  <th class="py-2.5 px-3">Fecha</th>
                  <th class="py-2.5 px-3">Método</th>
                  <th class="py-2.5 px-3 text-right">Reembolso</th>
                  <th class="py-2.5 px-3 text-right">Cobrado</th>
                  <th class="py-2.5 px-3 text-center">Estado</th>
                  <th class="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr *ngFor="let ret of filteredReturns()" class="hover:bg-gray-50/60 transition-colors">
                  <td class="py-3 px-3 font-bold text-gray-900">#{{ ret.id }}</td>
                  <td class="py-3 px-3 text-gray-600 font-medium">#{{ ret.sale_id }}</td>
                  <td class="py-3 px-3">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      [ngClass]="ret.type === 'devolucion' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'"
                    >
                      {{ ret.type === 'devolucion' ? 'Devolución' : 'Cambio' }}
                    </span>
                  </td>
                  <td class="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">
                    {{ formatDate(ret.created_at) }}
                  </td>
                  <td class="py-3 px-3 text-xs text-gray-700 capitalize">
                    {{ ret.payment_method || '—' }}
                  </td>
                  <td class="py-3 px-3 text-right font-medium text-emerald-700">
                    {{ formatCurrency(ret.refund_amount) }}
                  </td>
                  <td class="py-3 px-3 text-right font-medium text-gray-800">
                    {{ formatCurrency(ret.amount_due) }}
                  </td>
                  <td class="py-3 px-3 text-center">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block"
                      [ngClass]="getStatusBadgeColor(ret.status)"
                    >
                      {{ getStatusLabel(ret.status) }}
                    </span>
                  </td>
                  <td class="py-3 px-3 text-right whitespace-nowrap">
                    <div class="inline-flex items-center space-x-1.5">
                      <!-- Botón Reintentar si payment_failed o payment_pending -->
                      <button
                        *ngIf="canManage() && (ret.status === 'payment_failed' || ret.status === 'payment_pending')"
                        type="button"
                        (click)="reintentarReembolso(ret.id)"
                        [disabled]="processingActionId() === ret.id"
                        class="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                        title="Reintentar proceso de reembolso en Stripe"
                      >
                        <span *ngIf="processingActionId() === ret.id" class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                        <span *ngIf="processingActionId() !== ret.id" class="material-symbols-outlined text-[14px]">replay</span>
                        <span>Reintentar</span>
                      </button>

                      <!-- Botón Ver Detalle -->
                      <button
                        type="button"
                        (click)="verDetalle(ret.id)"
                        class="px-2.5 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Ver Detalle
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- ============================================================== -->
      <!-- MODAL DE DETALLE DE DEVOLUCIÓN O CAMBIO -->
      <!-- ============================================================== -->
      <div *ngIf="activeDetailModal()" class="fixed inset-0 z-50 bg-[#17141A]/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-xl w-full p-6 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#38133E]">
                {{ activeDetailModal()?.type === 'devolucion' ? 'Detalle de Devolución' : 'Detalle de Cambio' }}
              </span>
              <h3 class="font-bold text-base text-gray-900 mt-0.5">Operación #{{ activeDetailModal()?.id }}</h3>
            </div>
            <button
              type="button"
              (click)="activeDetailModal.set(null)"
              class="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div *ngIf="activeDetailModal() as d" class="space-y-4">
            <div class="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span class="text-gray-400 font-semibold">ID Venta:</span>
                <p class="font-bold text-gray-800">#{{ d.sale_id }}</p>
              </div>
              <div>
                <span class="text-gray-400 font-semibold">Fecha:</span>
                <p class="font-bold text-gray-800">{{ formatDate(d.created_at) }}</p>
              </div>
              <div>
                <span class="text-gray-400 font-semibold">Estado:</span>
                <p class="font-bold" [ngClass]="getStatusTextColor(d.status)">{{ getStatusLabel(d.status) }}</p>
              </div>
              <div>
                <span class="text-gray-400 font-semibold">Método de Pago:</span>
                <p class="font-bold text-gray-800 capitalize">{{ d.payment_method || '—' }}</p>
              </div>
              <div>
                <span class="text-gray-400 font-semibold">Monto Reembolso:</span>
                <p class="font-bold text-emerald-700">{{ formatCurrency(d.refund_amount) }}</p>
              </div>
              <div>
                <span class="text-gray-400 font-semibold">Monto Cobrado:</span>
                <p class="font-bold text-gray-800">{{ formatCurrency(d.amount_due) }}</p>
              </div>
              <div *ngIf="d.stripe_refund_id" class="col-span-2">
                <span class="text-gray-400 font-semibold">ID Reembolso Stripe:</span>
                <p class="font-mono text-[11px] text-gray-700">{{ d.stripe_refund_id }}</p>
              </div>
            </div>

            <!-- Ítems devueltos -->
            <div class="space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-700">Ítems Devueltos</h4>
              <div class="border border-gray-100 rounded-lg overflow-hidden">
                <table class="w-full text-xs text-left">
                  <thead class="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase font-bold">
                    <tr>
                      <th class="py-1.5 px-3">ID Ítem Venta</th>
                      <th class="py-1.5 px-3 text-center">Cantidad</th>
                      <th class="py-1.5 px-3 text-right">Precio Unit.</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr *ngFor="let it of d.items">
                      <td class="py-2 px-3 font-medium text-gray-800">#{{ it.sale_item_id }}</td>
                      <td class="py-2 px-3 text-center font-bold text-gray-700">{{ it.quantity }}</td>
                      <td class="py-2 px-3 text-right font-medium text-gray-800">{{ formatCurrency(it.unit_price) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Reemplazos (si es cambio) -->
            <div *ngIf="d.replacements && d.replacements.length > 0" class="space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-700">Prendas de Reemplazo</h4>
              <div class="border border-gray-100 rounded-lg overflow-hidden">
                <table class="w-full text-xs text-left">
                  <thead class="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase font-bold">
                    <tr>
                      <th class="py-1.5 px-3">ID Producto</th>
                      <th class="py-1.5 px-3 text-center">Cantidad</th>
                      <th class="py-1.5 px-3 text-right">Precio Unit.</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr *ngFor="let rep of d.replacements">
                      <td class="py-2 px-3 font-medium text-gray-800">Producto #{{ rep.product_id }}</td>
                      <td class="py-2 px-3 text-center font-bold text-gray-700">{{ rep.quantity }}</td>
                      <td class="py-2 px-3 text-right font-medium text-gray-800">{{ formatCurrency(rep.unit_price) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="pt-3 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              (click)="activeDetailModal.set(null)"
              class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

    </div>
  `
})
export class ReturnsComponent implements OnInit {
  activeTab = signal<TabType>('nueva');
  operationType = signal<OperationType>('devolucion');

  // Permisos
  canManage = computed(() => this.authService.hasPermission('devolucion.gestionar'));
  canView = computed(() => this.authService.hasPermission('devolucion.ver'));

  // Paso 1: Búsqueda de venta
  saleIdInput = signal<number | null>(null);
  searchingSale = signal(false);
  saleSearchError = signal<string | null>(null);
  currentSaleId = signal<number | null>(null);
  returnableItems = signal<ReturnableItemOut[]>([]);

  // Paso 2: Cantidades seleccionadas para DEVOLUCIÓN (sale_item_id -> cantidad)
  selectedQuantities = signal<Record<number, number>>({});

  // Paso 2: Selección para CAMBIO (un solo ítem a cambiar)
  exchangeSaleItemId = signal<number | null>(null);
  exchangeQuantity = signal<number>(1);
  replacementQuantity = signal<number>(1);
  replacementSearchQuery = signal<string>('');
  replacementResults = signal<ProductSearchResult[]>([]);
  searchingProducts = signal(false);
  selectedReplacement = signal<ProductSearchResult | null>(null);

  // Estados de envío y feedback
  submitting = signal(false);
  submitError = signal<string | null>(null);
  submitSuccess = signal<string | null>(null);

  // Modal Stripe para cobro de diferencia en cambios
  stripeClientSecret = signal<string | null>(null);
  pendingReturnId = signal<number | null>(null);
  stripeAmountDue = signal<number>(0);

  // Historial
  returnsList = signal<ReturnOut[]>([]);
  loadingReturns = signal(false);
  historyTypeFilter = signal<'all' | 'devolucion' | 'cambio'>('all');
  historyStatusFilter = signal<'all' | 'completed' | 'payment_pending' | 'payment_failed'>('all');
  processingActionId = signal<number | null>(null);
  activeDetailModal = signal<ReturnDetailOut | null>(null);

  constructor(
    private returnsService: ReturnsService,
    private authService: AuthService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    if (!this.canManage()) {
      this.activeTab.set('historial');
    }
    this.recargarHistorial();
  }

  // =========================================================================
  // GESTIÓN DE BÚSQUEDA DE VENTAS
  // =========================================================================

  async buscarVenta(): Promise<void> {
    const saleId = this.saleIdInput();
    if (!saleId || saleId <= 0) {
      this.saleSearchError.set('Ingresá un número de venta válido.');
      return;
    }

    this.searchingSale.set(true);
    this.saleSearchError.set(null);
    this.submitError.set(null);
    this.submitSuccess.set(null);

    try {
      const items = await this.returnsService.getReturnableItems(saleId);
      this.currentSaleId.set(saleId);
      this.returnableItems.set(items);
      this.selectedQuantities.set({});
      this.exchangeSaleItemId.set(null);
      this.selectedReplacement.set(null);
      this.replacementResults.set([]);
    } catch (err) {
      const msg = parseReturnErrorMessage(err);
      this.saleSearchError.set(msg);
      this.currentSaleId.set(null);
      this.returnableItems.set([]);
    } finally {
      this.searchingSale.set(false);
    }
  }

  limpiarBusqueda(): void {
    this.saleIdInput.set(null);
    this.currentSaleId.set(null);
    this.returnableItems.set([]);
    this.selectedQuantities.set({});
    this.exchangeSaleItemId.set(null);
    this.selectedReplacement.set(null);
    this.replacementResults.set([]);
    this.saleSearchError.set(null);
    this.submitError.set(null);
    this.submitSuccess.set(null);
  }

  // =========================================================================
  // GESTIÓN DE CANTIDADES EN DEVOLUCIÓN
  // =========================================================================

  getQuantityToReturn(saleItemId: number): number {
    return this.selectedQuantities()[saleItemId] || 0;
  }

  setItemQuantity(saleItemId: number, value: number, max: number): void {
    const parsed = Math.max(0, Math.min(Math.floor(Number(value) || 0), max));
    const current = { ...this.selectedQuantities() };
    if (parsed > 0) {
      current[saleItemId] = parsed;
    } else {
      delete current[saleItemId];
    }
    this.selectedQuantities.set(current);
  }

  incrementItemQuantity(saleItemId: number, max: number): void {
    const cur = this.getQuantityToReturn(saleItemId);
    if (cur < max) {
      this.setItemQuantity(saleItemId, cur + 1, max);
    }
  }

  decrementItemQuantity(saleItemId: number): void {
    const cur = this.getQuantityToReturn(saleItemId);
    if (cur > 0) {
      this.setItemQuantity(saleItemId, cur - 1, 9999);
    }
  }

  selectedReturnItemsCount = computed(() => {
    const q = this.selectedQuantities();
    return Object.values(q).reduce((sum, val) => sum + (val > 0 ? 1 : 0), 0);
  });

  totalRefundAmount = computed(() => {
    const q = this.selectedQuantities();
    const items = this.returnableItems();
    let total = 0;
    for (const item of items) {
      const qty = q[item.sale_item_id] || 0;
      if (qty > 0) {
        total += qty * Number(item.unit_price);
      }
    }
    return Math.round(total * 100) / 100;
  });

  // =========================================================================
  // GESTIÓN DE CAMBIO
  // =========================================================================

  selectItemForExchange(item: ReturnableItemOut): void {
    this.exchangeSaleItemId.set(item.sale_item_id);
    this.exchangeQuantity.set(1);
  }

  selectedItemForExchange(): ReturnableItemOut | null {
    const id = this.exchangeSaleItemId();
    if (!id) return null;
    return this.returnableItems().find(it => it.sale_item_id === id) || null;
  }

  setExchangeQuantity(val: number): void {
    const max = this.selectedItemForExchange()?.returnable_quantity || 1;
    this.exchangeQuantity.set(Math.max(1, Math.min(Math.floor(Number(val) || 1), max)));
  }

  setReplacementQuantity(val: number): void {
    this.replacementQuantity.set(Math.max(1, Math.floor(Number(val) || 1)));
  }

  async buscarProductosReemplazo(): Promise<void> {
    const q = this.replacementSearchQuery().trim();
    this.searchingProducts.set(true);
    try {
      const results = await this.returnsService.searchProducts(q);
      this.replacementResults.set(results);
      if (results.length === 0) {
        this.notificationService.info('Sin resultados', 'No se encontraron prendas con el término buscado.');
      }
    } catch {
      this.notificationService.error('Error', 'No se pudo buscar productos en el catálogo.');
    } finally {
      this.searchingProducts.set(false);
    }
  }

  seleccionarProductoReemplazo(prod: ProductSearchResult): void {
    this.selectedReplacement.set(prod);
    this.replacementResults.set([]);
  }

  exchangeFinancialSummary = computed(() => {
    const oldItem = this.selectedItemForExchange();
    const rep = this.selectedReplacement();
    if (!oldItem || !rep) {
      return { difference: 0, absDifference: 0 };
    }
    const originalTotal = Number(oldItem.unit_price) * this.exchangeQuantity();
    const replacementTotal = rep.venta * this.replacementQuantity();
    const diff = Math.round((replacementTotal - originalTotal) * 100) / 100;
    return {
      difference: diff,
      absDifference: Math.abs(diff),
    };
  });

  isFormValid = computed(() => {
    if (this.operationType() === 'devolucion') {
      return this.selectedReturnItemsCount() > 0 && this.totalRefundAmount() > 0;
    } else {
      return (
        this.selectedItemForExchange() !== null &&
        this.selectedReplacement() !== null &&
        this.exchangeQuantity() > 0 &&
        this.replacementQuantity() > 0
      );
    }
  });

  // =========================================================================
  // CONFIRMAR OPERACIÓN (DEVOLUCIÓN O CAMBIO)
  // =========================================================================

  async confirmarOperacion(): Promise<void> {
    if (!this.canManage()) {
      this.notificationService.error('Acceso denegado', 'No tenés permisos para gestionar devoluciones.');
      return;
    }
    if (!this.isFormValid()) {
      return;
    }

    const saleId = this.currentSaleId();
    if (!saleId) return;

    this.submitting.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(null);

    if (this.operationType() === 'devolucion') {
      await this.procesarDevolucion(saleId);
    } else {
      await this.procesarCambio(saleId);
    }
  }

  private async procesarDevolucion(saleId: number): Promise<void> {
    const q = this.selectedQuantities();
    const items = Object.entries(q)
      .filter(([_, qty]) => qty > 0)
      .map(([saleItemId, qty]) => ({
        sale_item_id: Number(saleItemId),
        quantity: qty,
      }));

    try {
      const res = await this.returnsService.createReturn({ sale_id: saleId, items });
      this.submitting.set(false);
      this.notificationService.success(
        'Devolución Registrada',
        `Devolución #${res.id} completada exitosamente. Monto reembolsado: ${this.formatCurrency(res.refund_amount)}.`
      );
      this.submitSuccess.set(`Devolución #${res.id} registrada exitosamente.`);
      this.limpiarBusqueda();
      this.recargarHistorial();
    } catch (err) {
      this.submitting.set(false);
      const msg = parseReturnErrorMessage(err);
      this.submitError.set(msg);
      this.notificationService.error('Error al registrar devolución', msg);
    }
  }

  private async procesarCambio(saleId: number): Promise<void> {
    const oldItem = this.selectedItemForExchange();
    const replacement = this.selectedReplacement();
    if (!oldItem || !replacement) {
      this.submitting.set(false);
      return;
    }

    const payload: CreateExchangeIn = {
      sale_id: saleId,
      sale_item_id: oldItem.sale_item_id,
      quantity: this.exchangeQuantity(),
      replacement_product_id: replacement.idProducto,
      replacement_quantity: this.replacementQuantity(),
    };

    try {
      const res = await this.returnsService.createExchange(payload);
      this.submitting.set(false);

      if (res.client_secret && Number(res.amount_due) > 0) {
        // Se requiere pago de diferencia mediante Stripe
        this.stripeClientSecret.set(res.client_secret);
        this.pendingReturnId.set(res.id);
        this.stripeAmountDue.set(Number(res.amount_due));
      } else {
        this.notificationService.success(
          'Cambio Registrado',
          `Cambio #${res.id} procesado con éxito.`
        );
        this.submitSuccess.set(`Cambio #${res.id} registrado exitosamente.`);
        this.limpiarBusqueda();
        this.recargarHistorial();
      }
    } catch (err) {
      this.submitting.set(false);
      const msg = parseReturnErrorMessage(err);
      this.submitError.set(msg);
      this.notificationService.error('Error al registrar cambio', msg);
    }
  }

  // =========================================================================
  // FLUJO DE PAGO STRIPE (PARA CAMBIOS CON MONTO A COBRAR)
  // =========================================================================

  async onStripePaid(paymentIntentId: string): Promise<void> {
    const returnId = this.pendingReturnId();
    if (!returnId) return;

    try {
      const res = await this.returnsService.confirmExchangePayment(returnId);
      this.notificationService.success(
        'Pago Confirmado',
        `El cobro de la diferencia para el cambio #${res.id} fue procesado correctamente.`
      );
      this.stripeClientSecret.set(null);
      this.pendingReturnId.set(null);
      this.limpiarBusqueda();
      this.recargarHistorial();
    } catch (err) {
      const msg = parseReturnErrorMessage(err);
      this.notificationService.error('Error en confirmación', msg);
    }
  }

  onStripeFailed(errorMsg: string): void {
    this.notificationService.error('Pago rechazado', errorMsg);
  }

  onStripeCancelled(): void {
    this.notificationService.warning(
      'Pago cancelado',
      'La operación quedó registrada con pago pendiente. Podés reintentarla desde el historial.'
    );
    this.stripeClientSecret.set(null);
    this.pendingReturnId.set(null);
    this.limpiarBusqueda();
    this.recargarHistorial();
  }

  // =========================================================================
  // HISTORIAL DE OPERACIONES
  // =========================================================================

  async recargarHistorial(): Promise<void> {
    this.loadingReturns.set(true);
    try {
      const list = await this.returnsService.listReturns();
      this.returnsList.set(list);
    } catch {
      this.notificationService.error('Error', 'No se pudo cargar el historial de devoluciones.');
    } finally {
      this.loadingReturns.set(false);
    }
  }

  filteredReturns = computed(() => {
    let list = this.returnsList();
    const typeF = this.historyTypeFilter();
    const statusF = this.historyStatusFilter();

    if (typeF !== 'all') {
      list = list.filter(r => r.type === typeF);
    }
    if (statusF !== 'all') {
      list = list.filter(r => r.status === statusF);
    }
    return list;
  });

  async reintentarReembolso(returnId: number): Promise<void> {
    if (!this.canManage()) return;
    this.processingActionId.set(returnId);

    try {
      const updated = await this.returnsService.processPendingRefund(returnId);
      if (updated.status === 'completed') {
        this.notificationService.success(
          'Reembolso Completado',
          `El reembolso de la operación #${returnId} fue procesado exitosamente.`
        );
      } else {
        this.notificationService.warning(
          'Reembolso en Proceso',
          `La operación #${returnId} sigue en estado ${this.getStatusLabel(updated.status)}.`
        );
      }
      await this.recargarHistorial();
    } catch (err) {
      const msg = parseReturnErrorMessage(err);
      this.notificationService.error('Error al reintentar', msg);
    } finally {
      this.processingActionId.set(null);
    }
  }

  async verDetalle(returnId: number): Promise<void> {
    try {
      const detail = await this.returnsService.getReturn(returnId);
      this.activeDetailModal.set(detail);
    } catch {
      this.notificationService.error('Error', 'No se pudo cargar el detalle de la operación.');
    }
  }

  // =========================================================================
  // HELPERS DE FORMATO Y ESTILO (Sin regex inline en templates)
  // =========================================================================

  formatCurrency(amount: number | string): string {
    const val = Number(amount) || 0;
    return `Bs. ${val.toFixed(2)}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed':
        return 'Completada';
      case 'payment_pending':
        return 'Pendiente';
      case 'payment_failed':
        return 'Fallida';
      default:
        return status;
    }
  }

  getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'payment_pending':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'payment_failed':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  }

  getStatusTextColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'text-emerald-700';
      case 'payment_pending':
        return 'text-amber-700';
      case 'payment_failed':
        return 'text-rose-700';
      default:
        return 'text-gray-700';
    }
  }
}
