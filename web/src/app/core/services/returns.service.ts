import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

export interface ReturnItemIn {
  sale_item_id: number;
  quantity: number;
}

export interface CreateReturnIn {
  sale_id: number;
  items: ReturnItemIn[];
}

export interface CreateExchangeIn {
  sale_id: number;
  sale_item_id: number;
  quantity: number;
  replacement_product_id: number;
  replacement_quantity?: number;
}

export interface ReturnableItemOut {
  sale_item_id: number;
  product_id: number;
  product_name: string;
  sold_quantity: number;
  returned_quantity: number;
  returnable_quantity: number;
  unit_price: number | string;
}

export interface ReturnOut {
  id: number;
  sale_id: number;
  type: string; // 'devolucion' | 'cambio'
  status: string; // 'completed' | 'payment_pending' | 'payment_failed'
  refund_amount: number | string;
  amount_due: number | string;
  payment_method: string | null;
  payment_intent_id: string | null;
  client_secret?: string | null;
  stripe_refund_id: string | null;
  created_at: string;
}

export interface ReturnDetailItem {
  sale_item_id: number;
  quantity: number;
  unit_price: string;
}

export interface ReturnDetailReplacement {
  product_id: number;
  quantity: number;
  unit_price: string;
}

export interface ReturnDetailOut extends ReturnOut {
  items: ReturnDetailItem[];
  replacements: ReturnDetailReplacement[];
}

export interface ProductSearchResult {
  idProducto: number;
  nombre: string;
  venta: number;
  talla?: string | null;
  color?: string | null;
  tipo?: string | null;
}

interface PaginatedProductsResponse {
  items: Array<{
    idProducto: number;
    nombre: string;
    venta: number;
    talla?: string | null;
    color?: string | null;
    tipo?: string | null;
  }>;
}

export function parseReturnErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const detail = err.error?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (detail && typeof detail === 'object') {
      const code = (detail as { code?: string; returnable_quantity?: number; message?: string }).code;
      switch (code) {
        case 'sale_not_found':
          return 'No se encontró la venta con el ID especificado.';
        case 'return_window_expired':
          return 'El período de devolución expiró (máximo 30 días desde la fecha de venta).';
        case 'unsupported_sale_payment_method':
          return 'El método de pago de la venta original no admite devoluciones automatizadas (ej. pago QR).';
        case 'sale_payment_method_not_found':
          return 'No se encontró el método de pago de la venta original.';
        case 'sale_item_not_found':
          return 'El ítem de la venta no fue encontrado.';
        case 'return_quantity_exceeded':
          return `La cantidad a devolver excede el límite devolvible (${detail.returnable_quantity ?? 0} restante).`;
        case 'refund_amount_invalid':
          return 'El monto de reembolso no es válido.';
        case 'sale_inventory_location_unavailable':
          return 'No se encontró la ubicación de inventario de la sucursal de origen.';
        case 'replacement_product_or_stock_not_found':
          return 'El producto de reemplazo o su stock en la sucursal no fue encontrado.';
        case 'replacement_stock_insufficient':
          return 'No hay stock suficiente en la sucursal para el producto de reemplazo seleccionado.';
        case 'replacement_reservation_missing':
          return 'No se encontró la reserva previa del producto de reemplazo.';
        case 'stripe_not_configured':
          return 'La pasarela de pagos Stripe no está configurada.';
        case 'stripe_refund_failed':
          return 'Error al procesar el reembolso en Stripe.';
        case 'stripe_payment_intent_failed':
          return 'Error al crear la orden de cobro en Stripe.';
        case 'exchange_payment_not_pending':
          return 'Este cambio no tiene un pago pendiente por confirmar.';
        case 'exchange_not_pending':
          return 'Este cambio ya no se encuentra en estado pendiente.';
        case 'exchange_payment_not_confirmed':
          return 'El pago del cambio aún no fue confirmado por Stripe.';
        case 'refund_not_pending':
          return 'Esta operación no tiene reembolsos pendientes de procesar.';
        case 'return_not_found':
          return 'No se encontró el registro de la devolución o cambio.';
        default:
          return (detail as { message?: string }).message || code || 'Error al procesar la solicitud.';
      }
    }
    if (err.status === 403) {
      return 'No tenés los permisos requeridos para esta operación.';
    }
    if (err.status === 404) {
      return 'Recurso no encontrado en el servidor.';
    }
  }
  return 'Ocurrió un error inesperado al procesar la operación.';
}

@Injectable({
  providedIn: 'root'
})
export class ReturnsService {
  constructor(private http: HttpClient) {}

  /**
   * Obtiene los ítems de una venta indicando cantidad vendida, devuelta y disponible para devolver.
   */
  async getReturnableItems(saleId: number): Promise<ReturnableItemOut[]> {
    return firstValueFrom(
      this.http.get<ReturnableItemOut[]>(`${API_URL}/api/returns/sales/${saleId}/returnable-items`)
    );
  }

  /**
   * Registra una devolución de uno o varios ítems de una venta.
   */
  async createReturn(payload: CreateReturnIn): Promise<ReturnOut> {
    return firstValueFrom(
      this.http.post<ReturnOut>(`${API_URL}/api/returns`, payload)
    );
  }

  /**
   * Registra un cambio de una prenda vendida por una prenda de reemplazo.
   */
  async createExchange(payload: CreateExchangeIn): Promise<ReturnOut> {
    return firstValueFrom(
      this.http.post<ReturnOut>(`${API_URL}/api/returns/exchanges`, payload)
    );
  }

  /**
   * Confirma el pago de la diferencia de un cambio realizado con tarjeta en Stripe.
   */
  async confirmExchangePayment(returnId: number): Promise<ReturnOut> {
    return firstValueFrom(
      this.http.post<ReturnOut>(`${API_URL}/api/returns/${returnId}/confirm-payment`, {})
    );
  }

  /**
   * Reintenta procesar un reembolso pendiente o fallido en Stripe.
   */
  async processPendingRefund(returnId: number): Promise<ReturnOut> {
    return firstValueFrom(
      this.http.post<ReturnOut>(`${API_URL}/api/returns/${returnId}/process`, {})
    );
  }

  /**
   * Lista todas las devoluciones y cambios del tenant actual.
   */
  async listReturns(): Promise<ReturnOut[]> {
    return firstValueFrom(
      this.http.get<ReturnOut[]>(`${API_URL}/api/returns`)
    );
  }

  /**
   * Obtiene el detalle completo de una devolución o cambio por su ID.
   */
  async getReturn(returnId: number): Promise<ReturnDetailOut> {
    return firstValueFrom(
      this.http.get<ReturnDetailOut>(`${API_URL}/api/returns/${returnId}`)
    );
  }

  /**
   * Busca productos del catálogo para utilizarlos como reemplazo en un cambio.
   */
  async searchProducts(query: string): Promise<ProductSearchResult[]> {
    const params: Record<string, string> = { size: '20' };
    if (query.trim()) {
      params['q'] = query.trim();
    }
    const res = await firstValueFrom(
      this.http.get<PaginatedProductsResponse>(`${API_URL}/api/products`, { params })
    );
    return res.items.map(p => ({
      idProducto: p.idProducto,
      nombre: p.nombre,
      venta: p.venta,
      talla: p.talla,
      color: p.color,
      tipo: p.tipo,
    }));
  }
}
