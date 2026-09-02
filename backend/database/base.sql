CREATE TABLE "Ciudad" (
    "idCiudad" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombCiudad" VARCHAR(100) NOT NULL
);
CREATE INDEX "idx_ciudad_nombre" ON "Ciudad" ("nombCiudad");

CREATE TABLE "permiso" (
    "idPermiso" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombrePermiso" VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE "rol" (
    "codigoRol" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombreRol" VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE "Proveedor" (
    "idProveedor" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombre" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(20),
    "correo" VARCHAR(100)
);
CREATE INDEX "idx_proveedor_nombre" ON "Proveedor" ("nombre");

CREATE TABLE "Temporada" (
    "idTemporada" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombreTemporada" VARCHAR(100) NOT NULL,
    "fecha_ini" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    CONSTRAINT "chk_temporada_fechas" CHECK ("fecha_fin" >= "fecha_ini")
);
CREATE INDEX "idx_temporada_fechas" ON "Temporada" ("fecha_ini", "fecha_fin");

CREATE TABLE "metodo_pago" (
    "idMetPago" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "tipo" VARCHAR(50) NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'Activo',
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT "chk_metodo_monto" CHECK ("monto" >= 0)
);

CREATE TABLE "asignacion_permiso" (
    "idRolPermiso" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "fechaAsignacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'Activo',
    "codigoRol" INT NOT NULL,
    "idPermiso" INT NOT NULL,
    CONSTRAINT "fk_asig_rol" FOREIGN KEY ("codigoRol") REFERENCES "rol"("codigoRol") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_asig_permiso" FOREIGN KEY ("idPermiso") REFERENCES "permiso"("idPermiso") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "uq_rol_permiso" UNIQUE ("codigoRol", "idPermiso")
);

CREATE TABLE "Usuario" (
    "idUser" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombre" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(100) NOT NULL UNIQUE,
    "contraseña" VARCHAR(255) NOT NULL,
    "codigoRol" INT NOT NULL,
    CONSTRAINT "fk_usuario_rol" FOREIGN KEY ("codigoRol") REFERENCES "rol"("codigoRol") ON UPDATE CASCADE
);

CREATE TABLE "Sucursal" (
    "codigoSucursal" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombre" VARCHAR(100) NOT NULL,
    "direccion" VARCHAR(255) NOT NULL,
    "idCiudad" INT NOT NULL,
    CONSTRAINT "fk_sucursal_ciudad" FOREIGN KEY ("idCiudad") REFERENCES "Ciudad"("idCiudad") ON UPDATE CASCADE
);
CREATE INDEX "idx_sucursal_ciudad" ON "Sucursal" ("idCiudad");

CREATE TABLE "Colecciones" (
    "idColeccion" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombre_coleccion" VARCHAR(100) NOT NULL,
    "idTemporada" INT NOT NULL,
    CONSTRAINT "fk_coleccion_temporada" FOREIGN KEY ("idTemporada") REFERENCES "Temporada"("idTemporada") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "idx_coleccion_temporada" ON "Colecciones" ("idTemporada");

-- 3. TABLAS DEPENDIENTES NIVEL 2
CREATE TABLE "Cliente" (
    "idCliente" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombre" VARCHAR(100) NOT NULL,
    "telefono" VARCHAR(20),
    "direccion" VARCHAR(255),
    "idUser" INT NOT NULL UNIQUE,
    CONSTRAINT "fk_cliente_usuario" FOREIGN KEY ("idUser") REFERENCES "Usuario"("idUser") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Bitacora" (
    "idBitacora" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "accion" VARCHAR(150) NOT NULL,
    "hora" TIME NOT NULL,
    "fecha" DATE NOT NULL,
    "ip" INET NOT NULL,
    "idUser" INT NOT NULL,
    CONSTRAINT "fk_bitacora_usuario" FOREIGN KEY ("idUser") REFERENCES "Usuario"("idUser") ON DELETE CASCADE
);
CREATE INDEX "idx_bitacora_fecha_user" ON "Bitacora" ("fecha", "idUser");

CREATE TABLE "producto" (
    "idProducto" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "costo" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    "venta" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    "tipo" VARCHAR(50),
    "talla" VARCHAR(20),
    "color" VARCHAR(50),
    "idProveedor" INT NOT NULL,
    "idColeccion" INT NOT NULL,
    CONSTRAINT "chk_producto_precios" CHECK ("venta" >= 0 AND "costo" >= 0),
    CONSTRAINT "fk_producto_proveedor" FOREIGN KEY ("idProveedor") REFERENCES "Proveedor"("idProveedor") ON UPDATE CASCADE,
    CONSTRAINT "fk_producto_coleccion" FOREIGN KEY ("idColeccion") REFERENCES "Colecciones"("idColeccion") ON UPDATE CASCADE
);
CREATE INDEX "idx_producto_busqueda" ON "producto" ("nombre", "tipo", "talla", "color");
CREATE INDEX "idx_producto_proveedor" ON "producto" ("idProveedor");
CREATE INDEX "idx_producto_coleccion" ON "producto" ("idColeccion");

CREATE TABLE "Recomendaciones" (
    "idRecomendacion" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nombre" VARCHAR(100) NOT NULL,
    "importancia" VARCHAR(30) DEFAULT 'Media',
    "idCliente" INT NOT NULL,
    CONSTRAINT "fk_recomendacion_cliente" FOREIGN KEY ("idCliente") REFERENCES "Cliente"("idCliente") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_recomendacion_cliente" ON "Recomendaciones" ("idCliente");

CREATE TABLE "Reserva" (
    "codigoReserva" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "fecha" DATE NOT NULL,
    "horario" TIME NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    "idCliente" INT NOT NULL,
    "codigoSucursal" INT NOT NULL,
    "idProducto" INT NOT NULL,
    CONSTRAINT "fk_reserva_cliente" FOREIGN KEY ("idCliente") REFERENCES "Cliente"("idCliente") ON UPDATE CASCADE,
    CONSTRAINT "fk_reserva_sucursal" FOREIGN KEY ("codigoSucursal") REFERENCES "Sucursal"("codigoSucursal") ON UPDATE CASCADE,
    CONSTRAINT "fk_reserva_producto" FOREIGN KEY ("idProducto") REFERENCES "producto"("idProducto") ON UPDATE CASCADE
);
CREATE INDEX "idx_reserva_cliente" ON "Reserva" ("idCliente");
CREATE INDEX "idx_reserva_estado_fecha" ON "Reserva" ("estado", "fecha");

CREATE TABLE "Inventario" (
    "idInv" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "cantidad_actual" INT NOT NULL DEFAULT 0,
    "cantidad_reservada" INT NOT NULL DEFAULT 0,
    "codigoSucursal" INT NOT NULL,
    "idProducto" INT NOT NULL,
    CONSTRAINT "chk_inv_cantidades" CHECK ("cantidad_actual" >= 0 AND "cantidad_reservada" >= 0),
    CONSTRAINT "fk_inv_sucursal" FOREIGN KEY ("codigoSucursal") REFERENCES "Sucursal"("codigoSucursal") ON UPDATE CASCADE,
    CONSTRAINT "fk_inv_producto" FOREIGN KEY ("idProducto") REFERENCES "producto"("idProducto") ON UPDATE CASCADE,
    CONSTRAINT "uq_sucursal_producto" UNIQUE ("codigoSucursal", "idProducto")
);

CREATE TABLE "Movimiento" (
    "idMov" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "tipo" VARCHAR(50) NOT NULL,
    "cantidad" INT NOT NULL,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" VARCHAR(255),
    "idInv" INT NOT NULL,
    CONSTRAINT "fk_movimiento_inventario" FOREIGN KEY ("idInv") REFERENCES "Inventario"("idInv") ON UPDATE CASCADE
);
CREATE INDEX "idx_movimiento_inv_fecha" ON "Movimiento" ("idInv", "fecha");

CREATE TABLE "Venta" (
    "idVenta" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    "idCliente" INT NOT NULL,
    "idMetPago" INT NOT NULL,
    CONSTRAINT "chk_venta_total" CHECK ("total" >= 0),
    CONSTRAINT "fk_venta_cliente" FOREIGN KEY ("idCliente") REFERENCES "Cliente"("idCliente") ON UPDATE CASCADE,
    CONSTRAINT "fk_venta_pago" FOREIGN KEY ("idMetPago") REFERENCES "metodo_pago"("idMetPago") ON UPDATE CASCADE
);
CREATE INDEX "idx_venta_fecha" ON "Venta" ("fecha");
CREATE INDEX "idx_venta_cliente" ON "Venta" ("idCliente");

CREATE TABLE "detalle_venta" (
    "codigoVenta" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "cantidad" INT NOT NULL,
    "precio_unitario" NUMERIC(12,2) NOT NULL,
    "idProducto" INT NOT NULL,
    "idVenta" INT NOT NULL,
    "codigoReserva" INT NULL,
    CONSTRAINT "chk_detalle_cantidad" CHECK ("cantidad" > 0),
    CONSTRAINT "fk_detalle_producto" FOREIGN KEY ("idProducto") REFERENCES "producto"("idProducto") ON UPDATE CASCADE,
    CONSTRAINT "fk_detalle_venta" FOREIGN KEY ("idVenta") REFERENCES "Venta"("idVenta") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_detalle_reserva" FOREIGN KEY ("codigoReserva") REFERENCES "Reserva"("codigoReserva") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "idx_detalle_venta" ON "detalle_venta" ("idVenta");
CREATE INDEX "idx_detalle_producto" ON "detalle_venta" ("idProducto");

CREATE TABLE "historial" (
    "codigoHistorial" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idProducto" INT NOT NULL,
    "idCliente" INT NOT NULL,
    "idVenta" INT NOT NULL,
    CONSTRAINT "fk_historial_producto" FOREIGN KEY ("idProducto") REFERENCES "producto"("idProducto") ON UPDATE CASCADE,
    CONSTRAINT "fk_historial_cliente" FOREIGN KEY ("idCliente") REFERENCES "Cliente"("idCliente") ON UPDATE CASCADE,
    CONSTRAINT "fk_historial_venta" FOREIGN KEY ("idVenta") REFERENCES "Venta"("idVenta") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_historial_busqueda" ON "historial" ("idCliente", "idProducto");