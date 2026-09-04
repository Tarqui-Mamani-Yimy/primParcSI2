import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DispatchOrder, DispatchCreateRequest } from '../models';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class DispatchService {
  private dispatchesSignal = signal<DispatchOrder[]>([]);
  public dispatches = this.dispatchesSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService,
  ) {}

  loadDispatches(): Promise<void> {
    return firstValueFrom(
      this.http.get<DispatchOrder[]>(`${API_URL}/api/dispatches`)
    ).then((list) => {
      this.dispatchesSignal.set(list);
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudieron cargar los despachos.');
    });
  }

  createDispatch(request: DispatchCreateRequest): Promise<DispatchOrder | null> {
    return firstValueFrom(
      this.http.post<DispatchOrder>(`${API_URL}/api/dispatches`, request)
    ).then((order) => {
      this.dispatchesSignal.update(list => [order, ...list]);
      this.notificationService.success('Despacho creado', `Referencia ${order.referencia} registrada.`);
      return order;
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo crear el despacho.');
      return null;
    });
  }

  updateStatus(orderId: string, newStatus: DispatchOrder['estado']): Promise<boolean> {
    this.notificationService.warning('No disponible', 'La actualización de estado estará disponible en Fase 2.');
    return Promise.resolve(false);
  }
}
