import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  MedidaTalla,
  SizeChartResponse,
  SizeChartUpdatePayload,
  AjusteTipo,
  FitResultado,
  SizeRecommendationOut,
  FitFeedbackIn,
  ClientFitFeedbackItem,
  FitFeedbackSummaryItem,
} from '../models';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

export type {
  MedidaTalla,
  SizeChartResponse,
  SizeChartUpdatePayload,
  AjusteTipo,
  FitResultado,
  SizeRecommendationOut,
  FitFeedbackIn,
  ClientFitFeedbackItem,
  FitFeedbackSummaryItem,
};

@Injectable({
  providedIn: 'root'
})
export class SizeChartService {
  constructor(private http: HttpClient) {}

  /**
   * Obtiene la tabla de medidas de un producto (S3).
   * GET /api/products/{idProducto}/size-chart
   */
  getSizeChart(idProducto: number): Promise<SizeChartResponse> {
    return firstValueFrom(
      this.http.get<SizeChartResponse>(`${API_URL}/api/products/${idProducto}/size-chart`)
    );
  }

  /**
   * Actualiza la tabla de medidas de un producto o restablece a la genérica con tallas: [] (S5).
   * PUT /api/products/{idProducto}/size-chart
   */
  updateSizeChart(idProducto: number, payload: SizeChartUpdatePayload): Promise<SizeChartResponse> {
    return firstValueFrom(
      this.http.put<SizeChartResponse>(`${API_URL}/api/products/${idProducto}/size-chart`, payload)
    );
  }

  /**
   * Obtiene la recomendación de talla personalizada para el cliente actual (CU35, S5).
   * GET /api/products/{idProducto}/size-recommendation
   */
  getSizeRecommendation(idProducto: number): Promise<SizeRecommendationOut> {
    return firstValueFrom(
      this.http.get<SizeRecommendationOut>(`${API_URL}/api/products/${idProducto}/size-recommendation`)
    );
  }

  /**
   * Envía la retroalimentación de ajuste del cliente para un producto comprado (CU36, S7).
   * POST /api/products/{idProducto}/fit-feedback
   */
  submitFitFeedback(idProducto: number, payload: FitFeedbackIn): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${API_URL}/api/products/${idProducto}/fit-feedback`, payload)
    );
  }

  /**
   * Obtiene los productos comprados por el cliente autenticado y sus respuestas de ajuste (CU36, S7).
   * GET /api/fit-feedback/mine
   */
  getMyFitFeedback(): Promise<ClientFitFeedbackItem[]> {
    return firstValueFrom(
      this.http.get<ClientFitFeedbackItem[]>(`${API_URL}/api/fit-feedback/mine`)
    );
  }

  /**
   * Obtiene el resumen de retroalimentación de ajuste para staff (CU36, S7).
   * Requiere permiso producto.editar.
   * GET /api/fit-feedback/summary
   */
  getFitFeedbackSummary(): Promise<FitFeedbackSummaryItem[]> {
    return firstValueFrom(
      this.http.get<FitFeedbackSummaryItem[]>(`${API_URL}/api/fit-feedback/summary`)
    );
  }
}

