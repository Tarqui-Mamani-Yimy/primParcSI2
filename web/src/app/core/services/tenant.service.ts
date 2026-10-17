import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TenantMeResponse } from '../models';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  constructor(private http: HttpClient) {}

  getTenantMe(): Observable<TenantMeResponse> {
    return this.http.get<TenantMeResponse>(`${API_URL}/api/tenant/me`);
  }
}
