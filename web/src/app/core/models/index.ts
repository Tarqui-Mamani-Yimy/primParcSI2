// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export type UserRole = 'Administrador' | 'Encargado de Sucursal' | 'Cajero' | 'Proveedor' | 'Cliente' | 'SuperAdmin';

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
  empresa?: EmpresaInfo | null;
  plan?: PlanInfo | null;
  suscripcion?: SuscripcionInfo | null;
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

export interface StockIngresoIn {
  idProducto: number;
  codigoSucursal: number;
  cantidad: number;
  idProveedor?: number | null;
  motivo?: string | null;
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

export type StaffRole = 'Administrador' | 'Encargado de Sucursal' | 'Cajero';

export interface StaffUserIn {
  nombre: string;
  email: string;
  password: string;
  rol: StaffRole;
}

export interface ChangeRoleIn {
  rol: StaffRole;
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
  // CU12: anticipo del 10% cobrado por tarjeta antes de crear la reserva.
  // Ambos son null para una reserva creada antes de la migracion 009.
  idMetPago: number | null;
  montoDeposito: number | null;
}

export interface ReservaIn {
  // idCliente se omite intencionalmente: el backend lo deriva del JWT del cliente autenticado
  fecha: string;
  horario: string;
  codigoSucursal: number;
  idProducto: number;
  idMetPago: number; // anticipo verificado (CU12) — obligatorio
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
  precio_lista?: number | null;
  idPromocion?: number | null;
}

export interface Venta {
  idVenta: number;
  fecha: string;
  total: number;
  idCliente: number;
  idMetPago: number;
  detalles: DetalleVenta[];
  origen?: string;
  comprobanteLocal?: string | null;
  discrepanciaStock?: boolean;
  discrepanciaResueltaEn?: string | null;
  discrepanciaNota?: string | null;
  subtotal?: number | null;
  descuento_promociones?: number;
  descuento_cupon?: number;
  descuento_puntos?: number;
  idCupon?: number | null;
  puntos_canjeados?: number;
  puntos_ganados?: number;
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
  codigoCupon?: string | null;
  puntos?: number | null;
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

// Línea del carrito de compras del cliente (CU16): frontend-only, nunca se
// persiste (ni backend ni localStorage). Conserva el `ProductOut` completo
// porque el modal de compra y el drawer del carrito ya lo necesitan entero
// (nombre, venta, imagen_url), evitando una re-hidratación por línea.
export interface CartLine {
  producto: ProductOut;
  cantidad: number;
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
// CITIES & BRANCHES (CU04 — Contrato real backend)
// ─────────────────────────────────────────────

export interface Ciudad {
  idCiudad: number;
  nombCiudad: string;
}

export interface CiudadIn {
  nombCiudad: string;
}

export interface Sucursal {
  codigoSucursal: number;
  nombre: string;
  direccion: string;
  idCiudad: number;
  ciudad_nombre?: string | null;
}

export interface SucursalIn {
  nombre: string;
  direccion: string;
  idCiudad: number;
}

// ─────────────────────────────────────────────
// REPORTS (CU25 — Contrato real backend)
// ─────────────────────────────────────────────

export interface ReportFiltrosOut {
  fecha_desde: string | null;
  fecha_hasta: string | null;
  codigoSucursal: number | null;
  idProducto: number | null;
}

export interface VentaReporteFila {
  idProducto: number;
  producto_nombre: string;
  codigoSucursal: number;
  sucursal_nombre: string;
  cantidad_vendida: number;
  monto: number;
}

export interface VentaReporteOut {
  filas: VentaReporteFila[];
  total_monto: number;
  total_items: number;
  filtros: ReportFiltrosOut;
}

export interface InventarioReporteFila {
  idProducto: number;
  producto_nombre: string;
  codigoSucursal: number;
  sucursal_nombre: string;
  cantidad_actual: number;
  cantidad_reservada: number;
}

export interface InventarioReporteOut {
  filas: InventarioReporteFila[];
  filtros: ReportFiltrosOut;
}

// fecha_desde/fecha_hasta son ISO date strings (YYYY-MM-DD). Inventario no
// admite filtro de fechas (es una foto del stock actual, no un histórico).
export interface SalesReportFiltros {
  fecha_desde?: string;
  fecha_hasta?: string;
  codigoSucursal?: number;
  idProducto?: number;
}

export interface InventoryReportFiltros {
  codigoSucursal?: number;
  idProducto?: number;
}

// ─────────────────────────────────────────────
// INDICADORES / DASHBOARD (CU24 — Contrato real backend)
// ─────────────────────────────────────────────

export interface KpisOut {
  total_ventas_monto: number;
  total_ventas_items: number;
  stock_total: number;
  productos_bajo_stock: number;
}

export interface VentaDiariaFila {
  fecha: string;
  monto: number;
  cantidad: number;
}

export interface VentasDiariasOut {
  dias: VentaDiariaFila[];
}

export interface TopProductoFila {
  idProducto: number;
  producto_nombre: string;
  monto: number;
  cantidad: number;
}

export interface TopProductosOut {
  productos: TopProductoFila[];
}

export interface StockSucursalFila {
  codigoSucursal: number;
  sucursal_nombre: string;
  stock_total: number;
}

export interface StockPorSucursalOut {
  sucursales: StockSucursalFila[];
}

// fecha_desde/fecha_hasta son ISO date strings (YYYY-MM-DD), opcionales
// (igual que Reports). stock-por-sucursal no admite fechas (foto actual).
export interface IndicadoresFiltros {
  fecha_desde?: string;
  fecha_hasta?: string;
}

// ─────────────────────────────────────────────
// CHAT (CU23 — Contrato real backend)
// ─────────────────────────────────────────────

export interface ChatMensaje {
  role: 'user' | 'model';
  texto: string;
}

export interface ChatIn {
  mensaje: string;
  historial: ChatMensaje[];
}

export interface ChatOut {
  respuesta: string;
  historial: ChatMensaje[];
}

export interface RecomendacionOut {
  idRecomendacion: number;
  nombre: string;
  importancia: 'Alta' | 'Media' | 'Baja';
  idCliente: number;
  idProducto: number | null;
  producto_nombre: string | null;
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

// ─────────────────────────────────────────────
// MULTITENANT & SUBSCRIPTIONS
// ─────────────────────────────────────────────

export interface EmpresaInfo {
  idEmpresa: number;
  nombre: string;
  slug: string;
  logoUrl: string | null;
}

export interface PlanLimites {
  sucursales: number | null;
  usuarios: number | null;
  productos: number | null;
}

export interface PlanInfo {
  codigo: 'basico' | 'intermedio' | 'avanzado' | string;
  nombre: string;
  features: string[];
  limites: PlanLimites;
}

export interface SuscripcionInfo {
  estado: 'activa' | 'vencida' | 'suspendida' | string;
  fechaFin: string | null;
}

export interface TenantUso {
  sucursales: number;
  usuarios: number;
  productos: number;
}

export interface TenantMeResponse {
  empresa: EmpresaInfo;
  plan: PlanInfo;
  suscripcion: SuscripcionInfo;
  uso: TenantUso;
  facturacion?: FacturacionTenant | null;
}

// ─────────────────────────────────────────────
// PLATFORM (SUPERADMIN)
// ─────────────────────────────────────────────

export type BillingCycle = 'mensual' | 'anual';

export interface PlatformPlan {
  idPlan: number;
  codigo: string;
  nombre: string;
  precioMensual: number;
  precioAnual?: number;
  features: string[];
  limites: PlanLimites;
}

export interface PlatformEmpresa {
  idEmpresa: number;
  nombre: string;
  slug: string;
  logoUrl: string | null;
  estado: string;
  plan: {
    codigo: string;
    nombre: string;
  };
  suscripcion: {
    estado: string;
    fechaFin: string | null;
  };
  uso: TenantUso;
  facturacion?: FacturacionPlatform | null;
}

// ─────────────────────────────────────────────
// STRIPE BILLING & AUTOMATIC CHARGING
// ─────────────────────────────────────────────

export interface FacturacionTenant {
  modo: 'stripe' | 'manual';
  renovacionAutomatica: boolean;
  proximoCobro: string | null;
  cancelaAlFinal: boolean;
  ciclo?: BillingCycle;
}

export interface FacturacionPlatform {
  modo: 'stripe' | 'manual';
  proximoCobro: string | null;
  ciclo?: BillingCycle;
}

export interface CheckoutRequest {
  codigoPlan: 'basico' | 'intermedio' | 'avanzado' | string;
  ciclo?: BillingCycle;
}

export interface CheckoutResponse {
  url: string;
}

export interface PortalResponse {
  url: string;
}

export type BillingErrorCode =
  | 'billing_already_active'
  | 'billing_not_configured'
  | 'stripe_not_configured';

export interface BillingErrorDetail {
  code: BillingErrorCode | string;
}

// ─────────────────────────────────────────────
// PUBLIC SIGNUP & PLANS (LANDING)
// ─────────────────────────────────────────────

export interface PublicPlan {
  codigo: string;
  nombre: string;
  precioMensual: number;
  precioAnual: number;
  features: string[];
  limites: PlanLimites;
}

export interface PublicSignupRequest {
  empresa: string;
  nombre: string;
  correo: string;
  codigoPlan: 'basico' | 'intermedio' | 'avanzado' | string;
  ciclo: BillingCycle;
}

export interface PublicSignupResponse {
  url: string;
}

export type SignupErrorCode =
  | 'email_in_use'
  | 'invalid_plan'
  | 'too_many_requests'
  | 'stripe_not_configured';

export interface SignupErrorDetail {
  code: SignupErrorCode | string;
}

export interface CreateEmpresaIn {
  nombre: string;
  slug: string;
  codigoPlan: string;
  admin: {
    nombre: string;
    correo: string;
    password: string;
  };
}

export interface UpdateEmpresaIn {
  nombre?: string;
  logoUrl?: string | null;
}

export interface ChangePlanIn {
  codigoPlan: string;
  /** CU26: optional validity end date (YYYY-MM-DD); rejected for Stripe-managed subscriptions. */
  fechaFin?: string;
}

export interface ChangeEstadoIn {
  estado: 'activa' | 'suspendida';
}

// ─────────────────────────────────────────────
// MULTITENANT HTTP ERRORS (403)
// ─────────────────────────────────────────────

export interface FeatureNotInPlanErrorDetail {
  code: 'feature_not_in_plan';
  feature: string;
}

export interface PlanLimitReachedErrorDetail {
  code: 'plan_limit_reached';
  recurso: string;
  limite: number;
}

export interface SubscriptionInactiveErrorDetail {
  code: 'subscription_inactive';
  estado: 'suspendida' | string;
}

export type MultitenantErrorDetail =
  | FeatureNotInPlanErrorDetail
  | PlanLimitReachedErrorDetail
  | SubscriptionInactiveErrorDetail;

// ─────────────────────────────────────────────
// OFFLINE SYNC MODELS (Fase 2 Offline Mode)
// ─────────────────────────────────────────────

export interface SyncDeleted {
  productos: number[];
  inventario: number[];
  reservas: number[];
}

export interface SyncPullResponse {
  serverTime: string;
  full: boolean;
  productos: ProductOut[];
  sucursales: CachedSucursal[];
  inventario: CachedInventario[];
  reservas: CachedReserva[];
  ventas: CachedVenta[];
  cliente: CachedCliente | null;
  deleted: SyncDeleted;
}

export interface CachedSucursal {
  codigoSucursal: number;
  idEmpresa: number;
  nombre: string;
  direccion: string;
  idCiudad: number;
  fechaActualizacion?: string;
  ciudad?: string;
}

export interface CachedInventario {
  idInv: number;
  idEmpresa: number;
  cantidad_actual: number;
  cantidad_reservada: number;
  codigoSucursal: number;
  idProducto: number;
  fechaActualizacion?: string;
}

export interface CachedReserva {
  codigoReserva: number;
  idEmpresa: number;
  fecha: string;
  horario: string;
  estado: string;
  idCliente: number;
  codigoSucursal: number;
  idProducto: number;
  idMetPago?: number | null;
  montoDeposito?: number | null;
  fechaActualizacion?: string;
  producto_nombre?: string;
  sucursal_nombre?: string;
}

export interface CachedVenta {
  idVenta: number;
  idEmpresa: number;
  fecha: string;
  total: number;
  idCliente: number;
  idMetPago: number;
  fechaActualizacion?: string;
  origen: string;
  comprobanteLocal?: string | null;
  discrepanciaStock: boolean;
  discrepanciaResueltaEn?: string | null;
  discrepanciaNota?: string | null;
  detalles?: any[];
}

export interface CachedCliente {
  idCliente: number;
  nombre: string;
  telefono?: string | null;
  direccion?: string | null;
  idUser: number;
  idEmpresa: number;
  altura?: number | null;
  pecho?: number | null;
  cintura?: number | null;
  tiro?: number | null;
  fechaActualizacion?: string;
}

export interface CachedMeta {
  key: string;
  value: string;
}

// ─────────────────────────────────────────────
// OFFLINE OUTBOX & PHASE 3 MODELS
// ─────────────────────────────────────────────

export type PendingOpStatus = 'pending' | 'sending' | 'failed' | 'done';
export type PendingOpType = 'pos_sale' | 'reservation' | 'customer_profile';

export interface PendingOp {
  id: string; // uuid, also used as Idempotency-Key
  type: PendingOpType | string;
  payload: any;
  createdAt: string; // ISO 8601
  lastAttemptAt?: string | null; // ISO 8601 of last retry attempt
  status: PendingOpStatus;
  attempts: number;
  lastError: string | null;
}

export interface OfflineSaleItem {
  idProducto: number;
  cantidad: number;
}

export interface OfflineSalePayment {
  tipo: 'Efectivo' | string;
  monto: number;
}

export interface OfflineSaleIn {
  idLocal: string; // uuid
  comprobanteLocal: string; // e.g. "OFF-0001"
  fechaLocal: string; // ISO 8601
  codigoSucursal: number;
  idCliente: number | null;
  pago: OfflineSalePayment;
  items: OfflineSaleItem[];
}

export interface ResolveDiscrepancyIn {
  nota: string;
}

export interface ResolveDiscrepancyOut {
  idVenta: number;
  discrepanciaStock: boolean;
  discrepanciaResueltaEn: string | null;
  discrepanciaNota: string | null;
}

// ─────────────────────────────────────────────
// DASHBOARD ML PROJECTIONS (CU33, S2-S5)
// ─────────────────────────────────────────────

export interface MLHistoryPoint {
  date: string;
  amount: number;
  units: number;
}

export interface MLForecastPoint {
  date: string;
  amount: number;
  lower: number;
  upper: number;
}

export interface MLModelInfo {
  name: string;
  mae: number;
}

export interface MLSalesForecastOut {
  insufficient_data: boolean;
  history: MLHistoryPoint[];
  forecast: MLForecastPoint[];
  total_forecast_amount: number;
  model?: MLModelInfo;
}

export interface MLStockoutItem {
  product_id: number;
  product_name: string;
  talla?: string | null;
  branch_id?: number;
  branch_name?: string;
  current_stock: number;
  daily_demand: number;
  days_to_stockout: number;
  suggested_restock: number;
}

export interface MLStockoutRiskOut {
  insufficient_data: boolean;
  items: MLStockoutItem[];
}

export type MLProductTrend = 'creciendo' | 'estable' | 'cayendo';

export interface MLProductTrendItem {
  product_id: number;
  product_name: string;
  trend: MLProductTrend;
  slope: number;
  units_last_30: number;
  units_prev_30: number;
}

export interface MLProductTrendsOut {
  insufficient_data: boolean;
  items: MLProductTrendItem[];
}

export interface MLCustomerSegmentSummary {
  segment: string;
  label: string;
  customers: number;
  avg_recency_days: number;
  avg_frequency: number;
  avg_amount: number;
}

export interface MLCustomerSegmentItem {
  customer_id: number;
  name: string;
  segment: string;
  recency_days: number;
  frequency: number;
  monetary: number;
}

export interface MLCustomerSegmentsOut {
  insufficient_data: boolean;
  segments: MLCustomerSegmentSummary[];
  customers: MLCustomerSegmentItem[];
}

// ─────────────────────────────────────────────
// SIZE CHART (CU34 - Tabla de Medidas por Producto)
// ─────────────────────────────────────────────

export interface MedidaTalla {
  talla: string;
  pecho: number | null;
  largo: number | null;
  hombros: number | null;
  manga: number | null;
  cintura: number | null;
  cadera: number | null;
}

export interface SizeChartResponse {
  idProducto: number;
  fuente: 'propia' | 'generica';
  tallas: MedidaTalla[];
}

export interface SizeChartUpdatePayload {
  tallas: MedidaTalla[];
}

// ─────────────────────────────────────────────
// SIZE RECOMMENDATION & FIT FEEDBACK (CU35 + CU36)
// ─────────────────────────────────────────────

export type AjusteTipo = 'ajustada' | 'justa' | 'holgada';
export type FitResultado = 'pequena' | 'bien' | 'grande';

export interface SizeRecommendationOut {
  idProducto: number;
  fuente: 'propia' | 'generica';
  sin_medidas: boolean;
  medidas_cliente: {
    pecho: number | null;
    cintura: number | null;
  };
  talla_recomendada: string | null;
  ajuste: AjusteTipo | null;
  mensaje: string;
  aviso_talla: string | null;
  tallas: Array<{
    talla: string;
    ajuste: AjusteTipo;
  }>;
  retroalimentacion: {
    total: number;
    pequena: number;
    bien: number;
    grande: number;
    nota: string | null;
  };
}

export interface FitFeedbackIn {
  resultado: FitResultado;
  comentario?: string | null;
}

export interface ClientFitFeedbackItem {
  idProducto: number;
  nombre: string;
  talla: string;
  imagen_url: string | null;
  resultado: FitResultado | null;
  fecha: string | null;
}

export interface FitFeedbackSummaryItem {
  idProducto: number;
  nombre: string;
  talla: string;
  total: number;
  pequena: number;
  bien: number;
  grande: number;
  alerta: boolean;
}

// ─────────────────────────────────────────────
// BÚSQUEDA VISUAL / FOTO (CU40 / S6, S7, S8)
// ─────────────────────────────────────────────

export interface VisualSearchResultItem {
  idProducto: number;
  nombre: string;
  talla: string | null;
  color: string | null;
  venta: number;
  imagen_url: string | null;
  similitud: number;
  stock_total: number;
}

export interface VisualSearchResponse {
  resultados: VisualSearchResultItem[];
  indexados: number;
}

export interface VisualReindexResponse {
  indexados: number;
  omitidos: number;
  errores: number;
}

// ─────────────────────────────────────────────
// PROMOTIONS & COUPONS (CU37) & LOYALTY (CU43)
// ─────────────────────────────────────────────

export type PromotionTipo = 'porcentaje' | 'monto_fijo' | 'nxm';
export type PromotionAlcance = 'todos' | 'producto' | 'coleccion' | 'temporada' | 'tipo';

export interface Promocion {
  idPromocion: number;
  idEmpresa: number;
  nombre: string;
  tipo: PromotionTipo;
  valor: number | null;
  n: number | null;
  m: number | null;
  alcance: PromotionAlcance;
  alcance_ref: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  activa: boolean;
  fecha_creacion?: string;
  productos?: number[] | null;
}

export interface PromocionIn {
  nombre: string;
  tipo: PromotionTipo;
  valor?: number | null;
  n?: number | null;
  m?: number | null;
  alcance: PromotionAlcance;
  alcance_ref?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  activa?: boolean;
}

export type CuponTipo = 'porcentaje' | 'monto_fijo';

export interface Cupon {
  idCupon: number;
  idEmpresa: number;
  codigo: string;
  tipo: CuponTipo;
  valor: number;
  minimo_compra: number;
  fecha_inicio: string;
  fecha_fin: string;
  usos_maximos: number | null;
  un_uso_por_cliente: boolean;
  idCliente: number | null;
  activo: boolean;
}

export interface CuponIn {
  codigo: string;
  tipo: CuponTipo;
  valor: number;
  minimo_compra?: number;
  fecha_inicio: string;
  fecha_fin: string;
  usos_maximos?: number | null;
  un_uso_por_cliente?: boolean;
  idCliente?: number | null;
  activo?: boolean;
}

export interface QuoteItemIn {
  idProducto: number;
  cantidad: number;
}

export interface QuoteRequest {
  items: QuoteItemIn[];
  idCliente?: number | null;
  codigoCupon?: string | null;
  puntos?: number | null;
}

export interface QuoteLineOut {
  idProducto: number;
  cantidad: number;
  precio_lista: number;
  idPromocion: number | null;
  descuento_promocion: number;
  precio_unitario: number;
}

export interface LoyaltyAccountQuote {
  saldo: number;
  nivel: 'Bronce' | 'Plata' | 'Oro';
  puntos_max_canjeables: number;
}

export interface QuoteResponse {
  lineas?: QuoteLineOut[];
  items?: QuoteLineOut[];
  subtotal: number;
  descuento_promociones: number;
  descuento_cupon: number;
  descuento_puntos: number;
  total: number;
  idCupon: number | null;
  puntos_canjeados: number;
  puntos_a_ganar: number;
  avisos: string[];
  cuenta?: LoyaltyAccountQuote | null;
}

export interface LoyaltyMovement {
  idMovimientoPuntos: number;
  tipo: 'ganado' | 'canjeado' | 'revertido' | 'devuelto';
  puntos: number;
  fecha: string;
  nota: string | null;
}

export interface LoyaltyMeResponse {
  saldo: number;
  acumulado_historico: number;
  nivel: 'Bronce' | 'Plata' | 'Oro';
  multiplicador: number;
  siguiente_nivel: 'Plata' | 'Oro' | null;
  puntos_para_siguiente: number;
  movimientos: LoyaltyMovement[];
}

export interface LoyaltyCustomerResponse {
  saldo: number;
  acumulado_historico: number;
  nivel: 'Bronce' | 'Plata' | 'Oro';
  multiplicador: number;
  siguiente_nivel: 'Plata' | 'Oro' | null;
  puntos_para_siguiente: number;
}





