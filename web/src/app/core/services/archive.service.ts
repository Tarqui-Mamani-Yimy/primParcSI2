import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProductItem } from '../models';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class ArchiveService {
  private productsSignal = signal<ProductItem[]>([]);
  public products = this.productsSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService,
  ) {}

  loadProducts(filters?: { coleccion?: string; categoria?: string; search?: string }): Promise<void> {
    let params = new HttpParams();
    if (filters?.coleccion) params = params.set('coleccion', filters.coleccion);
    if (filters?.categoria) params = params.set('categoria', filters.categoria);
    if (filters?.search) params = params.set('search', filters.search);

    return firstValueFrom(
      this.http.get<ProductItem[]>(`${API_URL}/api/products`, { params })
    ).then((list) => {
      this.productsSignal.set(list);
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo cargar el catálogo.');
    });
  }

  getProductById(id: string): Promise<ProductItem | null> {
    return firstValueFrom(
      this.http.get<ProductItem>(`${API_URL}/api/products/${id}`)
    ).catch(() => null);
  }

  addProduct(newProduct: Omit<ProductItem, 'id'>): Promise<ProductItem | null> {
    return firstValueFrom(
      this.http.post<ProductItem>(`${API_URL}/api/products`, newProduct)
    ).then((product) => {
      this.productsSignal.update(list => [product, ...list]);
      this.notificationService.success('Producto agregado', `"${product.nombre}" añadido al catálogo.`);
      return product;
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo agregar el producto.');
      return null;
    });
  }

  updateProduct(id: string, updates: Partial<ProductItem>): Promise<ProductItem | null> {
    return firstValueFrom(
      this.http.put<ProductItem>(`${API_URL}/api/products/${id}`, updates)
    ).then((product) => {
      this.productsSignal.update(list => list.map(p => p.id === id ? product : p));
      this.notificationService.info('Producto actualizado', `SKU: ${updates.sku || id}`);
      return product;
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo actualizar el producto.');
      return null;
    });
  }

  deleteProduct(id: string): Promise<boolean> {
    return firstValueFrom(
      this.http.delete(`${API_URL}/api/products/${id}`)
    ).then(() => {
      this.productsSignal.update(list => list.filter(p => p.id !== id));
      this.notificationService.warning('Producto eliminado', `ID: ${id} removido del catálogo.`);
      return true;
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo eliminar el producto.');
      return false;
    });
  }
}
