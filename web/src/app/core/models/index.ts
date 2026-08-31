export type UserRole = 'DIRECTOR' | 'CURATOR' | 'SUPPLY_CHAIN' | 'ADMIN';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  location: string;
  avatarUrl?: string;
  lastActive: string;
  permissions: string[];
}

export interface InventoryLocation {
  id: string;
  name: string;
  city: string;
  country: string;
  type: 'FLAGSHIP' | 'BOUTIQUE' | 'CENTRAL_VAULT' | 'STUDIO';
  code: string;
  address: string;
  manager: string;
}

export interface GarmentMaterial {
  name: string;
  percentage: number;
  origin: string;
  certifications?: string[];
}

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  subtitle: string;
  collection: 'ESSENTIAL_PERMANENT' | 'ARCHIVE_AW25' | 'ATELIER_SS26' | 'PROTOTYPE';
  category: 'OUTERWEAR' | 'TAILORING' | 'KNITWEAR' | 'TROUSERS' | 'FOOTWEAR' | 'OBJECTS';
  priceEUR: number;
  priceUSD: number;
  priceJPY: number;
  status: 'IN_PRODUCTION' | 'AVAILABLE' | 'VAULT_ONLY' | 'RESERVED';
  imageUrl: string;
  secondaryImages: string[];
  materials: GarmentMaterial[];
  sizes: { [size: string]: number }; // size -> total across network
  colorway: string;
  colorHex: string;
  seasonYear: string;
  designerNotes: string;
}

export interface InventoryStockEntry {
  id: string;
  productId: string;
  locationId: string;
  size: string;
  quantity: number;
  reserved: number;
  minThreshold: number;
  lastAudited: string;
}

export interface DispatchOrder {
  id: string;
  referenceNumber: string;
  clientName: string;
  clientType: 'VIP_PRIVATE' | 'BOUTIQUE_TRANSFER' | 'EDITORIAL_LOAN' | 'ARCHIVE_ACQUISITION';
  originLocationId: string;
  destinationHub: string;
  courier: 'DHL Express Global' | 'Ferrari Luxury Secured' | 'Tokyo Express VIP' | 'Direct Courier';
  trackingCode: string;
  status: 'PREPARATION' | 'DISPATCHED' | 'IN_TRANSIT' | 'CUSTOMS_CLEARANCE' | 'DELIVERED';
  items: {
    productName: string;
    sku: string;
    size: string;
    quantity: number;
    valueEUR: number;
  }[];
  totalValueEUR: number;
  createdAt: string;
  estimatedDelivery: string;
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}
