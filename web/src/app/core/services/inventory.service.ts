import { Injectable, signal } from '@angular/core';
import { InventoryLocation, InventoryStockEntry } from '../models';
import { NotificationService } from './notification.service';

export const LOCATIONS: InventoryLocation[] = [
  {
    id: 'loc_paris',
    name: 'Paris Flagship & Atelier',
    city: 'Paris',
    country: 'France',
    type: 'FLAGSHIP',
    code: 'PAR-08',
    address: '14 Rue Saint-Honoré, 75008 Paris',
    manager: 'Camille Desrosiers'
  },
  {
    id: 'loc_tokyo',
    name: 'Tokyo Ginza Vault & Boutique',
    city: 'Tokyo',
    country: 'Japan',
    type: 'FLAGSHIP',
    code: 'TYO-GNZ',
    address: '6-10-1 Ginza, Chuo City, Tokyo',
    manager: 'Kenji Takahashi'
  },
  {
    id: 'loc_ny',
    name: 'New York SoHo Salon',
    city: 'New York',
    country: 'United States',
    type: 'BOUTIQUE',
    code: 'NYC-SOHO',
    address: '112 Mercer Street, New York, NY 10012',
    manager: 'Marcus Sterling'
  },
  {
    id: 'loc_milan',
    name: 'Milan Montenapoleone Suite',
    city: 'Milan',
    country: 'Italy',
    type: 'BOUTIQUE',
    code: 'MIL-MN',
    address: 'Via Montenapoleone 8, 20121 Milano',
    manager: 'Giulia Forlani'
  },
  {
    id: 'loc_zurich',
    name: 'Alpine Central Archive & Vault',
    city: 'Zurich',
    country: 'Switzerland',
    type: 'CENTRAL_VAULT',
    code: 'ZUR-VAULT',
    address: 'Bahnhofstrasse 45, 8001 Zürich',
    manager: 'Astrid Lindholm'
  }
];

const INITIAL_STOCK: InventoryStockEntry[] = [
  // Cashmere Coat (prd_01)
  { id: 'stk_01', productId: 'prd_01', locationId: 'loc_paris', size: 'M', quantity: 6, reserved: 1, minThreshold: 3, lastAudited: 'Today 09:30' },
  { id: 'stk_02', productId: 'prd_01', locationId: 'loc_paris', size: 'L', quantity: 4, reserved: 0, minThreshold: 2, lastAudited: 'Today 09:30' },
  { id: 'stk_03', productId: 'prd_01', locationId: 'loc_tokyo', size: 'S', quantity: 5, reserved: 2, minThreshold: 2, lastAudited: 'Today 14:10' },
  { id: 'stk_04', productId: 'prd_01', locationId: 'loc_tokyo', size: 'M', quantity: 4, reserved: 1, minThreshold: 2, lastAudited: 'Today 14:10' },
  { id: 'stk_05', productId: 'prd_01', locationId: 'loc_ny', size: 'M', quantity: 5, reserved: 0, minThreshold: 3, lastAudited: 'Yesterday' },
  { id: 'stk_06', productId: 'prd_01', locationId: 'loc_zurich', size: 'M', quantity: 3, reserved: 0, minThreshold: 5, lastAudited: 'Today 08:00' },

  // Wool-Silk Blazer (prd_02)
  { id: 'stk_07', productId: 'prd_02', locationId: 'loc_paris', size: 'S', quantity: 8, reserved: 2, minThreshold: 4, lastAudited: 'Today 11:20' },
  { id: 'stk_08', productId: 'prd_02', locationId: 'loc_paris', size: 'M', quantity: 7, reserved: 1, minThreshold: 4, lastAudited: 'Today 11:20' },
  { id: 'stk_09', productId: 'prd_02', locationId: 'loc_milan', size: 'M', quantity: 9, reserved: 3, minThreshold: 3, lastAudited: 'Today 10:05' },
  { id: 'stk_10', productId: 'prd_02', locationId: 'loc_tokyo', size: 'S', quantity: 7, reserved: 0, minThreshold: 3, lastAudited: 'Today 16:45' },

  // 3D-Knit Mockneck (prd_03)
  { id: 'stk_11', productId: 'prd_03', locationId: 'loc_paris', size: 'M', quantity: 12, reserved: 2, minThreshold: 5, lastAudited: 'Today 09:15' },
  { id: 'stk_12', productId: 'prd_03', locationId: 'loc_tokyo', size: 'M', quantity: 14, reserved: 4, minThreshold: 5, lastAudited: 'Today 15:30' },
  { id: 'stk_13', productId: 'prd_03', locationId: 'loc_ny', size: 'L', quantity: 8, reserved: 1, minThreshold: 4, lastAudited: 'Yesterday' },

  // Wide-Leg Trouser (prd_04)
  { id: 'stk_14', productId: 'prd_04', locationId: 'loc_paris', size: 'M', quantity: 7, reserved: 0, minThreshold: 3, lastAudited: 'Today 10:00' },
  { id: 'stk_15', productId: 'prd_04', locationId: 'loc_zurich', size: 'M', quantity: 6, reserved: 1, minThreshold: 4, lastAudited: 'Today 08:30' }
];

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private locationsSignal = signal<InventoryLocation[]>(LOCATIONS);
  private stockSignal = signal<InventoryStockEntry[]>(INITIAL_STOCK);
  private selectedLocationIdSignal = signal<string>('ALL');

  public locations = this.locationsSignal.asReadonly();
  public stock = this.stockSignal.asReadonly();
  public selectedLocationId = this.selectedLocationIdSignal.asReadonly();

  constructor(private notificationService: NotificationService) {}

  setSelectedLocation(locationId: string) {
    this.selectedLocationIdSignal.set(locationId);
  }

  adjustStock(stockId: string, delta: number, reason: string) {
    this.stockSignal.update(stocks =>
      stocks.map(item => {
        if (item.id === stockId) {
          const newQty = Math.max(0, item.quantity + delta);
          return {
            ...item,
            quantity: newQty,
            lastAudited: 'Just now'
          };
        }
        return item;
      })
    );
    this.notificationService.success('Stock Adjusted', `Inventory count modified (${delta > 0 ? '+' : ''}${delta}). Reason: ${reason}`);
  }

  transferStock(
    productId: string,
    fromLocId: string,
    toLocId: string,
    size: string,
    quantity: number
  ): boolean {
    const fromLocation = this.locationsSignal().find(l => l.id === fromLocId)?.name;
    const toLocation = this.locationsSignal().find(l => l.id === toLocId)?.name;

    // Deduct from source
    let sourceSuccess = false;
    this.stockSignal.update(stocks => {
      return stocks.map(stk => {
        if (stk.productId === productId && stk.locationId === fromLocId && stk.size === size) {
          if (stk.quantity >= quantity) {
            sourceSuccess = true;
            return { ...stk, quantity: stk.quantity - quantity, lastAudited: 'Just now' };
          }
        }
        return stk;
      });
    });

    if (!sourceSuccess) {
      this.notificationService.error('Transfer Failed', 'Insufficient stock available at source location.');
      return false;
    }

    // Add to target
    this.stockSignal.update(stocks => {
      const existing = stocks.find(
        stk => stk.productId === productId && stk.locationId === toLocId && stk.size === size
      );
      if (existing) {
        return stocks.map(stk =>
          stk.id === existing.id
            ? { ...stk, quantity: stk.quantity + quantity, lastAudited: 'Just now' }
            : stk
        );
      } else {
        const newEntry: InventoryStockEntry = {
          id: 'stk_' + Date.now().toString(36),
          productId,
          locationId: toLocId,
          size,
          quantity,
          reserved: 0,
          minThreshold: 2,
          lastAudited: 'Just now'
        };
        return [...stocks, newEntry];
      }
    });

    this.notificationService.success(
      'Hub Transfer Dispatched',
      `${quantity} units scheduled for transfer from ${fromLocation} to ${toLocation}.`
    );
    return true;
  }
}
