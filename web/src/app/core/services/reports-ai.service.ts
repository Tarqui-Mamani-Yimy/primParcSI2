import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

export interface AIReportIn {
  prompt: string;
}

export interface AIReportOut {
  summary: string;
  columns: string[];
  rows: any[][];
  tool_used: string;
  period: {
    from?: string | null;
    to?: string | null;
    [key: string]: any;
  };
}

export interface TranscribeOut {
  text: string;
}

export function parseTranscribeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 503) {
      const detail = err.error?.detail;
      return typeof detail === 'string'
        ? detail
        : 'Servicio de transcripción no configurado. Falta configurar GROQ_API_KEY en el servidor.';
    }

    if (err.status === 413) {
      const detail = err.error?.detail;
      return typeof detail === 'string'
        ? detail
        : 'El audio grabado excede el límite máximo permitido (10 MB).';
    }

    if (err.status === 502) {
      const msg = err.error?.detail?.message || err.error?.detail;
      return typeof msg === 'string'
        ? `Error al transcribir el audio: ${msg}`
        : 'Error al transcribir el audio en el servidor. Intentá hablar más claro o escribir tu consulta.';
    }

    const detail = err.error?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (detail && typeof detail === 'object' && detail.message) {
      return detail.message;
    }
  }

  return 'Ocurrió un error inesperado al procesar la transcripción del audio.';
}

export function parseAiReportError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 503) {
      return typeof err.error?.detail === 'string'
        ? err.error.detail
        : 'Gemini no está configurado en este servidor. Configure GEMINI_API_KEY en el backend.';
    }

    if (err.status === 403) {
      const msg = err.error?.detail?.message || err.error?.detail;
      return typeof msg === 'string'
        ? msg
        : 'Acceso restringido: solo los usuarios con rol Administrador pueden generar reportes con Inteligencia Artificial.';
    }

    if (err.status === 502) {
      const msg = err.error?.detail?.message || err.error?.detail;
      return typeof msg === 'string'
        ? `Error del modelo Gemini: ${msg}`
        : 'Error al procesar la consulta con Inteligencia Artificial. Por favor, intentá reformular tu solicitud.';
    }

    const detail = err.error?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (detail && typeof detail === 'object' && detail.message) {
      return detail.message;
    }
  }

  return 'Ocurrió un error inesperado al procesar el reporte con Inteligencia Artificial.';
}

@Injectable({
  providedIn: 'root'
})
export class ReportsAiService {
  constructor(private http: HttpClient) {}

  /**
   * Genera un reporte analítico con Gemini a partir de una consulta en lenguaje natural (texto o voz).
   */
  async generateReport(prompt: string): Promise<AIReportOut> {
    return firstValueFrom(
      this.http.post<AIReportOut>(`${API_URL}/api/reports/ai`, { prompt })
    );
  }

  /**
   * Genera y descarga el archivo CSV correspondiente al reporte analítico solicitado.
   */
  async downloadReportCsv(prompt: string): Promise<Blob> {
    return firstValueFrom(
      this.http.post(`${API_URL}/api/reports/ai/csv`, { prompt }, { responseType: 'blob' })
    );
  }

  /**
   * Envía un audio grabado en formato Blob (multipart/form-data con campo 'audio')
   * a /api/reports/ai/transcribe para obtener la transcripción a texto con Groq Whisper (S10).
   */
  async transcribeAudio(audioBlob: Blob): Promise<TranscribeOut> {
    const formData = new FormData();
    const isOgg = audioBlob.type.includes('ogg');
    const filename = isOgg ? 'audio.ogg' : 'audio.webm';
    formData.append('audio', audioBlob, filename);

    return firstValueFrom(
      this.http.post<TranscribeOut>(`${API_URL}/api/reports/ai/transcribe`, formData)
    );
  }
}
