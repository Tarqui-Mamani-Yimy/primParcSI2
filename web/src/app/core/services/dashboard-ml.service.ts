import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MLCustomerSegmentsOut,
  MLProductTrendsOut,
  MLSalesForecastOut,
  MLStockoutRiskOut,
} from '../models';

const API_URL = environment.apiUrl;

export function parseDashboardMlError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 403) {
      const msg = err.error?.detail?.message || err.error?.detail;
      return typeof msg === 'string'
        ? msg
        : 'Acceso restringido: solo usuarios con rol Administrador pueden consultar proyecciones analíticas de Machine Learning.';
    }

    const detail = err.error?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (detail && typeof detail === 'object' && detail.message) {
      return detail.message;
    }
  }

  return 'Ocurrió un error inesperado al consultar las proyecciones de Machine Learning.';
}

@Injectable({
  providedIn: 'root'
})
export class DashboardMlService {
  constructor(private http: HttpClient) {}

  /**
   * S2: Obtiene el pronóstico de ventas futuras con regresión y banda de confianza (7, 30 o 90 días).
   */
  async getSalesForecast(days: number = 30, branchId?: number | null): Promise<MLSalesForecastOut> {
    let url = `${API_URL}/api/dashboard/ml/sales-forecast?days=${days}`;
    if (branchId !== undefined && branchId !== null && branchId > 0) {
      url += `&branch_id=${branchId}`;
    }
    return firstValueFrom(this.http.get<MLSalesForecastOut>(url));
  }

  /**
   * S3: Obtiene los productos en riesgo de quiebre de stock ordenados ascendentemente por días restantes.
   */
  async getStockoutRisk(branchId?: number | null): Promise<MLStockoutRiskOut> {
    let url = `${API_URL}/api/dashboard/ml/stockout-risk`;
    if (branchId !== undefined && branchId !== null && branchId > 0) {
      url += `?branch_id=${branchId}`;
    }
    return firstValueFrom(this.http.get<MLStockoutRiskOut>(url));
  }

  /**
   * S4: Obtiene la tendencia de productos (creciendo, estable, cayendo) basada en regresión lineal semanal.
   */
  async getProductTrends(): Promise<MLProductTrendsOut> {
    const url = `${API_URL}/api/dashboard/ml/product-trends`;
    return firstValueFrom(this.http.get<MLProductTrendsOut>(url));
  }

  /**
   * S5: Obtiene la segmentación RFM de clientes mediante clustering KMeans.
   */
  async getCustomerSegments(): Promise<MLCustomerSegmentsOut> {
    const url = `${API_URL}/api/dashboard/ml/customer-segments`;
    return firstValueFrom(this.http.get<MLCustomerSegmentsOut>(url));
  }
}
