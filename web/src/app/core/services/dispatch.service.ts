import { Injectable, signal } from '@angular/core';
import { DispatchOrder } from '../models';
import { NotificationService } from './notification.service';

const INITIAL_DISPATCHES: DispatchOrder[] = [
  {
    id: 'dsp_01',
    referenceNumber: 'AETH-LOG-8821',
    clientName: 'Madame C. de Rothschild',
    clientType: 'VIP_PRIVATE',
    originLocationId: 'loc_paris',
    destinationHub: 'Private Residence, Geneva 1204',
    courier: 'Ferrari Luxury Secured',
    trackingCode: 'FER-CH-9923841',
    status: 'IN_TRANSIT',
    items: [
      { productName: 'Kinetic Double-Face Cashmere Overcoat', sku: 'AETH-CT-001', size: 'M', quantity: 1, valueEUR: 2850 },
      { productName: 'Sculptural Wool-Silk Crepe Blazer', sku: 'AETH-BL-004', size: 'M', quantity: 1, valueEUR: 1950 }
    ],
    totalValueEUR: 4800,
    createdAt: '2026-08-25T14:30:00Z',
    estimatedDelivery: '2026-08-27 (Priority Courier by 12:00)',
    notes: 'White-glove private presentation required upon delivery.'
  },
  {
    id: 'dsp_02',
    referenceNumber: 'AETH-LOG-8820',
    clientName: 'Tokyo Ginza Atelier Refill',
    clientType: 'BOUTIQUE_TRANSFER',
    originLocationId: 'loc_zurich',
    destinationHub: 'AETHER Tokyo Flagship (Ginza)',
    courier: 'DHL Express Global',
    trackingCode: 'DHL-EXP-44029198',
    status: 'CUSTOMS_CLEARANCE',
    items: [
      { productName: 'Seamless 3D-Knit Merino Mockneck', sku: 'AETH-KN-012', size: 'M', quantity: 12, valueEUR: 9360 },
      { productName: 'Pleated Flannel Wide-Leg Trouser', sku: 'AETH-TR-008', size: 'L', quantity: 6, valueEUR: 5520 }
    ],
    totalValueEUR: 14880,
    createdAt: '2026-08-24T09:15:00Z',
    estimatedDelivery: '2026-08-28',
    notes: 'Customs declaration under luxury apparel classification code 6102.10.'
  },
  {
    id: 'dsp_03',
    referenceNumber: 'AETH-LOG-8819',
    clientName: 'Vogue Global Architecture Feature',
    clientType: 'EDITORIAL_LOAN',
    originLocationId: 'loc_paris',
    destinationHub: 'Vogue Studios, 1 World Trade Center NYC',
    courier: 'Direct Courier',
    trackingCode: 'DIR-NYC-77182',
    status: 'DELIVERED',
    items: [
      { productName: 'Modular Storm Tech-Silk Shell', sku: 'AETH-PK-002', size: 'M', quantity: 1, valueEUR: 2400 }
    ],
    totalValueEUR: 2400,
    createdAt: '2026-08-22T16:00:00Z',
    estimatedDelivery: 'Delivered Aug 24',
    notes: 'Return scheduled for Sept 02 to Central Vault Zurich.'
  },
  {
    id: 'dsp_04',
    referenceNumber: 'AETH-LOG-8818',
    clientName: 'H.E. Ambassador K. Lindgren',
    clientType: 'VIP_PRIVATE',
    originLocationId: 'loc_milan',
    destinationHub: 'Stockholm Diplomatic Mission',
    courier: 'Ferrari Luxury Secured',
    trackingCode: 'FER-SE-0019284',
    status: 'PREPARATION',
    items: [
      { productName: 'Anatomical Calfskin Loafer', sku: 'AETH-FT-001', size: '42', quantity: 1, valueEUR: 1250 },
      { productName: 'Kinetic Double-Face Cashmere Overcoat', sku: 'AETH-CT-001', size: 'L', quantity: 1, valueEUR: 2850 }
    ],
    totalValueEUR: 4100,
    createdAt: '2026-08-26T18:00:00Z',
    estimatedDelivery: '2026-08-29',
    notes: 'Embossed archival wood gift box requested.'
  }
];

@Injectable({
  providedIn: 'root'
})
export class DispatchService {
  private dispatchesSignal = signal<DispatchOrder[]>(INITIAL_DISPATCHES);
  public dispatches = this.dispatchesSignal.asReadonly();

  constructor(private notificationService: NotificationService) {}

  updateStatus(orderId: string, newStatus: DispatchOrder['status']) {
    this.dispatchesSignal.update(list =>
      list.map(order => (order.id === orderId ? { ...order, status: newStatus } : order))
    );
    this.notificationService.success('Dispatch Updated', `Shipment status updated to "${newStatus.replace('_', ' ')}".`);
  }

  createDispatch(newOrder: Omit<DispatchOrder, 'id' | 'referenceNumber' | 'createdAt'>) {
    const id = 'dsp_' + Date.now().toString(36);
    const refNum = `AETH-LOG-${Math.floor(1000 + Math.random() * 9000)}`;
    const order: DispatchOrder = {
      ...newOrder,
      id,
      referenceNumber: refNum,
      createdAt: new Date().toISOString()
    };

    this.dispatchesSignal.update(list => [order, ...list]);
    this.notificationService.success('Manifest Generated', `Dispatch order ${refNum} booked with ${order.courier}.`);
    return order;
  }
}
