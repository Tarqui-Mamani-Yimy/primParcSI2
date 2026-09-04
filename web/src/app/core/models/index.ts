// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export type UserRole = 'admin' | 'vendedor';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  permisos: string[];
}

// ─────────────────────────────────────────────
// PRODUCTS (Catálogo / Archive)
// ─────────────────────────────────────────────

export interface ProductItem {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string;
  coleccion: string;
  categoria: string;
  precio: number;
  imagen_url: string;
  imagenes_secundarias: string[];
  tallas: { [size: string]: number };
  color: string;
  temporada: string;
  notas_diseno?: string;
  estado: 'disponible' | 'agotado' | 'descontinuado';
}

// ─────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────

export interface InventoryLocation {
  id: string;
  nombre: string;
  ciudad: string;
  direccion?: string;
  responsable?: string;
}

export interface InventoryStockEntry {
  id: string;
  producto_id: string;
  sucursal_id: string;
  talla: string;
  cantidad: number;
  minimo?: number;
}

export interface StockAdjustRequest {
  delta: number;
  reason: string;
}

export interface TransferRequest {
  producto_id: string;
  origen_id: string;
  destino_id: string;
  talla: string;
  cantidad: number;
}

// ─────────────────────────────────────────────
// DISPATCHES
// ─────────────────────────────────────────────

export type DispatchStatus = 'preparacion' | 'despachado' | 'en_transito' | 'entregado';

export interface DispatchOrder {
  id: string;
  referencia: string;
  cliente: string;
  origen_id: string;
  destino_id: string;
  producto_id: string;
  cantidad: number;
  estado: DispatchStatus;
  creado_en: string;
}

export interface DispatchCreateRequest {
  origen_id: string;
  destino_id: string;
  producto_id: string;
  cantidad: number;
  cliente?: string;
}

// ─────────────────────────────────────────────
// TEAM
// ─────────────────────────────────────────────

export interface TeamMember {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  permisos: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  usuario: string;
  accion: string;
  detalles: string;
}

// ─────────────────────────────────────────────
// UI (no necesita backend)
// ─────────────────────────────────────────────

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}
