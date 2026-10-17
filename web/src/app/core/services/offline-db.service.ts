import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';
import type {
  ProductOut,
  CachedSucursal,
  CachedInventario,
  CachedReserva,
  CachedVenta,
  CachedCliente,
  CachedMeta,
} from '../models';

export class YouShopDexie extends Dexie {
  productos!: Table<ProductOut, number>;
  sucursales!: Table<CachedSucursal, number>;
  inventario!: Table<CachedInventario, number>;
  reservas!: Table<CachedReserva, number>;
  ventas!: Table<CachedVenta, number>;
  cliente!: Table<CachedCliente, number>;
  meta!: Table<CachedMeta, string>;

  constructor(dbName: string) {
    super(dbName);
    this.version(1).stores({
      productos: 'idProducto, nombre, tipo, talla, color, idColeccion, idProveedor, fechaActualizacion',
      sucursales: 'codigoSucursal, nombre, idCiudad, idEmpresa',
      inventario: 'idInv, idProducto, codigoSucursal, [codigoSucursal+idProducto], idEmpresa',
      reservas: 'codigoReserva, idCliente, codigoSucursal, idProducto, estado, fecha',
      ventas: 'idVenta, idCliente, fecha, origen, discrepanciaStock',
      cliente: 'idCliente, idUser, idEmpresa',
      meta: 'key',
    });
  }
}

/**
 * Service managing user-and-tenant-scoped Dexie IndexedDB instance (OW2).
 * Database name format: youshop-<idEmpresa>-<idUser>.
 * Wiped and deleted on logout.
 */
@Injectable({
  providedIn: 'root',
})
export class OfflineDbService {
  private db: YouShopDexie | null = null;
  private currentDbName: string | null = null;

  constructor() {
    this.requestPersistentStorage();
  }

  private async requestPersistentStorage(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      try {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
          await navigator.storage.persist();
        }
      } catch {
        // Silently ignore if not supported or denied
      }
    }
  }

  /**
   * Resolves the canonical database name for the current tenant and user.
   */
  resolveDbName(idEmpresa?: number | string | null, idUser?: number | string | null): string {
    let emp = idEmpresa;
    let usr = idUser;

    if (!emp || !usr) {
      try {
        if (typeof localStorage !== 'undefined') {
          const usrStr = localStorage.getItem('user');
          if (usrStr) {
            const u = JSON.parse(usrStr);
            if (!emp && u.empresa?.idEmpresa) emp = u.empresa.idEmpresa;
            if (!usr && (u.id || u.idUser)) usr = u.id || u.idUser;
          }
          if (!emp) {
            const empStr = localStorage.getItem('empresa');
            if (empStr) {
              const e = JSON.parse(empStr);
              if (e?.idEmpresa) emp = e.idEmpresa;
            }
          }
        }
      } catch {}
    }

    const finalEmp = emp || 'global';
    const finalUsr = usr || 'guest';
    return `youshop-${finalEmp}-${finalUsr}`;
  }

  /**
   * Initializes or gets the database for a specific tenant and user.
   */
  getDb(idEmpresa?: number | string | null, idUser?: number | string | null): YouShopDexie {
    const dbName = this.resolveDbName(idEmpresa, idUser);

    if (this.db && this.currentDbName === dbName) {
      return this.db;
    }

    if (this.db) {
      try {
        this.db.close();
      } catch {}
    }

    this.currentDbName = dbName;
    this.db = new YouShopDexie(dbName);
    return this.db;
  }

  /**
   * Returns the currently active DB. Re-evaluates canonical name
   * so it never gets stuck on an outdated or guest DB name.
   */
  getActiveDb(): YouShopDexie {
    return this.getDb();
  }

  /**
   * Reads the lastServerTime stored in the meta table.
   */
  async getLastServerTime(): Promise<string | null> {
    try {
      const db = this.getActiveDb();
      const meta = await db.meta.get('lastServerTime');
      return meta ? meta.value : null;
    } catch {
      return null;
    }
  }

  /**
   * Saves the lastServerTime in the meta table.
   */
  async setLastServerTime(serverTime: string): Promise<void> {
    try {
      const db = this.getActiveDb();
      await db.meta.put({ key: 'lastServerTime', value: serverTime });
    } catch (err) {
      console.warn('Failed to save lastServerTime to offline DB:', err);
    }
  }

  /**
   * Wipes all cached tables and deletes the IndexedDB instance on logout.
   */
  async wipeOnLogout(): Promise<void> {
    if (this.db) {
      try {
        await Promise.all([
          this.db.productos.clear(),
          this.db.sucursales.clear(),
          this.db.inventario.clear(),
          this.db.reservas.clear(),
          this.db.ventas.clear(),
          this.db.cliente.clear(),
          this.db.meta.clear(),
        ]);
        this.db.close();
        await this.db.delete();
      } catch (err) {
        console.warn('Error wiping offline DB on logout:', err);
      } finally {
        this.db = null;
        this.currentDbName = null;
      }
    }
  }
}
