import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Venta } from '../../core/models';

/**
 * Comprobante de venta, puramente presentacional. Renderiza SOLO datos ya
 * confirmados por el servidor (`VentaOut` + `DetalleVenta[]`): nunca el
 * subtotal indicativo del ticket en memoria. `idVenta` funciona como el
 * número de comprobante (Requirement "Receipt Rendering from Server Data").
 */
@Component({
  selector: 'app-receipt-modal',
  standalone: true,
  imports: [CommonModule],
  styles: [':host { display: block; }'],
  template: `
    <div
      class="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      (click)="cerrar.emit()"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-md space-y-4 receipt-print"
        (click)="$event.stopPropagation()"
      >
        <div class="p-6 space-y-4">
          <div class="text-center border-b border-dashed border-[#E8E2DA] pb-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-[#38133E]">Voguely</p>
            <h3 class="text-base font-bold text-[#17141A] mt-1">Comprobante de Venta</h3>
            <p class="text-xs text-[#5A5561] mt-1">N.º de comprobante: {{ venta.comprobanteLocal || venta.idVenta }}</p>
            <p *ngIf="venta.origen === 'offline'" class="text-[10px] text-amber-600 font-bold uppercase tracking-wider mt-0.5">
              Comprobante provisional (fuera de línea)
            </p>
            <p class="text-xs text-[#5A5561]">{{ venta.fecha }}</p>
          </div>

          <div class="text-xs text-[#5A5561] space-y-1">
            <p><span class="font-semibold text-[#17141A]">Cliente:</span> {{ clienteNombre || ('Cliente #' + venta.idCliente) }}</p>
            <p><span class="font-semibold text-[#17141A]">Modalidad de pago:</span> {{ modalidad }}</p>
          </div>

          <table class="w-full text-xs">
            <thead>
              <tr class="text-left text-[10px] uppercase tracking-wider text-[#9B94A3] font-bold border-b border-[#E8E2DA]">
                <th class="py-1.5">Producto</th>
                <th class="py-1.5 text-center">Cant.</th>
                <th class="py-1.5 text-right">P. Unit.</th>
                <th class="py-1.5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let d of venta.detalles" class="border-b border-[#FAF8F5]">
                <td class="py-1.5 text-[#17141A]">
                  <div>{{ d.producto_nombre || ('Producto #' + d.idProducto) }}</div>
                  <div *ngIf="d.precio_lista && d.precio_lista > d.precio_unitario" class="text-[10px] text-emerald-700">
                    Promo aplicada (lista: Bs {{ d.precio_lista.toFixed(2) }})
                  </div>
                </td>
                <td class="py-1.5 text-center text-[#5A5561]">{{ d.cantidad }}</td>
                <td class="py-1.5 text-right text-[#5A5561]">Bs {{ d.precio_unitario.toFixed(2) }}</td>
                <td class="py-1.5 text-right font-medium text-[#17141A]">Bs {{ (d.precio_unitario * d.cantidad).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>

          <!-- Desglose de Totales y Descuentos (CU37 / CU43 / S9) -->
          <div class="border-t border-dashed border-[#E8E2DA] pt-2 space-y-1 text-xs">
            <div *ngIf="venta.subtotal != null" class="flex items-center justify-between text-[#5A5561]">
              <span>Subtotal</span>
              <span>Bs {{ venta.subtotal.toFixed(2) }}</span>
            </div>

            <div *ngIf="venta.descuento_promociones && venta.descuento_promociones > 0" class="flex items-center justify-between text-emerald-700 font-medium">
              <span>Ahorraste en promociones</span>
              <span>-Bs {{ venta.descuento_promociones.toFixed(2) }}</span>
            </div>

            <div *ngIf="venta.descuento_cupon && venta.descuento_cupon > 0" class="flex items-center justify-between text-emerald-700 font-medium">
              <span>Ahorraste con cupón</span>
              <span>-Bs {{ venta.descuento_cupon.toFixed(2) }}</span>
            </div>

            <div *ngIf="venta.descuento_puntos && venta.descuento_puntos > 0" class="flex items-center justify-between text-emerald-700 font-medium">
              <span>Ahorraste con puntos ({{ venta.puntos_canjeados }} pts)</span>
              <span>-Bs {{ venta.descuento_puntos.toFixed(2) }}</span>
            </div>

            <div class="border-t border-[#E8E2DA] pt-2 flex items-center justify-between">
              <span class="text-sm font-bold text-[#17141A] uppercase tracking-wide">Total</span>
              <span class="text-lg font-bold text-[#38133E]">Bs {{ venta.total.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Resumen de Puntos de Fidelización (CU43 / S9) -->
          <div *ngIf="(venta.puntos_ganados && venta.puntos_ganados > 0) || (venta.puntos_canjeados && venta.puntos_canjeados > 0)" class="bg-[#F5EBF7]/60 rounded-lg p-2.5 text-xs text-[#38133E] space-y-0.5 border border-[#E8E2DA]">
            <p *ngIf="venta.puntos_ganados && venta.puntos_ganados > 0" class="font-bold flex items-center justify-between">
              <span>Puntos ganados con esta compra:</span>
              <span>+{{ venta.puntos_ganados }} pts</span>
            </p>
            <p *ngIf="venta.puntos_canjeados && venta.puntos_canjeados > 0" class="text-[11px] flex items-center justify-between text-[#5A5561]">
              <span>Puntos canjeados:</span>
              <span>-{{ venta.puntos_canjeados }} pts</span>
            </p>
          </div>
        </div>

        <div class="p-4 pt-0 flex items-center justify-end gap-2 print:hidden">
          <button
            (click)="cerrar.emit()"
            class="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide text-[#5A5561] border border-[#E8E2DA] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
          >
            Nueva venta
          </button>
          <button
            (click)="imprimir()"
            class="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide text-white bg-[#38133E] hover:bg-[#260B2B] transition-colors cursor-pointer"
          >
            Imprimir
          </button>
        </div>
      </div>
    </div>
  `
})
export class ReceiptModalComponent {
  @Input({ required: true }) venta!: Venta;
  @Input() clienteNombre: string | null = null;
  @Input() modalidad = '';
  @Output() cerrar = new EventEmitter<void>();

  imprimir(): void {
    window.print();
  }
}
