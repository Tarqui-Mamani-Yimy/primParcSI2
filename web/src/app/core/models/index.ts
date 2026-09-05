// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export type UserRole = 'Administrador' | 'Encargado de Sucursal' | 'Cajero' | 'Proveedor' | 'Cliente';

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
// PRODUCTS (Contrato real backend)
// ─────────────────────────────────────────────

export interface ProductOut {
  idProducto: number;
  nombre: string;
  descripcion: string | null;
  costo: number;
  venta: number;
  tipo: string | null;
  talla: string | null;
  color: string | null;
  idProveedor: number;
  idColeccion: number;
  proveedor_nombre: string;
  coleccion_nombre: string;
  imagen_url: string | null;
  imagenes_secundarias: string[];
}

export interface PaginatedProducts {
  items: ProductOut[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ProductoIn {
  nombre: string;
  descripcion?: string | null;
  costo: number;
  venta: number;
  tipo?: string | null;
  talla?: string | null;
  color?: string | null;
  idProveedor: number;
  idColeccion: number;
  imagen_url?: string | null;
  imagenes_secundarias?: string[];
}

export interface ProveedorOption {
  idProveedor: number;
  nombre: string;
}

export interface Proveedor {
  idProveedor: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
}

export interface ProveedorIn {
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
}

export interface ColeccionOption {
  idColeccion: number;
  nombre_coleccion: string;
  idTemporada: number;
}

// ─────────────────────────────────────────────
// INVENTORY (Contrato real backend)
// ─────────────────────────────────────────────

export interface InventoryLocation {
  codigoSucursal: number;
  nombre: string;
  direccion: string;
  ciudad: string;
}

export interface InventoryStockEntry {
  idInv: number;
  cantidad_actual: number;
  cantidad_reservada: number;
  codigoSucursal: number;
  sucursal_nombre: string;
  idProducto: number;
  producto_nombre: string;
  producto_tipo: string;
  producto_talla: string;
  producto_color: string;
  producto_imagen: string;
}

export interface StockAdjustIn {
  cantidad: number;
  tipo?: string;
  motivo?: string | null;
  signo: 'set' | 'add' | 'subtract';
}

// ─────────────────────────────────────────────
// DISPATCHES (Contrato real backend)
// ─────────────────────────────────────────────

export interface DispatchItem {
  idProducto: number;
  cantidad: number;
}

export interface DispatchIn {
  origen: number;
  destino: number;
  items: DispatchItem[];
  motivo?: string | null;
}

export interface DispatchMovement {
  idMov: number;
  tipo: string;
  cantidad: number;
  fecha: string;
  motivo: string | null;
  idInv: number;
  sucursal_nombre: string;
  idProducto: number;
  producto_nombre: string;
}

export interface DispatchOut {
  referencia: string;
  motivo: string | null;
  fecha: string;
  movimientos: DispatchMovement[];
}

// ─────────────────────────────────────────────
// TEAM
// ─────────────────────────────────────────────

export interface TeamMember {
  idUser: number;
  nombre: string;
  correo: string;
  rol: UserRole;
  permisos: string[];
}

export interface AuditLogEntry {
  idBitacora: number;
  accion: string;
  hora: string;
  fecha: string;
  ip: string;
  idUser: number;
  usuario_nombre: string;
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
