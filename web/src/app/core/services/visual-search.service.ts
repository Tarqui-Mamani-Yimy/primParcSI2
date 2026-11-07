import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { VisualReindexResponse, VisualSearchResponse } from '../models';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class VisualSearchService {
  constructor(private http: HttpClient) {}

  /**
   * Búsqueda de prendas por foto (CU40, S7).
   * POST /api/products/visual-search (multipart/form-data con campo 'imagen')
   * @param file Archivo de imagen seleccionado o capturado por el cliente
   * @param limit Límite opcional de resultados (default 8, máx 24)
   */
  searchByPhoto(file: File, limit?: number): Promise<VisualSearchResponse> {
    const formData = new FormData();
    formData.append('imagen', file, file.name);

    let params = new HttpParams();
    if (limit !== undefined && limit !== null) {
      params = params.set('limit', limit.toString());
    }

    return firstValueFrom(
      this.http.post<VisualSearchResponse>(`${API_URL}/api/products/visual-search`, formData, { params })
    );
  }

  /**
   * Reindexación masiva de imágenes para búsqueda por foto (CU40, S6).
   * Requiere permiso 'producto.editar'.
   * POST /api/products/visual-search/reindex
   */
  reindexCatalog(): Promise<VisualReindexResponse> {
    return firstValueFrom(
      this.http.post<VisualReindexResponse>(`${API_URL}/api/products/visual-search/reindex`, {})
    );
  }
}
