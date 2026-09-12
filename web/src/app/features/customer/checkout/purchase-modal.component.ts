import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ProductOut, Venta } from '../../../core/models';
import { PaymentsService } from '../../../core/services/payments.service';
import { SalesService } from '../../../core/services/sales.service';
import { CardPaymentComponent } from '../../../shared/components/card-payment.component';
import { ReceiptModalComponent } from '../../../shared/components/receipt-modal.component';

type EstadoCompra = 'iniciando' | 'cobrando' | 'cobrado_sin_venta' | 'comprado' | 'error';

/**
 * Checkout de compra digital (CU17/CU18): un solo producto, pago SOLO con
 * tarjeta via Stripe (Requirement "Card-Only Modality"). Replica la maquina
 * de estados de `pos.component.ts` — el pago SIEMPRE se obtiene antes de
 * `POST /api/sales`, y si la venta falla despues de un cobro verificado, el
 * `idMetPago` se retiene para reintentar sin cobrar dos veces (Requirement
 * "Charge Preserved on Sale Failure"). Nunca envia `idCliente` ni
 * `codigoSucursal`: el backend los deriva/resuelve (D2/D4 en design.md).
 */
@Component({
  selector: 'app-purchase-modal',
  standalone: true,
  imports: [CommonModule, CardPaymentComponent, ReceiptModalComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        *ngIf="estado() !== 'comprado'"
        class="bg-white max-w-md w-full rounded-2xl border border-gray-200 shadow-xl overflow-hidden flex flex-col"
      >
        <div class="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Comprar ahora</span>
            <h2 class="text-base font-bold text-gray-900 mt-0.5 leading-snug">{{ producto.nombre }}</h2>
            <p class="text-xs text-gray-500 mt-0.5">Cantidad: {{ cantidad }}</p>
          </div>
          <button
            *ngIf="estado() !== 'cobrado_sin_venta'"
            (click)="cerrar.emit()"
            class="w-8 h-8 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center hover:bg-gray-900 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="p-5 space-y-4">
          <!-- Preparando el cobro (crearIntent en curso) -->
          <div *ngIf="estado() === 'iniciando' && !errorMensaje()" class="py-8 text-center">
            <p class="text-sm text-gray-400">Preparando el cobro…</p>
          </div>

          <!-- crearIntent fallo: sin stock o Stripe no disponible; el servicio ya notifico el motivo -->
          <div *ngIf="errorMensaje()" class="space-y-3">
            <p class="text-sm font-bold text-rose-700">{{ errorMensaje() }}</p>
            <button
              (click)="cerrar.emit()"
              class="w-full px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          <!-- Widget de tarjeta (unica modalidad — Requirement "Card-Only Modality") -->
          <div *ngIf="estado() === 'cobrando' && clientSecret()">
            <app-card-payment
              [clientSecret]="clientSecret()"
              [concepto]="'Compra: ' + producto.nombre"
              (pagado)="onCardPagado($event)"
              (fallo)="onCardFallo($event)"
              (cancelado)="onCardCancelado()"
            ></app-card-payment>
          </div>

          <!-- Cobrado pero venta fallida: retener idMetPago, nunca cobrar dos veces -->
          <div *ngIf="estado() === 'cobrado_sin_venta'" class="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p class="text-sm font-bold text-amber-800">El pago ya fue registrado, pero la compra no se pudo confirmar.</p>
            <p class="text-xs text-amber-700">
              Podés reintentar sin que se te cobre de nuevo. Si el problema persiste, contactá a soporte
              (el pago #{{ idMetPagoActual() }} queda retenido para conciliación).
            </p>
            <button
              (click)="onReintentarVenta()"
              [disabled]="enviando()"
              class="w-full px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {{ enviando() ? 'Reintentando…' : 'Reintentar compra' }}
            </button>
          </div>
        </div>
      </div>

      <app-receipt-modal
        *ngIf="estado() === 'comprado' && ventaCreada() as v"
        [venta]="v"
        modalidad="Tarjeta"
        (cerrar)="onCerrarRecibo()"
      ></app-receipt-modal>
    </div>
  `
})
export class PurchaseModalComponent implements OnInit {
  @Input({ required: true }) producto!: ProductOut;
  @Input({ required: true }) cantidad = 1;
  @Output() cerrar = new EventEmitter<void>();
  @Output() completada = new EventEmitter<Venta>();

  estado = signal<EstadoCompra>('iniciando');
  clientSecret = signal<string | null>(null);
  idMetPagoActual = signal<number | null>(null);
  ventaCreada = signal<Venta | null>(null);
  enviando = signal(false);
  errorMensaje = signal<string | null>(null);

  constructor(
    private paymentsService: PaymentsService,
    private salesService: SalesService,
  ) {}

  ngOnInit(): void {
    this.iniciarCobro();
  }

  // POST /api/payments/intents: el servidor valida stock ANTES de crear el
  // intento (Requirement "Stock Verified Before Any Charge") — si no hay
  // stock en ninguna sucursal, devuelve 400 y esta llamada nunca cobra nada.
  private async iniciarCobro(): Promise<void> {
    this.enviando.set(true);
    const intent = await this.paymentsService.crearIntent({
      items: [{ idProducto: this.producto.idProducto, cantidad: this.cantidad }],
      claveIntento: crypto.randomUUID(),
      concepto: `Compra en línea — ${this.producto.nombre}`,
    });
    this.enviando.set(false);
    if (!intent) {
      // El servicio ya notifico el motivo real (sin stock, Stripe no
      // configurado, etc.) via NotificationService.
      this.errorMensaje.set('No se pudo iniciar la compra. Cerrá esta ventana e intentá de nuevo.');
      return;
    }
    this.clientSecret.set(intent.clientSecret);
    this.estado.set('cobrando');
  }

  async onCardPagado(paymentIntentId: string): Promise<void> {
    this.enviando.set(true);
    const verificado = await this.paymentsService.verificarIntent(paymentIntentId);
    this.enviando.set(false);
    if (!verificado || !verificado.pagado || verificado.idMetPago === undefined) {
      // El widget reporto exito del lado del cliente, pero el servidor aun
      // no confirma el cobro: NUNCA se llama a POST /api/sales en este caso
      // (Requirement "Server-Verified Payment as Sole Success Signal").
      return;
    }
    this.idMetPagoActual.set(verificado.idMetPago);
    this.clientSecret.set(null);
    await this.intentarVenta();
  }

  onCardFallo(_mensaje: string): void {
    // El widget (card-payment.component.ts) ya notifico el rechazo. El
    // clientSecret sigue montado: el usuario puede reintentar el pago sin
    // crear un intento nuevo.
  }

  onCardCancelado(): void {
    this.cerrar.emit();
  }

  /**
   * Unico punto que llama a POST /api/sales — nunca crea ni cobra un
   * idMetPago (mismo patron que `pos.component.ts::intentarVenta`).
   * idCliente y codigoSucursal se omiten a proposito: el backend los
   * deriva/resuelve para esta compra de cliente (D2/D4).
   */
  private async intentarVenta(): Promise<void> {
    const idMetPago = this.idMetPagoActual();
    if (idMetPago === null) {
      return;
    }
    this.enviando.set(true);
    const venta = await this.salesService.crearVenta({
      idMetPago,
      items: [{ idProducto: this.producto.idProducto, cantidad: this.cantidad }],
    });
    this.enviando.set(false);

    if (venta) {
      this.ventaCreada.set(venta);
      this.estado.set('comprado');
      this.completada.emit(venta);
    } else {
      // El idMetPago YA fue cobrado (tarjeta verificada): se retiene para
      // reintentar, nunca se cobra de nuevo (Requirement "Charge Preserved
      // on Sale Failure").
      this.estado.set('cobrado_sin_venta');
    }
  }

  async onReintentarVenta(): Promise<void> {
    await this.intentarVenta();
  }

  onCerrarRecibo(): void {
    this.cerrar.emit();
  }
}
