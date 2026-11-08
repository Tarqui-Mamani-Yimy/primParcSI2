import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CartLine, LoyaltyAccountQuote, QuoteResponse, Venta } from '../../../core/models';
import { PaymentsService } from '../../../core/services/payments.service';
import { SalesService } from '../../../core/services/sales.service';
import { SyncService } from '../../../core/services/sync.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PromotionsService } from '../../../core/services/promotions.service';
import { AuthService } from '../../../core/services/auth.service';
import { CardPaymentComponent } from '../../../shared/components/card-payment.component';
import { ReceiptModalComponent } from '../../../shared/components/receipt-modal.component';

type EstadoCompra = 'resumen' | 'iniciando' | 'cobrando' | 'cobrado_sin_venta' | 'comprado' | 'error';

/**
 * Checkout de compra digital (CU17/CU18, generalizado por CU16 a una o mas
 * lineas): pago SOLO con tarjeta via Stripe (Requirement "Card-Only
 * Modality"). Replica la maquina de estados de `pos.component.ts` — el pago
 * SIEMPRE se obtiene antes de `POST /api/sales`, y si la venta falla despues
 * de un cobro verificado, el `idMetPago` se retiene para reintentar sin
 * cobrar dos veces (Requirement "Charge Preserved on Sale Failure"). Nunca
 * envia `idCliente` ni `codigoSucursal`: el backend los deriva/resuelve
 * (D2/D4 en design.md).
 *
 * `lineas` es una FOTO congelada tomada por el host cuando arranca el
 * checkout (CU16 D3): este componente nunca lee `CartService` en vivo, asi
 * que vaciar o editar el carrito despues de abrir el modal no puede mutar
 * un cobro en curso ni vaciar el encabezado del comprobante. "Comprar
 * ahora" pasa exactamente el mismo tipo de dato — un arreglo de una sola
 * linea — por este mismo camino (Requirement "Buy-Now Remains Independent
 * of the Cart").
 */
@Component({
  selector: 'app-purchase-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CardPaymentComponent, ReceiptModalComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        *ngIf="estado() !== 'comprado'"
        class="bg-white max-w-md w-full rounded-2xl border border-[#E8E2DA] shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div class="p-5 border-b border-[#E8E2DA] flex items-start justify-between shrink-0">
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#16A34A]">Comprar ahora</span>
            <h2 class="text-base font-bold text-[#17141A] mt-0.5 leading-snug">{{ tituloCompra() }}</h2>
            <p class="text-xs text-[#5A5561] mt-0.5">{{ subtituloCantidad() }}</p>
          </div>
          <button
            *ngIf="estado() !== 'cobrado_sin_venta'"
            (click)="cerrar.emit()"
            class="w-8 h-8 rounded-full bg-[#FAF8F5] text-[#5A5561] flex items-center justify-center hover:bg-[#260B2B] hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div class="p-5 space-y-4 overflow-y-auto flex-1">

          <!-- ESTADO RESUMEN / COTIZACIÓN (CU37 / CU43 / S9) -->
          <div *ngIf="estado() === 'resumen'" class="space-y-4 text-xs">
            <!-- Lista de productos -->
            <div class="space-y-2 border border-[#E8E2DA] rounded-xl p-3 bg-[#FAF8F5]/60 max-h-40 overflow-y-auto">
              <div *ngFor="let l of lineas" class="flex items-center justify-between gap-2">
                <div class="truncate">
                  <p class="font-bold text-[#17141A] truncate">{{ l.producto.nombre }}</p>
                  <p class="text-[11px] text-[#5A5561]">Cant: {{ l.cantidad }} · Bs {{ l.producto.venta.toFixed(2) }} c/u</p>
                </div>
                <span class="font-semibold text-[#17141A] shrink-0">
                  Bs {{ (l.producto.venta * l.cantidad).toFixed(2) }}
                </span>
              </div>
            </div>

            <!-- Entrada de Cupón de Descuento (CU37, S9, gated por promociones) -->
            <div *ngIf="canPromotions" class="space-y-1.5 p-3 rounded-xl border border-[#E8E2DA] bg-white">
              <label class="block text-[10px] font-bold uppercase tracking-wider text-[#5A5561]">
                Cupón de descuento
              </label>
              <div class="flex gap-2">
                <input
                  type="text"
                  [(ngModel)]="codigoCuponInput"
                  (ngModelChange)="onCodigoChange($event)"
                  placeholder="EJ. VERANO10"
                  class="flex-1 px-3 py-1.5 border border-[#E8E2DA] rounded-lg text-xs font-mono font-bold uppercase focus:outline-none focus:border-[#38133E]"
                />
                <button
                  type="button"
                  (click)="aplicarCupon()"
                  [disabled]="cotizando() || !codigoCuponInput.trim()"
                  class="px-3 py-1.5 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-40"
                >
                  {{ cotizando() ? '…' : 'Aplicar' }}
                </button>
              </div>
            </div>

            <!-- Canje de Puntos de Fidelización (CU43, S9, gated por fidelizacion) -->
            <div *ngIf="canLoyalty && cuentaPuntos() as cuenta" class="space-y-2 p-3 rounded-xl border border-[#E8E2DA] bg-white">
              <div class="flex items-center justify-between">
                <label class="text-[10px] font-bold uppercase tracking-wider text-[#5A5561]">
                  Puntos de fidelización
                </label>
                <span class="text-[10px] font-bold text-[#38133E]">
                  Saldo: {{ cuenta.saldo }} pts (Nivel {{ cuenta.nivel }})
                </span>
              </div>

              <div *ngIf="cuenta.puntos_max_canjeables > 0" class="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  [max]="cuenta.puntos_max_canjeables"
                  [(ngModel)]="puntosInput"
                  (ngModelChange)="onPuntosChange($event)"
                  placeholder="Puntos a canjear"
                  class="flex-1 px-3 py-1.5 border border-[#E8E2DA] rounded-lg text-xs focus:outline-none focus:border-[#38133E]"
                />
                <button
                  type="button"
                  (click)="canjearMaximosPuntos()"
                  class="px-2.5 py-1.5 border border-[#38133E] text-[#38133E] hover:bg-[#F5EBF7] rounded-lg text-[11px] font-bold uppercase transition-colors cursor-pointer"
                >
                  Máx ({{ cuenta.puntos_max_canjeables }})
                </button>
              </div>

              <p class="text-[10px] text-[#5A5561]">
                1 pt = Bs 0.10 de descuento (hasta el 50% del total).
              </p>
            </div>

            <!-- Avisos del servidor sobre cupón o puntos -->
            <div *ngIf="avisos().length > 0" class="space-y-1">
              <div *ngFor="let a of avisos()" class="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px] text-amber-700">info</span>
                <span>{{ a }}</span>
              </div>
            </div>

            <!-- Desglose de Precios (Autoritativo del servidor vía S4 / quote) -->
            <div *ngIf="quoteResult() as q" class="border-t border-dashed border-[#E8E2DA] pt-3 space-y-1.5">
              <div class="flex items-center justify-between text-[#5A5561]">
                <span>Subtotal</span>
                <span>Bs {{ q.subtotal.toFixed(2) }}</span>
              </div>

              <div *ngIf="q.descuento_promociones > 0" class="flex items-center justify-between text-emerald-700 font-medium">
                <span>Promociones aplicadas</span>
                <span>-Bs {{ q.descuento_promociones.toFixed(2) }}</span>
              </div>

              <div *ngIf="q.descuento_cupon > 0" class="flex items-center justify-between text-emerald-700 font-medium">
                <span>Cupón aplicado</span>
                <span>-Bs {{ q.descuento_cupon.toFixed(2) }}</span>
              </div>

              <div *ngIf="q.descuento_puntos > 0" class="flex items-center justify-between text-emerald-700 font-medium">
                <span>Puntos canjeados ({{ q.puntos_canjeados }} pts)</span>
                <span>-Bs {{ q.descuento_puntos.toFixed(2) }}</span>
              </div>

              <div class="pt-2 border-t border-[#E8E2DA] flex items-center justify-between">
                <span class="text-sm font-bold text-[#17141A] uppercase">Total a pagar</span>
                <span class="text-lg font-bold text-[#38133E]">Bs {{ q.total.toFixed(2) }}</span>
              </div>

              <div *ngIf="canLoyalty && q.puntos_a_ganar > 0" class="pt-1 flex items-center justify-between text-[11px] text-[#38133E] font-semibold">
                <span>Puntos a ganar con esta compra:</span>
                <span>+{{ q.puntos_a_ganar }} pts</span>
              </div>
            </div>

            <!-- Botón para avanzar al pago con tarjeta -->
            <button
              type="button"
              (click)="iniciarCobro()"
              [disabled]="enviando() || cotizando()"
              class="w-full py-2.5 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs cursor-pointer disabled:opacity-50 mt-2"
            >
              {{ enviando() ? 'Preparando tarjeta…' : ('Pagar con tarjeta · Bs ' + totalAPagar().toFixed(2)) }}
            </button>
          </div>

          <!-- Preparando el cobro (crearIntent en curso) -->
          <div *ngIf="estado() === 'iniciando' && !errorMensaje()" class="py-8 text-center">
            <p class="text-sm text-[#9B94A3]">Preparando el cobro con Stripe…</p>
          </div>

          <!-- crearIntent fallo: sin stock o Stripe no disponible; el servicio ya notifico el motivo -->
          <div *ngIf="errorMensaje()" class="space-y-3">
            <p class="text-sm font-bold text-rose-700">{{ errorMensaje() }}</p>
            <button
              (click)="estado.set('resumen'); errorMensaje.set(null)"
              class="w-full px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide text-[#5A5561] border border-[#E8E2DA] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
            >
              Volver al resumen
            </button>
          </div>

          <!-- Widget de tarjeta (unica modalidad — Requirement "Card-Only Modality") -->
          <div *ngIf="estado() === 'cobrando' && clientSecret()" class="space-y-3">
            <app-card-payment
              [clientSecret]="clientSecret()"
              [concepto]="'Compra: ' + tituloCompra()"
              (pagado)="onCardPagado($event)"
              (fallo)="onCardFallo($event)"
              (cancelado)="onCardCancelado()"
            ></app-card-payment>

            <button
              type="button"
              (click)="estado.set('resumen')"
              class="w-full py-1 text-center text-[11px] text-[#5A5561] hover:underline cursor-pointer"
            >
              ← Modificar cupón o puntos
            </button>
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
              [disabled]="enviando() || !syncService.isOnline()"
              [title]="!syncService.isOnline() ? 'Operación no disponible sin conexión a internet' : ''"
              class="w-full px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide text-white bg-[#38133E] hover:bg-[#260B2B] transition-colors cursor-pointer disabled:opacity-50"
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
  @Input({ required: true }) lineas!: CartLine[];
  @Output() cerrar = new EventEmitter<void>();
  @Output() completada = new EventEmitter<Venta>();

  estado = signal<EstadoCompra>('resumen');
  clientSecret = signal<string | null>(null);
  idMetPagoActual = signal<number | null>(null);
  ventaCreada = signal<Venta | null>(null);
  enviando = signal(false);
  errorMensaje = signal<string | null>(null);

  codigoCuponInput = '';
  codigoCupon = signal<string>('');
  puntosInput: number | null = null;
  puntosACanjear = signal<number>(0);
  quoteResult = signal<QuoteResponse | null>(null);
  cotizando = signal<boolean>(false);
  cuentaPuntos = signal<LoyaltyAccountQuote | null>(null);
  avisos = signal<string[]>([]);

  constructor(
    private paymentsService: PaymentsService,
    private salesService: SalesService,
    private promotionsService: PromotionsService,
    private notificationService: NotificationService,
    public syncService: SyncService,
    public authService: AuthService,
  ) {}

  get canPromotions(): boolean {
    return this.authService.hasFeature('promociones');
  }

  get canLoyalty(): boolean {
    return this.authService.hasFeature('fidelizacion');
  }

  ngOnInit(): void {
    void this.actualizarCotizacion();
  }

  onCodigoChange(val: string): void {
    this.codigoCuponInput = val.toUpperCase().trim();
  }

  aplicarCupon(): void {
    if (!this.canPromotions) return;
    this.codigoCupon.set(this.codigoCuponInput.toUpperCase().trim());
    void this.actualizarCotizacion();
  }

  onPuntosChange(val: number): void {
    if (!this.canLoyalty) return;
    this.puntosACanjear.set(Math.max(0, Number(val) || 0));
    void this.actualizarCotizacion();
  }

  canjearMaximosPuntos(): void {
    if (!this.canLoyalty) return;
    const max = this.cuentaPuntos()?.puntos_max_canjeables ?? 0;
    this.puntosInput = max;
    this.puntosACanjear.set(max);
    void this.actualizarCotizacion();
  }

  totalAPagar(): number {
    return this.quoteResult()?.total ?? this.lineas.reduce((acc, l) => acc + l.producto.venta * l.cantidad, 0);
  }

  async actualizarCotizacion(): Promise<void> {
    if (!this.syncService.isOnline()) {
      this.errorMensaje.set('Operación no disponible sin conexión a internet.');
      return;
    }
    this.cotizando.set(true);
    try {
      const res = await this.promotionsService.quote({
        items: this.itemsDeLineas(),
        codigoCupon: (this.canPromotions && this.codigoCupon()) ? this.codigoCupon() : undefined,
        puntos: (this.canLoyalty && this.puntosACanjear() > 0) ? this.puntosACanjear() : undefined,
      });
      this.quoteResult.set(res);
      this.avisos.set(res.avisos || []);
      if (res.cuenta) {
        this.cuentaPuntos.set(res.cuenta);
      }
    } catch (err: any) {
      console.warn('Error al cotizar compra:', err);
      const msg = err.error?.detail || 'No se pudo cotizar la compra.';
      this.avisos.set([msg]);
    } finally {
      this.cotizando.set(false);
    }
  }

  // Una sola linea conserva la redaccion original ("Comprar ahora" y
  // buy-now, Requirement "Buy-Now Remains Independent of the Cart"); dos o
  // mas resumen el carrito.
  private get esUnaLinea(): boolean {
    return this.lineas.length === 1;
  }

  tituloCompra(): string {
    return this.esUnaLinea ? this.lineas[0].producto.nombre : `${this.lineas.length} productos`;
  }

  subtituloCantidad(): string {
    return this.esUnaLinea
      ? `Cantidad: ${this.lineas[0].cantidad}`
      : `Total de unidades: ${this.cantidadTotal()}`;
  }

  private cantidadTotal(): number {
    return this.lineas.reduce((total, linea) => total + linea.cantidad, 0);
  }

  private itemsDeLineas(): { idProducto: number; cantidad: number }[] {
    return this.lineas.map(linea => ({ idProducto: linea.producto.idProducto, cantidad: linea.cantidad }));
  }

  // POST /api/payments/intents: el servidor valida stock ANTES de crear el
  // intento (Requirement "Stock Verified Before Any Charge") — si no hay
  // stock en ninguna sucursal, devuelve 400 y esta llamada nunca cobra nada.
  async iniciarCobro(): Promise<void> {
    if (!this.syncService.isOnline()) {
      this.errorMensaje.set('Operación no disponible sin conexión a internet.');
      return;
    }
    this.enviando.set(true);
    this.errorMensaje.set(null);
    const intent = await this.paymentsService.crearIntent({
      items: this.itemsDeLineas(),
      claveIntento: crypto.randomUUID(),
      concepto: `Compra en línea — ${this.tituloCompra()}`,
      codigoCupon: (this.canPromotions && this.codigoCupon()) ? this.codigoCupon() : undefined,
      puntos: (this.canLoyalty && this.puntosACanjear() > 0) ? this.puntosACanjear() : undefined,
    });
    this.enviando.set(false);
    if (!intent) {
      // El servicio ya notifico el motivo real (sin stock, Stripe no
      // configurado, etc.) via NotificationService.
      this.errorMensaje.set('No se pudo iniciar la compra. Verificá los datos e intentá de nuevo.');
      this.estado.set('resumen');
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

  onCardFallo(mensaje: string): void {
    // El widget (card-payment.component.ts) solo emite el evento, nunca
    // muestra nada por si solo. El clientSecret sigue montado: el usuario
    // puede reintentar el pago sin crear un intento nuevo.
    this.notificationService.error('Pago rechazado', mensaje);
  }

  onCardCancelado(): void {
    this.clientSecret.set(null);
    this.estado.set('resumen');
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
      items: this.itemsDeLineas(),
      codigoCupon: (this.canPromotions && this.codigoCupon()) ? this.codigoCupon() : undefined,
      puntos: (this.canLoyalty && this.puntosACanjear() > 0) ? this.puntosACanjear() : undefined,
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
