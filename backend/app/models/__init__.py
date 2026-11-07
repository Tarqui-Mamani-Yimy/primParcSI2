from datetime import datetime, date, time

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import INET, ARRAY
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Ciudad(Base):
    __tablename__ = "Ciudad"

    idCiudad: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombCiudad: Mapped[str] = mapped_column(String(100), nullable=False)

    sucursales: Mapped[list["Sucursal"]] = relationship(back_populates="ciudad")


class Permiso(Base):
    __tablename__ = "permiso"

    idPermiso: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombrePermiso: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class Rol(Base):
    __tablename__ = "rol"

    codigoRol: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombreRol: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    asignaciones: Mapped[list["AsignacionPermiso"]] = relationship(back_populates="rol")


class AsignacionPermiso(Base):
    __tablename__ = "asignacion_permiso"
    __table_args__ = (UniqueConstraint("codigoRol", "idPermiso", name="uq_rol_permiso"),)

    idRolPermiso: Mapped[int] = mapped_column(Integer, primary_key=True)
    fechaAsignacion: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="Activo", nullable=False)
    codigoRol: Mapped[int] = mapped_column(ForeignKey("rol.codigoRol", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    idPermiso: Mapped[int] = mapped_column(ForeignKey("permiso.idPermiso", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)

    rol: Mapped["Rol"] = relationship(back_populates="asignaciones")
    permiso: Mapped["Permiso"] = relationship()


class Usuario(Base):
    __tablename__ = "Usuario"

    idUser: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    correo: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    contraseña: Mapped[str] = mapped_column(String(255), nullable=False)
    codigoRol: Mapped[int] = mapped_column(ForeignKey("rol.codigoRol", onupdate="CASCADE"), nullable=False)
    intentosFallidos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bloqueadoHasta: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    vecesBloqueado: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    requiereActivacion: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    idEmpresa: Mapped[int | None] = mapped_column(Integer, nullable=True)

    rol: Mapped["Rol"] = relationship()


class Empresa(Base):
    __tablename__ = "Empresa"

    idEmpresa: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    logoUrl: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(String(20), nullable=False)
    stripeCustomerId: Mapped[str | None] = mapped_column(String(255))


class Plan(Base):
    __tablename__ = "Plan"

    idPlan: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), nullable=False)
    nombre: Mapped[str] = mapped_column(String(50), nullable=False)
    precioMensual: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    precioAnual: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    features: Mapped[list] = mapped_column(JSON, nullable=False)
    limites: Mapped[dict] = mapped_column(JSON, nullable=False)
    stripePriceId: Mapped[str | None] = mapped_column(String(255))
    stripePriceIdAnual: Mapped[str | None] = mapped_column(String(255))


class Suscripcion(Base):
    __tablename__ = "Suscripcion"

    idSuscripcion: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    idPlan: Mapped[int] = mapped_column(Integer, nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False)
    fechaInicio: Mapped[date] = mapped_column(Date, nullable=False)
    fechaFin: Mapped[date | None] = mapped_column(Date)
    stripeSubscriptionId: Mapped[str | None] = mapped_column(String(255))
    cancelaAlFinal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ciclo: Mapped[str] = mapped_column(String(10), default="mensual", nullable=False)


class Sucursal(Base):
    __tablename__ = "Sucursal"
    __table_args__ = (Index("idx_sucursal_ciudad", "idCiudad"),)

    codigoSucursal: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    direccion: Mapped[str] = mapped_column(String(255), nullable=False)
    idCiudad: Mapped[int] = mapped_column(ForeignKey("Ciudad.idCiudad", onupdate="CASCADE"), nullable=False)
    fechaActualizacion: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)

    ciudad: Mapped["Ciudad"] = relationship(back_populates="sucursales")
    inventarios: Mapped[list["Inventario"]] = relationship(back_populates="sucursal")


class Temporada(Base):
    __tablename__ = "Temporada"
    __table_args__ = (
        CheckConstraint("fecha_fin >= fecha_ini", name="chk_temporada_fechas"),
        Index("idx_temporada_fechas", "fecha_ini", "fecha_fin"),
    )

    idTemporada: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    nombreTemporada: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_ini: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=False)


class Colecciones(Base):
    __tablename__ = "Colecciones"
    __table_args__ = (Index("idx_coleccion_temporada", "idTemporada"),)

    idColeccion: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    nombre_coleccion: Mapped[str] = mapped_column(String(100), nullable=False)
    idTemporada: Mapped[int] = mapped_column(ForeignKey("Temporada.idTemporada", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False)

    temporada: Mapped["Temporada"] = relationship()


class Proveedor(Base):
    __tablename__ = "Proveedor"
    __table_args__ = (Index("idx_proveedor_nombre", "nombre"),)

    idProveedor: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(20))
    correo: Mapped[str | None] = mapped_column(String(100))

    productos: Mapped[list["Producto"]] = relationship(back_populates="proveedor")


class Producto(Base):
    __tablename__ = "producto"
    __table_args__ = (
        CheckConstraint("venta >= 0 AND costo >= 0", name="chk_producto_precios"),
        Index("idx_producto_busqueda", "nombre", "tipo", "talla", "color"),
        Index("idx_producto_proveedor", "idProveedor"),
        Index("idx_producto_coleccion", "idColeccion"),
    )

    idProducto: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    costo: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    venta: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    tipo: Mapped[str | None] = mapped_column(String(50))
    talla: Mapped[str | None] = mapped_column(String(20))
    color: Mapped[str | None] = mapped_column(String(50))
    idProveedor: Mapped[int] = mapped_column(ForeignKey("Proveedor.idProveedor", onupdate="CASCADE"), nullable=False)
    idColeccion: Mapped[int] = mapped_column(ForeignKey("Colecciones.idColeccion", onupdate="CASCADE"), nullable=False)

    imagen_url: Mapped[str | None] = mapped_column(Text)
    imagenes_secundarias: Mapped[list[str] | None] = mapped_column(ARRAY(Text), default=lambda: [])
    fechaActualizacion: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)

    proveedor: Mapped["Proveedor"] = relationship(back_populates="productos")
    coleccion: Mapped["Colecciones"] = relationship()
    inventarios: Mapped[list["Inventario"]] = relationship(back_populates="producto")


class Promocion(Base):
    __tablename__ = "promocion"
    __table_args__ = (
        CheckConstraint("tipo IN ('porcentaje', 'monto_fijo', 'nxm')", name="chk_promocion_tipo"),
        CheckConstraint("alcance IN ('todos', 'producto', 'coleccion', 'temporada', 'tipo')", name="chk_promocion_alcance"),
        CheckConstraint(
            "(tipo = 'porcentaje' AND valor BETWEEN 1 AND 90 AND n IS NULL AND m IS NULL) OR "
            "(tipo = 'monto_fijo' AND valor > 0 AND n IS NULL AND m IS NULL) OR "
            "(tipo = 'nxm' AND valor IS NULL AND n > m AND m >= 1)",
            name="chk_promocion_regla",
        ),
        CheckConstraint("fecha_fin >= fecha_inicio", name="chk_promocion_fechas"),
        Index("idx_promocion_empresa_vigencia", "idEmpresa", "activa", "fecha_inicio", "fecha_fin"),
    )

    idPromocion: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    valor: Mapped[float | None] = mapped_column(Numeric(12, 2))
    n: Mapped[int | None] = mapped_column(Integer)
    m: Mapped[int | None] = mapped_column(Integer)
    alcance: Mapped[str] = mapped_column(String(20), nullable=False, default="todos")
    alcance_ref: Mapped[str | None] = mapped_column(String(120))
    fecha_inicio: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    fecha_fin: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    fecha_creacion: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)


class Cupon(Base):
    __tablename__ = "cupon"
    __table_args__ = (
        UniqueConstraint("idEmpresa", "codigo", name="uq_cupon_empresa_codigo"),
        CheckConstraint("tipo IN ('porcentaje', 'monto_fijo')", name="chk_cupon_tipo"),
        CheckConstraint("valor > 0", name="chk_cupon_valor"),
        CheckConstraint("minimo_compra >= 0", name="chk_cupon_minimo"),
        CheckConstraint("usos_maximos IS NULL OR usos_maximos > 0", name="chk_cupon_usos_maximos"),
        CheckConstraint("fecha_fin >= fecha_inicio", name="chk_cupon_fechas"),
        Index("idx_cupon_empresa_codigo", "idEmpresa", "codigo"),
    )

    idCupon: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    codigo: Mapped[str] = mapped_column(String(30), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    minimo_compra: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    fecha_inicio: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    fecha_fin: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    usos_maximos: Mapped[int | None] = mapped_column(Integer)
    un_uso_por_cliente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    idCliente: Mapped[int | None] = mapped_column(ForeignKey("Cliente.idCliente", ondelete="SET NULL"))
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class CuponUso(Base):
    __tablename__ = "cupon_uso"
    __table_args__ = (
        UniqueConstraint("idVenta", name="uq_cupon_uso_venta"),
        Index("idx_cupon_uso_cliente", "idEmpresa", "idCupon", "idCliente"),
    )

    idCuponUso: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    idCupon: Mapped[int] = mapped_column(ForeignKey("cupon.idCupon", ondelete="RESTRICT"), nullable=False)
    idVenta: Mapped[int] = mapped_column(ForeignKey("Venta.idVenta", ondelete="CASCADE"), nullable=False)
    idCliente: Mapped[int | None] = mapped_column(ForeignKey("Cliente.idCliente", ondelete="SET NULL"))
    fecha: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)


class CuentaPuntos(Base):
    __tablename__ = "cuenta_puntos"
    __table_args__ = (
        CheckConstraint("saldo >= 0", name="chk_cuenta_puntos_saldo"),
        CheckConstraint("acumulado_historico >= 0", name="chk_cuenta_puntos_historico"),
    )

    idCliente: Mapped[int] = mapped_column(ForeignKey("Cliente.idCliente", ondelete="CASCADE"), primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    saldo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    acumulado_historico: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class MovimientoPuntos(Base):
    __tablename__ = "movimiento_puntos"
    __table_args__ = (Index("idx_movimiento_puntos_cliente_fecha", "idEmpresa", "idCliente", "fecha"),)

    idMovimientoPuntos: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    idCliente: Mapped[int] = mapped_column(ForeignKey("Cliente.idCliente", ondelete="CASCADE"), nullable=False)
    idVenta: Mapped[int | None] = mapped_column(ForeignKey("Venta.idVenta", ondelete="SET NULL"))
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    puntos: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    nota: Mapped[str | None] = mapped_column(Text)


class MedidaProducto(Base):
    __tablename__ = "medida_producto"
    __table_args__ = (
        UniqueConstraint("idProducto", "talla", name="uq_medida_producto_talla"),
        CheckConstraint("pecho IS NULL OR pecho > 0", name="chk_medida_producto_pecho"),
        CheckConstraint("largo IS NULL OR largo > 0", name="chk_medida_producto_largo"),
        CheckConstraint("hombros IS NULL OR hombros > 0", name="chk_medida_producto_hombros"),
        CheckConstraint("manga IS NULL OR manga > 0", name="chk_medida_producto_manga"),
        CheckConstraint("cintura IS NULL OR cintura > 0", name="chk_medida_producto_cintura"),
        CheckConstraint("cadera IS NULL OR cadera > 0", name="chk_medida_producto_cadera"),
    )

    idMedida: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    idProducto: Mapped[int] = mapped_column(
        ForeignKey("producto.idProducto", ondelete="CASCADE"), nullable=False
    )
    talla: Mapped[str] = mapped_column(String(20), nullable=False)
    pecho: Mapped[float | None] = mapped_column(Numeric(5, 1))
    largo: Mapped[float | None] = mapped_column(Numeric(5, 1))
    hombros: Mapped[float | None] = mapped_column(Numeric(5, 1))
    manga: Mapped[float | None] = mapped_column(Numeric(5, 1))
    cintura: Mapped[float | None] = mapped_column(Numeric(5, 1))
    cadera: Mapped[float | None] = mapped_column(Numeric(5, 1))


class RetroalimentacionAjuste(Base):
    __tablename__ = "retroalimentacion_ajuste"
    __table_args__ = (
        UniqueConstraint("idCliente", "idProducto", name="uq_retroalimentacion_cliente_producto"),
        CheckConstraint("resultado IN ('pequena', 'bien', 'grande')", name="chk_retroalimentacion_resultado"),
        Index("idx_retroalimentacion_empresa_producto", "idEmpresa", "idProducto"),
    )

    idRetro: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    idCliente: Mapped[int] = mapped_column(
        ForeignKey("Cliente.idCliente", ondelete="CASCADE"), nullable=False
    )
    idProducto: Mapped[int] = mapped_column(
        ForeignKey("producto.idProducto", ondelete="CASCADE"), nullable=False
    )
    talla: Mapped[str] = mapped_column(String(20), nullable=False)
    resultado: Mapped[str] = mapped_column(String(10), nullable=False)
    comentario: Mapped[str | None] = mapped_column(String(255))
    fecha: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)


class EmbeddingProducto(Base):
    __tablename__ = "embedding_producto"

    idProducto: Mapped[int] = mapped_column(
        ForeignKey("producto.idProducto", ondelete="CASCADE"), primary_key=True
    )
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    vector: Mapped[list[float]] = mapped_column(
        ARRAY(Float).with_variant(JSON, "sqlite"), nullable=False
    )
    imagen_url: Mapped[str] = mapped_column(Text, nullable=False)
    fecha: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False
    )


class Cliente(Base):
    __tablename__ = "Cliente"

    idCliente: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(20))
    direccion: Mapped[str | None] = mapped_column(String(255))
    idUser: Mapped[int] = mapped_column(ForeignKey("Usuario.idUser", ondelete="CASCADE", onupdate="CASCADE"), unique=True, nullable=False)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    altura: Mapped[int | None] = mapped_column(Integer)
    pecho: Mapped[int | None] = mapped_column(Integer)
    cintura: Mapped[int | None] = mapped_column(Integer)
    tiro: Mapped[int | None] = mapped_column(Integer)
    fechaActualizacion: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)


class Inventario(Base):
    __tablename__ = "Inventario"
    __table_args__ = (
        CheckConstraint("cantidad_reservada >= 0", name="chk_inv_cantidades"),
        UniqueConstraint("codigoSucursal", "idProducto", name="uq_sucursal_producto"),
    )

    idInv: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    cantidad_actual: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cantidad_reservada: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    codigoSucursal: Mapped[int] = mapped_column(ForeignKey("Sucursal.codigoSucursal", onupdate="CASCADE"), nullable=False)
    idProducto: Mapped[int] = mapped_column(ForeignKey("producto.idProducto", onupdate="CASCADE"), nullable=False)
    fechaActualizacion: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)

    sucursal: Mapped["Sucursal"] = relationship(back_populates="inventarios")
    producto: Mapped["Producto"] = relationship(back_populates="inventarios")
    movimientos: Mapped[list["Movimiento"]] = relationship(back_populates="inventario")


class Movimiento(Base):
    __tablename__ = "Movimiento"
    __table_args__ = (Index("idx_movimiento_inv_fecha", "idInv", "fecha"),)

    idMov: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    motivo: Mapped[str | None] = mapped_column(String(255))
    idInv: Mapped[int] = mapped_column(ForeignKey("Inventario.idInv", onupdate="CASCADE"), nullable=False)
    referencia: Mapped[str | None] = mapped_column(String(50))

    inventario: Mapped["Inventario"] = relationship(back_populates="movimientos")


class MetodoPago(Base):
    __tablename__ = "metodo_pago"

    idMetPago: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    estado: Mapped[str] = mapped_column(String(30), default="Activo", nullable=False)
    fecha: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    monto: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    stripePaymentIntentId: Mapped[str | None] = mapped_column(String(255))
    moneda: Mapped[str | None] = mapped_column(String(3))
    estadoStripe: Mapped[str | None] = mapped_column(String(30))
    origen: Mapped[str | None] = mapped_column(String(20))
    idUserPago: Mapped[int | None] = mapped_column(ForeignKey("Usuario.idUser", onupdate="CASCADE"))
    # Migracion 010 (correccion review CU12) — ligadura producto/sucursal de
    # un anticipo de reserva verificado (NULL para filas de venta/POS) y
    # marca atomica de un-solo-uso (reemplaza el chequeo por SELECT suelto).
    idProducto: Mapped[int | None] = mapped_column(ForeignKey("producto.idProducto", onupdate="CASCADE"))
    codigoSucursal: Mapped[int | None] = mapped_column(ForeignKey("Sucursal.codigoSucursal", onupdate="CASCADE"))
    consumidoEn: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))


class Reserva(Base):
    __tablename__ = "Reserva"
    __table_args__ = (
        Index("idx_reserva_cliente", "idCliente"),
        Index("idx_reserva_estado_fecha", "estado", "fecha"),
    )

    codigoReserva: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    horario: Mapped[time] = mapped_column(Time, nullable=False)
    estado: Mapped[str] = mapped_column(String(30), default="Pendiente", nullable=False)
    idCliente: Mapped[int] = mapped_column(ForeignKey("Cliente.idCliente", onupdate="CASCADE"), nullable=False)
    codigoSucursal: Mapped[int] = mapped_column(ForeignKey("Sucursal.codigoSucursal", onupdate="CASCADE"), nullable=False)
    idProducto: Mapped[int] = mapped_column(ForeignKey("producto.idProducto", onupdate="CASCADE"), nullable=False)
    # Migracion 009 (CU12) — ambas nullable, inertes para reservas anteriores.
    # "montoDeposito" es un snapshot inmutable de MetodoPago.monto al momento
    # de la verificacion: NUNCA se relee MetodoPago.monto en vivo (ver
    # migracion 009 y D3 en design.md).
    idMetPago: Mapped[int | None] = mapped_column(ForeignKey("metodo_pago.idMetPago", onupdate="CASCADE"))
    montoDeposito: Mapped[float | None] = mapped_column(Numeric(10, 2))
    fechaActualizacion: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)


class Venta(Base):
    __tablename__ = "Venta"
    __table_args__ = (
        CheckConstraint("total >= 0", name="chk_venta_total"),
        Index("idx_venta_fecha", "fecha"),
        Index("idx_venta_cliente", "idCliente"),
    )

    idVenta: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    subtotal: Mapped[float | None] = mapped_column(Numeric(12, 2))
    descuento_promociones: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    descuento_cupon: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    descuento_puntos: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    idCupon: Mapped[int | None] = mapped_column(ForeignKey("cupon.idCupon", ondelete="SET NULL"))
    puntos_canjeados: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    puntos_ganados: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    idCliente: Mapped[int] = mapped_column(ForeignKey("Cliente.idCliente", onupdate="CASCADE"), nullable=False)
    idMetPago: Mapped[int] = mapped_column(ForeignKey("metodo_pago.idMetPago", onupdate="CASCADE"), nullable=False)
    fechaActualizacion: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    origen: Mapped[str] = mapped_column(String(20), default="online", nullable=False)
    comprobanteLocal: Mapped[str | None] = mapped_column(String(100))
    discrepanciaStock: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    discrepanciaResueltaEn: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    discrepanciaNota: Mapped[str | None] = mapped_column(Text)


class OperacionIdempotente(Base):
    __tablename__ = "operacion_idempotente"
    __table_args__ = (UniqueConstraint("idEmpresa", "idUser", "clave", name="uq_operacion_idempotente_scope"),)

    idOperacion: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    idUser: Mapped[int] = mapped_column(Integer, nullable=False)
    clave: Mapped[str] = mapped_column(String(255), nullable=False)
    metodo: Mapped[str] = mapped_column(String(10), nullable=False)
    ruta: Mapped[str] = mapped_column(String(255), nullable=False)
    hashBody: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[int] = mapped_column(Integer, nullable=False)
    respuesta: Mapped[dict] = mapped_column(JSON, nullable=False)


class SyncBorrado(Base):
    __tablename__ = "sync_borrado"

    idBorrado: Mapped[int] = mapped_column("idborrado", BigInteger, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    tabla: Mapped[str] = mapped_column(String(40), nullable=False)
    idRegistro: Mapped[int] = mapped_column(BigInteger, nullable=False)
    borradoEn: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    idCliente: Mapped[int | None] = mapped_column(Integer)


class DetalleVenta(Base):
    __tablename__ = "detalle_venta"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="chk_detalle_cantidad"),
        Index("idx_detalle_venta", "idVenta"),
        Index("idx_detalle_producto", "idProducto"),
    )

    codigoVenta: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    precio_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    precio_lista: Mapped[float | None] = mapped_column(Numeric(12, 2))
    idPromocion: Mapped[int | None] = mapped_column(ForeignKey("promocion.idPromocion", ondelete="SET NULL"))
    idProducto: Mapped[int] = mapped_column(ForeignKey("producto.idProducto", onupdate="CASCADE"), nullable=False)
    idVenta: Mapped[int] = mapped_column(ForeignKey("Venta.idVenta", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    codigoReserva: Mapped[int | None] = mapped_column(ForeignKey("Reserva.codigoReserva", ondelete="SET NULL", onupdate="CASCADE"))


class Bitacora(Base):
    __tablename__ = "Bitacora"
    __table_args__ = (Index("idx_bitacora_fecha_user", "fecha", "idUser"),)

    idBitacora: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    accion: Mapped[str] = mapped_column(String(150), nullable=False)
    hora: Mapped[time] = mapped_column(Time, nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    ip: Mapped[str] = mapped_column(INET, nullable=False)
    idUser: Mapped[int] = mapped_column(ForeignKey("Usuario.idUser", ondelete="CASCADE"), nullable=False)


class Recomendaciones(Base):
    __tablename__ = "Recomendaciones"
    __table_args__ = (Index("idx_recomendacion_cliente", "idCliente"),)

    idRecomendacion: Mapped[int] = mapped_column(Integer, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    importancia: Mapped[str] = mapped_column(String(30), default="Media")
    idCliente: Mapped[int] = mapped_column(ForeignKey("Cliente.idCliente", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    # Migracion 012 (CU22) — nullable: filas creadas por staff antes de esta
    # migracion no tenian vinculo real al catalogo.
    idProducto: Mapped[int | None] = mapped_column(ForeignKey("producto.idProducto", onupdate="CASCADE"))


class Historial(Base):
    __tablename__ = "historial"
    __table_args__ = (Index("idx_historial_busqueda", "idCliente", "idProducto"),)

    codigoHistorial: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    idProducto: Mapped[int] = mapped_column(ForeignKey("producto.idProducto", onupdate="CASCADE"), nullable=False)
    idCliente: Mapped[int] = mapped_column(ForeignKey("Cliente.idCliente", onupdate="CASCADE"), nullable=False)
    idVenta: Mapped[int] = mapped_column(ForeignKey("Venta.idVenta", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)


class Devolucion(Base):
    __tablename__ = "devolucion"
    __table_args__ = (
        CheckConstraint("tipo IN ('devolucion', 'cambio')", name="chk_devolucion_tipo"),
        CheckConstraint("estado IN ('payment_pending', 'completed', 'payment_failed')", name="chk_devolucion_estado"),
        CheckConstraint('"montoReembolso" >= 0 AND "montoCobrado" >= 0', name="chk_devolucion_montos"),
    CheckConstraint('"stripeRefundAttempts" >= 0', name="chk_devolucion_refund_attempts"),
        UniqueConstraint("idEmpresa", "idDevolucion", name="uq_devolucion_empresa_id"),
        Index("idx_devolucion_empresa_fecha", "idEmpresa", "fecha"),
        Index("idx_devolucion_venta", "idEmpresa", "idVenta"),
    )

    idDevolucion: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    idVenta: Mapped[int] = mapped_column(ForeignKey("Venta.idVenta", onupdate="CASCADE"), nullable=False)
    idUser: Mapped[int] = mapped_column(ForeignKey("Usuario.idUser", onupdate="CASCADE"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    estado: Mapped[str] = mapped_column(String(30), nullable=False)
    montoReembolso: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    montoCobrado: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    metodoPago: Mapped[str | None] = mapped_column(String(30))
    stripeRefundId: Mapped[str | None] = mapped_column(String(255))
    stripeRefundAttempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stripePaymentIntentId: Mapped[str | None] = mapped_column(String(255))
    fecha: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)


class DevolucionDetalle(Base):
    __tablename__ = "devolucion_detalle"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_devolucion_detalle_quantity"),
        CheckConstraint("unit_price >= 0", name="chk_devolucion_detalle_unit_price"),
        Index("idx_devolucion_detalle_sale_item", "idEmpresa", "sale_item_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    return_id: Mapped[int] = mapped_column(ForeignKey("devolucion.idDevolucion", ondelete="CASCADE"), nullable=False)
    sale_item_id: Mapped[int] = mapped_column(ForeignKey("detalle_venta.codigoVenta", onupdate="CASCADE"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    inventory_id: Mapped[int] = mapped_column(ForeignKey("Inventario.idInv", onupdate="CASCADE"), nullable=False)


class DevolucionReemplazo(Base):
    __tablename__ = "devolucion_reemplazo"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_devolucion_reemplazo_quantity"),
        CheckConstraint("unit_price >= 0", name="chk_devolucion_reemplazo_unit_price"),
        Index("idx_devolucion_reemplazo_return", "idEmpresa", "return_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    return_id: Mapped[int] = mapped_column(ForeignKey("devolucion.idDevolucion", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("producto.idProducto", onupdate="CASCADE"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    inventory_id: Mapped[int] = mapped_column(ForeignKey("Inventario.idInv", onupdate="CASCADE"), nullable=False)


class MovimientoCaja(Base):
    __tablename__ = "movimiento_caja"
    __table_args__ = (
        CheckConstraint("kind IN ('ingreso', 'egreso')", name="chk_movimiento_caja_kind"),
        CheckConstraint("amount > 0", name="chk_movimiento_caja_amount"),
        Index("idx_movimiento_caja_return", "idEmpresa", "return_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    idEmpresa: Mapped[int] = mapped_column(Integer, nullable=False)
    return_id: Mapped[int] = mapped_column(ForeignKey("devolucion.idDevolucion", ondelete="RESTRICT"), nullable=False)
    branch_id: Mapped[int] = mapped_column(ForeignKey("Sucursal.codigoSucursal", onupdate="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("Usuario.idUser", onupdate="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    concept: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
