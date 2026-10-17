import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ChangeEstadoIn,
  ChangePlanIn,
  CreateEmpresaIn,
  PlatformEmpresa,
  PlatformPlan,
  UpdateEmpresaIn
} from '../models';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class PlatformService {
  constructor(private http: HttpClient) {}

  getPlans(): Observable<PlatformPlan[]> {
    return this.http.get<PlatformPlan[]>(`${API_URL}/api/platform/plans`);
  }

  getEmpresas(): Observable<PlatformEmpresa[]> {
    return this.http.get<PlatformEmpresa[]>(`${API_URL}/api/platform/empresas`);
  }

  createEmpresa(payload: CreateEmpresaIn): Observable<PlatformEmpresa> {
    return this.http.post<PlatformEmpresa>(`${API_URL}/api/platform/empresas`, payload);
  }

  updateEmpresa(id: number, payload: UpdateEmpresaIn): Observable<PlatformEmpresa> {
    return this.http.patch<PlatformEmpresa>(`${API_URL}/api/platform/empresas/${id}`, payload);
  }

  changePlan(id: number, codigoPlan: string): Observable<unknown> {
    const payload: ChangePlanIn = { codigoPlan };
    return this.http.patch(`${API_URL}/api/platform/empresas/${id}/plan`, payload);
  }

  changeEstado(id: number, estado: 'activa' | 'suspendida'): Observable<unknown> {
    const payload: ChangeEstadoIn = { estado };
    return this.http.patch(`${API_URL}/api/platform/empresas/${id}/estado`, payload);
  }
}
