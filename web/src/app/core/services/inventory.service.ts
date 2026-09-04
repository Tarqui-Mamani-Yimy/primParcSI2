import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { InventoryLocation, InventoryStockEntry } from '../models';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private locationsSignal = signal<InventoryLocation[]>([]);
  private stockSignal = signal<InventoryStockEntry[]>([]);
  private selectedLocationIdSignal = signal<string>('ALL');

  public locations = this.locationsSignal.asReadonly();
  public stock = this.stockSignal.asReadonly();
  public selectedLocationId = this.selectedLocationIdSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService,
  ) {}

  setSelectedLocation(locationId: string) {
    this.selectedLocationIdSignal.set(locationId);
  }

  loadLocations(): Promise<void> {
    return firstValueFrom(
      this.http.get<InventoryLocation[]>(`${API_URL}/api/inventory/locations`)
    ).then((locs) => {
      this.locationsSignal.set(locs);
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudieron cargar las ubicaciones.');
    });
  }

  loadStock(locationId?: string): Promise<void> {
    let params = new HttpParams();
    if (locationId && locationId !== 'ALL') {
      params = params.set('locationId', locationId);
    }
    return firstValueFrom(
      this.http.get<InventoryStockEntry[]>(`${API_URL}/api/inventory/stock`, { params })
    ).then((stk) => {
      this.stockSignal.set(stk);
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo cargar el stock.');
    });
  }

  adjustStock(stockId: string, delta: number, reason: string): Promise<boolean> {
    return firstValueFrom(
      this.http.patch<InventoryStockEntry>(`${API_URL}/api/inventory/stock/${stockId}/adjust`, { delta, reason })
    ).then((updated) => {
      this.stockSignal.update(stocks => stocks.map(s => s.id === stockId ? updated : s));
      this.notificationService.success('Stock ajustado', `Cantidad modificada (${delta > 0 ? '+' : ''}${delta}).`);
      return true;
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo ajustar el stock.');
      return false;
    });
  }

  transferStock(
    producto_id: string,
    origen_id: string,
    destino_id: string,
    talla: string,
    cantidad: number
  ): Promise<boolean> {
    return firstValueFrom(
      this.http.post(`${API_URL}/api/inventory/transfer`, { producto_id, origen_id, destino_id, talla, cantidad })
    ).then(() => {
      this.loadStock();
      const from = this.locationsSignal().find(l => l.id === origen_id)?.nombre || origen_id;
      const to = this.locationsSignal().find(l => l.id === destino_id)?.nombre || destino_id;
      this.notificationService.success('Transferencia programada', `${cantidad} unidades de ${from} a ${to}.`);
      return true;
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo completar la transferencia.');
      return false;
    });
  }
}
