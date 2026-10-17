import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  InventarioReporteFila,
  InventarioReporteOut,
  InventoryReportFiltros,
  SalesReportFiltros,
  VentaReporteOut,
} from '../models';
import { NotificationService } from './notification.service';
import { OfflineDbService } from './offline-db.service';
import { SyncService } from './sync.service';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  constructor(
    private http: HttpClient,
    private notificationService: NotificationService,
    private offlineDbService: OfflineDbService,
    private syncService: SyncService,
  ) {}

  private buildSalesParams(filtros: SalesReportFiltros): HttpParams {
    let params = new HttpParams();
    if (filtros.fecha_desde) params = params.set('fecha_desde', filtros.fecha_desde);
    if (filtros.fecha_hasta) params = params.set('fecha_hasta', filtros.fecha_hasta);
    if (filtros.codigoSucursal !== undefined) params = params.set('codigoSucursal', filtros.codigoSucursal.toString());
    if (filtros.idProducto !== undefined) params = params.set('idProducto', filtros.idProducto.toString());
    return params;
  }

  private buildInventoryParams(filtros: InventoryReportFiltros): HttpParams {
    let params = new HttpParams();
    if (filtros.codigoSucursal !== undefined) params = params.set('codigoSucursal', filtros.codigoSucursal.toString());
    if (filtros.idProducto !== undefined) params = params.set('idProducto', filtros.idProducto.toString());
    return params;
  }

  async getSalesReport(filtros: SalesReportFiltros): Promise<VentaReporteOut | null> {
    if (this.syncService.isOnline()) {
      try {
        const params = this.buildSalesParams(filtros);
        return await firstValueFrom(
          this.http.get<VentaReporteOut>(`${API_URL}/api/reports/sales`, { params })
        );
      } catch {
        // Fallback to offline DB if network call fails
      }
    }

    try {
      const db = this.offlineDbService.getActiveDb();
      let ventas = await db.ventas.toArray();
      if (filtros.fecha_desde) {
        ventas = ventas.filter(v => v.fecha >= filtros.fecha_desde!);
      }
      if (filtros.fecha_hasta) {
        ventas = ventas.filter(v => v.fecha <= filtros.fecha_hasta!);
      }

      const total_monto = ventas.reduce((acc, v) => acc + (v.total || 0), 0);
      const total_items = ventas.length;

      return {
        filas: [],
        total_monto,
        total_items,
        filtros: {
          fecha_desde: filtros.fecha_desde || '',
          fecha_hasta: filtros.fecha_hasta || '',
          codigoSucursal: filtros.codigoSucursal ?? null,
          idProducto: filtros.idProducto ?? null,
        },
      };
    } catch {
      this.notificationService.error('Error', 'No se pudo cargar el reporte de ventas.');
      return null;
    }
  }

  async getInventoryReport(filtros: InventoryReportFiltros): Promise<InventarioReporteOut | null> {
    if (this.syncService.isOnline()) {
      try {
        const params = this.buildInventoryParams(filtros);
        return await firstValueFrom(
          this.http.get<InventarioReporteOut>(`${API_URL}/api/reports/inventory`, { params })
        );
      } catch {
        // Fallback to offline DB if network call fails
      }
    }

    try {
      const db = this.offlineDbService.getActiveDb();
      let inventario = await db.inventario.toArray();
      if (filtros.codigoSucursal !== undefined) {
        inventario = inventario.filter(i => i.codigoSucursal === filtros.codigoSucursal);
      }
      if (filtros.idProducto !== undefined) {
        inventario = inventario.filter(i => i.idProducto === filtros.idProducto);
      }

      const prodsMap = new Map((await db.productos.toArray()).map(p => [p.idProducto, p]));
      const sucsMap = new Map((await db.sucursales.toArray()).map(s => [s.codigoSucursal, s]));

      const filas: InventarioReporteFila[] = inventario.map(i => {
        const prod = prodsMap.get(i.idProducto);
        const suc = sucsMap.get(i.codigoSucursal);
        return {
          idProducto: i.idProducto,
          producto_nombre: prod?.nombre ?? `Producto #${i.idProducto}`,
          codigoSucursal: i.codigoSucursal,
          sucursal_nombre: suc?.nombre ?? `Sucursal #${i.codigoSucursal}`,
          cantidad_actual: i.cantidad_actual,
          cantidad_reservada: i.cantidad_reservada,
        };
      });

      return {
        filas,
        filtros: {
          fecha_desde: '',
          fecha_hasta: '',
          codigoSucursal: filtros.codigoSucursal ?? null,
          idProducto: filtros.idProducto ?? null,
        },
      };
    } catch {
      this.notificationService.error('Error', 'No se pudo cargar el reporte de inventario.');
      return null;
    }
  }

  private downloadBlob(url: string, params: HttpParams, filename: string): Promise<void> {
    if (!this.syncService.isOnline()) {
      this.notificationService.warning('Sin conexión', 'La descarga de reportes requiere conexión a internet.');
      return Promise.resolve();
    }
    return firstValueFrom(
      this.http.get(url, { params, responseType: 'blob' })
    ).then((blob) => {
      triggerBlobDownload(blob, filename);
    }).catch(() => {
      this.notificationService.error('Error', `No se pudo descargar "${filename}".`);
    });
  }

  downloadSalesCsv(filtros: SalesReportFiltros): Promise<void> {
    return this.downloadBlob(`${API_URL}/api/reports/sales/csv`, this.buildSalesParams(filtros), 'reporte_ventas.csv');
  }

  downloadSalesPdf(filtros: SalesReportFiltros): Promise<void> {
    return this.downloadBlob(`${API_URL}/api/reports/sales/pdf`, this.buildSalesParams(filtros), 'reporte_ventas.pdf');
  }

  downloadInventoryCsv(filtros: InventoryReportFiltros): Promise<void> {
    return this.downloadBlob(`${API_URL}/api/reports/inventory/csv`, this.buildInventoryParams(filtros), 'reporte_inventario.csv');
  }

  downloadInventoryPdf(filtros: InventoryReportFiltros): Promise<void> {
    return this.downloadBlob(`${API_URL}/api/reports/inventory/pdf`, this.buildInventoryParams(filtros), 'reporte_inventario.pdf');
  }
}
