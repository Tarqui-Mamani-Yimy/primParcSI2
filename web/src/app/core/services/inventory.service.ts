import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { InventoryLocation, InventoryStockEntry, StockAdjustIn, StockIngresoIn, DispatchIn } from '../models';
import { NotificationService } from './notification.service';
import { OfflineDbService } from './offline-db.service';
import { SyncService } from './sync.service';
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
    private offlineDbService: OfflineDbService,
    private syncService: SyncService,
  ) {
    this.syncService.syncCompleted.subscribe(() => {
      this.loadCachedLocations();
      this.loadCachedStock(this.selectedLocationIdSignal());
    });
  }

  setSelectedLocation(locationId: string) {
    this.selectedLocationIdSignal.set(locationId);
  }

  private async loadCachedLocations(): Promise<boolean> {
    try {
      const db = this.offlineDbService.getActiveDb();
      const cached = await db.sucursales.toArray();
      if (cached && cached.length > 0) {
        this.locationsSignal.set(cached.map(s => ({
          codigoSucursal: s.codigoSucursal,
          nombre: s.nombre,
          idCiudad: s.idCiudad,
          ciudad: (s as any).ciudad || '',
          direccion: s.direccion || '',
          idEmpresa: s.idEmpresa,
        })));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async loadLocations(): Promise<void> {
    const hadCached = await this.loadCachedLocations();

    if (this.syncService.isOnline()) {
      try {
        const locs = await firstValueFrom(
          this.http.get<InventoryLocation[]>(`${API_URL}/api/inventory/locations`)
        );
        this.locationsSignal.set(locs);
      } catch {
        if (!hadCached && this.locationsSignal().length === 0) {
          this.notificationService.error('Error', 'No se pudieron cargar las ubicaciones.');
        }
      }
    }
  }

  private async loadCachedStock(locationId?: string): Promise<boolean> {
    const locId = locationId ?? this.selectedLocationIdSignal();
    try {
      const db = this.offlineDbService.getActiveDb();
      let invs = await db.inventario.toArray();
      if (locId && locId !== 'ALL') {
        invs = invs.filter(i => i.codigoSucursal === Number(locId));
      }
      if (invs && invs.length > 0) {
        const prodsMap = new Map((await db.productos.toArray()).map(p => [p.idProducto, p]));
        const sucsMap = new Map((await db.sucursales.toArray()).map(s => [s.codigoSucursal, s]));
        const entries: InventoryStockEntry[] = invs.map(inv => {
          const prod = prodsMap.get(inv.idProducto);
          const suc = sucsMap.get(inv.codigoSucursal);
          return {
            idInv: inv.idInv,
            idProducto: inv.idProducto,
            codigoSucursal: inv.codigoSucursal,
            cantidad_actual: inv.cantidad_actual,
            cantidad_reservada: inv.cantidad_reservada,
            producto_nombre: prod?.nombre ?? `Producto #${inv.idProducto}`,
            producto_tipo: prod?.tipo ?? '',
            producto_talla: prod?.talla ?? '',
            producto_color: prod?.color ?? '',
            producto_imagen: prod?.imagen_url ?? '',
            sucursal_nombre: suc?.nombre ?? `Sucursal #${inv.codigoSucursal}`,
          };
        });
        this.stockSignal.set(entries);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async loadStock(locationId?: string): Promise<void> {
    const locId = locationId ?? this.selectedLocationIdSignal();
    const hadCached = await this.loadCachedStock(locId);

    if (this.syncService.isOnline()) {
      let params = new HttpParams();
      if (locId && locId !== 'ALL') {
        params = params.set('codigoSucursal', locId);
      }
      try {
        const stk = await firstValueFrom(
          this.http.get<InventoryStockEntry[]>(`${API_URL}/api/inventory/stock`, { params })
        );
        this.stockSignal.set(stk);
      } catch {
        if (!hadCached && this.stockSignal().length === 0) {
          this.notificationService.error('Error', 'No se pudo cargar el stock.');
        }
      }
    }
  }

  adjustStock(stockId: number, newCantidad: number, motivo?: string): Promise<boolean> {
    if (!this.syncService.isOnline()) {
      this.notificationService.warning('Sin conexión', 'Operación no disponible sin conexión a internet.');
      return Promise.resolve(false);
    }
    const payload: StockAdjustIn = {
      cantidad: newCantidad,
      signo: 'set',
      motivo: motivo || 'Ajuste manual del operador',
    };
    return firstValueFrom(
      this.http.patch(`${API_URL}/api/inventory/stock/${stockId}/adjust`, payload)
    ).then(() => {
      this.loadStock(this.selectedLocationIdSignal());
      this.notificationService.success('Stock ajustado', `Stock actualizado a ${newCantidad} unidades.`);
      return true;
    }).catch((err) => {
      if (err.status === 403 && (err.multitenantHandled || err.error?.detail?.code)) return false;
      const msg = (typeof err.error?.detail === 'string' ? err.error.detail : null) || 'No se pudo ajustar el stock.';
      this.notificationService.error('Error', msg);
      return false;
    });
  }

  receiveStock(
    idProducto: number,
    codigoSucursal: number,
    cantidad: number,
    idProveedor: number | null,
    motivo?: string
  ): Promise<boolean> {
    if (!this.syncService.isOnline()) {
      this.notificationService.warning('Sin conexión', 'Operación no disponible sin conexión a internet.');
      return Promise.resolve(false);
    }
    const payload: StockIngresoIn = {
      idProducto,
      codigoSucursal,
      cantidad,
      idProveedor: idProveedor ?? undefined,
      motivo: motivo || 'Ingreso de lote',
    };
    return firstValueFrom(
      this.http.post(`${API_URL}/api/inventory/stock/ingreso`, payload)
    ).then(() => {
      this.loadStock(this.selectedLocationIdSignal());
      this.notificationService.success('Ingreso registrado', `Stock inicial asignado (${cantidad} unidades).`);
      return true;
    }).catch((err) => {
      if (err.status === 403 && (err.multitenantHandled || err.error?.detail?.code)) return false;
      const msg = (typeof err.error?.detail === 'string' ? err.error.detail : null) || 'No se pudo registrar el ingreso de lote.';
      this.notificationService.error('Error', msg);
      return false;
    });
  }

  transferStock(
    idProducto: number,
    origenCodigo: number,
    destinoCodigo: number,
    cantidad: number,
    motivo?: string
  ): Promise<boolean> {
    if (!this.syncService.isOnline()) {
      this.notificationService.warning('Sin conexión', 'Operación no disponible sin conexión a internet.');
      return Promise.resolve(false);
    }
    const payload: DispatchIn = {
      origen: origenCodigo,
      destino: destinoCodigo,
      items: [{ idProducto, cantidad }],
      motivo: motivo || 'Transferencia entre sucursales',
    };
    return firstValueFrom(
      this.http.post(`${API_URL}/api/dispatches`, payload)
    ).then(() => {
      this.loadStock(this.selectedLocationIdSignal());
      this.notificationService.success('Transferencia programada', `Despacho de transferencia registrado.`);
      return true;
    }).catch((err) => {
      if (err.status === 403 && (err.multitenantHandled || err.error?.detail?.code)) return false;
      const msg = (typeof err.error?.detail === 'string' ? err.error.detail : null) || 'No se pudo completar la transferencia.';
      this.notificationService.error('Error', msg);
      return false;
    });
  }
}
