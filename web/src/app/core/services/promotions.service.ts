import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Cupon,
  CuponIn,
  LoyaltyCustomerResponse,
  LoyaltyMeResponse,
  ProductOut,
  Promocion,
  PromocionIn,
  QuoteLineOut,
  QuoteRequest,
  QuoteResponse,
} from '../models';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;
const STORAGE_KEY_ACTIVE_PROMOTIONS = 'voguely_cached_active_promotions';

function roundHalfUpToCents(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function roundUpToCents(val: number): number {
  const cents = Math.ceil(val * 100 - 1e-9);
  return Math.max(0, cents / 100);
}

function promoMatches(promo: Promocion, idProducto: number): boolean {
  if (promo.productos === null) {
    return true;
  }
  if (Array.isArray(promo.productos)) {
    return promo.productos.includes(idProducto);
  }
  return promo.alcance === 'todos';
}

function calcPromotionDiscount(promo: Promocion, price: number, quantity: number): number {
  let amount = 0;
  if (promo.tipo === 'porcentaje' && promo.valor != null) {
    amount = (price * quantity * Number(promo.valor)) / 100;
  } else if (promo.tipo === 'monto_fijo' && promo.valor != null) {
    const fixedVal = roundHalfUpToCents(Number(promo.valor));
    amount = Math.min(price, fixedVal) * quantity;
  } else if (promo.tipo === 'nxm' && promo.n && promo.m && promo.n > promo.m) {
    const freeUnits = Math.floor(quantity / promo.n) * (promo.n - promo.m);
    amount = price * freeUnits;
  }
  const quantized = roundHalfUpToCents(amount);
  return Math.min(price * quantity, quantized);
}

@Injectable({
  providedIn: 'root'
})
export class PromotionsService {
  activePromotions = signal<Promocion[]>([]);

  constructor(private http: HttpClient) {
    this.restoreCachedPromotions();
  }

  // ─────────────────────────────────────────────
  // PROMOCIONES (CU37, S6 / S7)
  // ─────────────────────────────────────────────

  getPromotions(): Promise<Promocion[]> {
    return firstValueFrom(this.http.get<Promocion[]>(`${API_URL}/api/promotions`));
  }

  createPromotion(promo: PromocionIn): Promise<Promocion> {
    return firstValueFrom(this.http.post<Promocion>(`${API_URL}/api/promotions`, promo));
  }

  updatePromotion(id: number, promo: Partial<PromocionIn>): Promise<Promocion> {
    return firstValueFrom(this.http.put<Promocion>(`${API_URL}/api/promotions/${id}`, promo));
  }

  deletePromotion(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_URL}/api/promotions/${id}`));
  }

  async getActivePromotions(): Promise<Promocion[]> {
    try {
      const list = await firstValueFrom(this.http.get<Promocion[]>(`${API_URL}/api/promotions/active`));
      this.activePromotions.set(list);
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_PROMOTIONS, JSON.stringify(list));
      } catch {}
      return list;
    } catch (err) {
      this.restoreCachedPromotions();
      return this.activePromotions();
    }
  }

  private restoreCachedPromotions(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_PROMOTIONS);
      if (raw) {
        const parsed = JSON.parse(raw) as Promocion[];
        this.activePromotions.set(parsed);
      }
    } catch {}
  }

  // ─────────────────────────────────────────────
  // CUPONES (CU37, S6 / S7)
  // ─────────────────────────────────────────────

  getCoupons(): Promise<Cupon[]> {
    return firstValueFrom(this.http.get<Cupon[]>(`${API_URL}/api/coupons`));
  }

  createCoupon(cupon: CuponIn): Promise<Cupon> {
    return firstValueFrom(this.http.post<Cupon>(`${API_URL}/api/coupons`, cupon));
  }

  updateCoupon(id: number, cupon: Partial<CuponIn>): Promise<Cupon> {
    return firstValueFrom(this.http.put<Cupon>(`${API_URL}/api/coupons/${id}`, cupon));
  }

  deleteCoupon(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_URL}/api/coupons/${id}`));
  }

  // ─────────────────────────────────────────────
  // COTIZACIÓN AUTORITATIVA (S4 / S7)
  // ─────────────────────────────────────────────

  /**
   * Cotiza en el servidor vía POST /api/sales/quote (S4, S7).
   * La web NUNCA calcula el total por su cuenta cuando está online.
   */
  quote(request: QuoteRequest): Promise<QuoteResponse> {
    return firstValueFrom(this.http.post<QuoteResponse>(`${API_URL}/api/sales/quote`, request));
  }

  /**
   * Cotización local offline (S3.1, S4, S9, B1).
   * Replica EXACTAMENTE el algoritmo de backend/app/services/pricing.py:
   * - Mismo orden y misma regla de mejor promoción por línea (nxm, porcentaje, monto fijo).
   * - Alcance resuelto vía promo.productos (null = 'todos').
   * - Redondeo unitario hacia arriba (_price_lines con ROUND_UP en centavos).
   * Cupones y puntos quedan deshabilitados offline.
   */
  quoteOffline(
    items: Array<{ idProducto: number; cantidad: number }>,
    getProductFn: (idProducto: number) => ProductOut | undefined
  ): QuoteResponse {
    const now = new Date();
    const validPromos = this.activePromotions().filter(p => {
      if (!p.activa) return false;
      const ini = new Date(p.fecha_inicio);
      const fin = new Date(p.fecha_fin);
      return ini <= now && now <= fin;
    });

    const quantities: number[] = [];
    const lines: QuoteLineOut[] = [];
    const lineAmounts: number[] = [];
    let subtotal = 0;

    for (const item of items) {
      const prod = getProductFn(item.idProducto);
      const price = roundHalfUpToCents(prod ? prod.venta : 0);
      const quantity = item.cantidad;
      const amount = roundHalfUpToCents(price * quantity);
      subtotal = roundHalfUpToCents(subtotal + amount);

      let bestDiscount = 0;
      let chosenPromo: Promocion | null = null;

      if (prod) {
        for (const promo of validPromos) {
          if (promoMatches(promo, item.idProducto)) {
            const discount = calcPromotionDiscount(promo, price, quantity);
            if (chosenPromo === null && discount > 0) {
              bestDiscount = discount;
              chosenPromo = promo;
            } else if (chosenPromo !== null) {
              if (discount > bestDiscount) {
                bestDiscount = discount;
                chosenPromo = promo;
              } else if (discount === bestDiscount && promo.idPromocion < chosenPromo.idPromocion) {
                chosenPromo = promo;
              }
            }
          }
        }
      }

      quantities.push(quantity);
      lineAmounts.push(roundHalfUpToCents(amount - bestDiscount));
      lines.push({
        idProducto: item.idProducto,
        cantidad: quantity,
        precio_lista: price,
        idPromocion: chosenPromo ? chosenPromo.idPromocion : null,
        descuento_promocion: bestDiscount,
        precio_unitario: price,
      });
    }

    const promoUnitPrices = lineAmounts.map((amount, idx) => {
      const q = quantities[idx];
      return q > 0 ? roundUpToCents(amount / q) : 0;
    });
    const afterPromotionAmounts = promoUnitPrices.map((unitPrice, idx) => roundHalfUpToCents(unitPrice * quantities[idx]));
    const afterPromotions = roundHalfUpToCents(afterPromotionAmounts.reduce((acc, a) => acc + a, 0));
    const total = afterPromotions;
    const descuento_promociones = roundHalfUpToCents(subtotal - total);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      line.precio_unitario = promoUnitPrices[i];
      line.descuento_promocion = roundHalfUpToCents(line.precio_lista * line.cantidad - afterPromotionAmounts[i]);
    }

    const puntos_a_ganar = Math.floor(total / 10);

    return {
      lineas: lines,
      items: lines,
      subtotal,
      descuento_promociones,
      descuento_cupon: 0,
      descuento_puntos: 0,
      total,
      idCupon: null,
      puntos_canjeados: 0,
      puntos_a_ganar,
      avisos: [],
      cuenta: null,
    };
  }

  // ─────────────────────────────────────────────
  // FIDELIZACIÓN / PUNTOS (CU43, S7)
  // ─────────────────────────────────────────────

  getMyLoyalty(): Promise<LoyaltyMeResponse> {
    return firstValueFrom(this.http.get<LoyaltyMeResponse>(`${API_URL}/api/loyalty/me`));
  }

  getCustomerLoyalty(idCliente: number): Promise<LoyaltyCustomerResponse> {
    return firstValueFrom(this.http.get<LoyaltyCustomerResponse>(`${API_URL}/api/loyalty/customers/${idCliente}`));
  }
}
