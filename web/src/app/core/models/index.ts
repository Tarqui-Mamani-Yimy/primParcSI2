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

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
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
// SEASONS & COLLECTIONS (CU6 — Contrato real backend)
// ─────────────────────────────────────────────

export interface Temporada {
  idTemporada: number;
  nombreTemporada: string;
  fecha_ini: string;
  fecha_fin: string;
}

export interface TemporadaIn {
  nombreTemporada: string;
  fecha_ini: string;
  fecha_fin: string;
}

export interface Coleccion {
  idColeccion: number;
  nombre_coleccion: string;
  idTemporada: number;
  temporada_nombre: string | null;
}

export interface ColeccionIn {
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
// RESERVATIONS (Contrato real backend — CU10/CU12)
// ─────────────────────────────────────────────

export interface Reserva {
  codigoReserva: number;
  fecha: string;
  horario: string;
  estado: string;
  idCliente: number;
  codigoSucursal: number;
  idProducto: number;
  producto_nombre: string | null;
  sucursal_nombre: string | null;
}

export interface ReservaIn {
  // idCliente se omite intencionalmente: el backend lo deriva del JWT del cliente autenticado
  fecha: string;
  horario: string;
  codigoSucursal: number;
  idProducto: number;
}

// ─────────────────────────────────────────────
// SALES / PAYMENT METHODS (Contrato real backend — CU13/CU14/CU15)
// ─────────────────────────────────────────────

export interface DetalleVenta {
  codigoVenta: number;
  cantidad: number;
  precio_unitario: number;
  idProducto: number;
  producto_nombre: string | null;
  idVenta: number;
}

export interface Venta {
  idVenta: number;
  fecha: string;
  total: number;
  idCliente: number;
  idMetPago: number;
  detalles: DetalleVenta[];
}

export interface MetodoPago {
  idMetPago: number;
  tipo: string;
  estado: string;
  fecha: string;
  monto: number;
}

// ─────────────────────────────────────────────
// POS — Venta Presencial (CU19/CU20)
// ─────────────────────────────────────────────

export interface VentaIn {
  // idCliente y codigoSucursal se omiten en una compra digital del cliente
  // (CU17/CU18): el backend deriva idCliente del JWT y resuelve la sucursal
  // automaticamente (ver purchase-modal.component.ts). El POS (CU19/CU20)
  // sigue enviando ambos explicitamente.
  idCliente?: number;
  idMetPago: number;
  codigoSucursal?: number;
  items: { idProducto: number; cantidad: number }[];
}

// Línea de ticket en memoria del cliente: nunca se envía tal cual al
// servidor, solo `idProducto`/`cantidad` derivados de ella.
export interface TicketLine {
  idProducto: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  disponible: number;
}

// Cliente para el picker del registro (GET /api/customers, cliente.ver).
export interface Cliente {
  idCliente: number;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  idUser: number;
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
