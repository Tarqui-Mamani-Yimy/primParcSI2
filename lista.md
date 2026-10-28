# Catálogo de Casos de Uso del Sistema

## 1. Tabla Consolidada

| Código | Caso de Uso | Actores Principales | Plataforma / Canal |
| :--- | :--- | :--- | :--- |
| **CU08** | Gestionar Inventario por Sucursal | Admin, Encargado de Sucursal | Web |
| **CU09** | Registrar Movimientos de Inventario | Encargado de Sucursal | Web |
| **CU16** | Realizar Compra Digital (Web/Móvil) | Cliente | Web / Móvil |
| **CU17** | Procesar Pago Electrónico | Cliente | Web / Móvil |
| **CU18** | Registrar Venta Presencial (POS) | Cajero | Web |
| **CU19** | Procesar Pago en Caja y Emitir Comprobante | Encargado de Sucursal | Web |
| **CU20** | Actualizar Inventario Automáticamente | Sistema | Backend / Web |
| **CU24** | Generar Reportes de Ventas e Inventarios | Admin | Web |
| **CU25** | Administrar Empresas Contratantes (Tenants) | SuperAdmin | Web |
| **CU26** | Administrar Planes y Suscripciones SaaS | SuperAdmin, Admin | Web |
| **CU27** | Consultar Catálogo y Existencias Offline | Cliente, Cajero, Encargado de Sucursal | Web (PWA) / Móvil |
| **CU28** | Registrar Venta de Contado Offline | Cajero | Web (PWA) |
| **CU29** | Registrar Reserva de Prendas Offline | Cliente | Web (PWA) / Móvil |
| **CU30** | Sincronizar Operaciones Pendientes y Gestionar Conflictos | Cajero, Encargado de Sucursal | Web (PWA) / Móvil |
| **CU31** | Gestionar Cambios y Devoluciones de Prendas de Vestir | Encargado de Sucursal, Cajero | Web |
| **CU32** | Solicitar Reportes Generativos mediante Inteligencia Artificial (Texto / Voz) | Admin | Web |
| **CU33** | Consultar Dashboard Analítico y Proyecciones de Machine Learning | Admin | Web |

---

## 2. Clasificación por Módulos Funcionales

### Módulo: Inventarios y Almacén
- **CU08 — Gestionar Inventario por Sucursal**
  - **Actores:** Admin, Encargado de Sucursal
  - **Plataforma:** Web
- **CU09 — Registrar Movimientos de Inventario**
  - **Actores:** Encargado de Sucursal
  - **Plataforma:** Web
- **CU20 — Actualizar Inventario Automáticamente**
  - **Actores:** Sistema
  - **Plataforma:** Backend / Web

### Módulo: Ventas y Punto de Venta (POS & E-Commerce)
- **CU16 — Realizar Compra Digital (Web/Móvil)**
  - **Actores:** Cliente
  - **Plataforma:** Web / Móvil
- **CU17 — Procesar Pago Electrónico**
  - **Actores:** Cliente
  - **Plataforma:** Web / Móvil
- **CU18 — Registrar Venta Presencial (POS)**
  - **Actores:** Cajero
  - **Plataforma:** Web
- **CU19 — Procesar Pago en Caja y Emitir Comprobante**
  - **Actores:** Encargado de Sucursal
  - **Plataforma:** Web
- **CU31 — Gestionar Cambios y Devoluciones de Prendas de Vestir**
  - **Actores:** Encargado de Sucursal, Cajero
  - **Plataforma:** Web

### Módulo: Operación Offline y Sincronización (PWA)
- **CU27 — Consultar Catálogo y Existencias Offline**
  - **Actores:** Cliente, Cajero, Encargado de Sucursal
  - **Plataforma:** Web (PWA) / Móvil
- **CU28 — Registrar Venta de Contado Offline**
  - **Actores:** Cajero
  - **Plataforma:** Web (PWA)
- **CU29 — Registrar Reserva de Prendas Offline**
  - **Actores:** Cliente
  - **Plataforma:** Web (PWA) / Móvil
- **CU30 — Sincronizar Operaciones Pendientes y Gestionar Conflictos**
  - **Actores:** Cajero, Encargado de Sucursal
  - **Plataforma:** Web (PWA) / Móvil

### Módulo: Administración SaaS & Multi-Tenancy
- **CU25 — Administrar Empresas Contratantes (Tenants)**
  - **Actores:** SuperAdmin
  - **Plataforma:** Web
- **CU26 — Administrar Planes y Suscripciones SaaS**
  - **Actores:** SuperAdmin, Admin
  - **Plataforma:** Web

### Módulo: Analítica, Reportes e Inteligencia Artificial
- **CU24 — Generar Reportes de Ventas e Inventarios**
  - **Actores:** Admin
  - **Plataforma:** Web
- **CU32 — Solicitar Reportes Generativos mediante Inteligencia Artificial (Texto / Voz)**
  - **Actores:** Admin
  - **Plataforma:** Web
- **CU33 — Consultar Dashboard Analítico y Proyecciones de Machine Learning**
  - **Actores:** Admin
  - **Plataforma:** Web










### Casos de Uso Identificados

#### 1. Módulo Offline y PWA / Móvil (Desafíos II, III y IV)

1. **CU01: Descargar / Actualizar Catálogo Local**
* *Descripción:* Descarga productos, variantes (tallas, colores), precios, existencias y datos de sucursal para su persistencia en IndexedDB/SQLite.


2. **CU02: Consultar Catálogo de Productos Offline**
* *Descripción:* Consulta existencias y precios locales; incluye notificación visual si los datos están potencialmente desactualizados.


3. **CU03: Registrar Reserva de Prendas Offline**
* *Descripción:* Guarda localmente la reserva con identificador único y estado "Pendiente".


4. **CU04: Registrar Venta de Contado Offline**
* *Descripción:* Registra la venta en efectivo con sus detalles (artículos, variantes, total, responsable) en almacenamiento local.


5. **CU05: Consultar Operaciones Locales Pendientes**
* *Descripción:* Lista las reservas y ventas almacenadas en el cliente que aún no han sido confirmadas por el servidor.


6. **CU06: Sincronizar Operaciones Comerciales**
* *Descripción:* Envía las operaciones pendientes al backend al recuperar la conexión a Internet; procesa confirmaciones, reintentos y rechazos (manteniendo idempotencia).


7. **CU07: Consultar Historial y Estado de Sincronización**
* *Descripción:* Visualiza el resultado de las sincronizaciones (registrada localmente, enviada, confirmada, rechazada/conflicto).


8. **CU08: Gestionar Cambio de Prendas de Vestir**
* *Descripción:* Registra y valida el cambio de una prenda previamente vendida dentro de la ventana de tiempo permitida (mencionado explícitamente en 7.2).



---

#### 2. Módulo de Reportes Generativos y Analítica con IA (Desafío V)

9. **CU09: Consultar Reporte Empresarial en Lenguaje Natural**
* *Descripción:* El usuario ingresa una solicitud por texto o voz (ej. *"ventas de septiembre agrupadas por sucursal"*); el sistema interpreta la intención, aplica filtros y consulta la BD central de su tenant.


10. **CU10: Visualizar y Exportar Reporte Dinámico**
* *Descripción:* Despliega los resultados en tablas o gráficos dinámicos y permite su exportación a Excel o PDF.


11. **CU11: Entrenar y Evaluar Modelos de Machine Learning**
* *Descripción:* Genera datos sintéticos, preprocesa variables y ejecuta el entrenamiento/validación de modelos supervisados y no supervisados (requerimiento 8.4 y 8.5).


12. **CU12: Consultar Dashboard Analítico Inteligente**
* *Descripción:* Visualiza métricas predictivas, patrones no supervisados/anomalías e indicadores clave en un panel gráfico.



---

#### 3. Módulo SaaS Multitenant y Suscripciones (Desafío VI)

13. **CU13: Registrar Empresa Contratante (Tenant)**
* *Descripción:* Da de alta una nueva empresa en la plataforma y designa su usuario administrador inicial.


14. **CU14: Gestionar Sucursales del Tenant**
* *Descripción:* Alta, baja y modificación de sucursales, validando que no exceda el límite del plan activo (hasta 2 en Básico, hasta 10 en Profesional).


15. **CU15: Gestionar Usuarios y Roles del Tenant**
* *Descripción:* Asigna empleados a sucursales respetando el aislamiento estricto por empresa.


16. **CU16: Asignar / Renovar Plan de Suscripción**
* *Descripción:* Asocia un plan (Básico o Profesional) a una empresa con fechas de inicio y vencimiento.


17. **CU17: Cambiar Plan de Suscripción (Upgrade / Downgrade)**
* *Descripción:* Modifica el nivel de suscripción de una empresa para habilitar o restringir características (ej. habilitar reportes con IA).


18. **CU18: Consultar Estado y Consumo de Suscripción**
* *Descripción:* Revisa vigencia, límites alcanzados (sucursales activas) y módulos habilitados según el plan contratado.



---

### Resumen de Trazabilidad

| Módulo | Desafíos Examen | Cantidad de CU |
| --- | --- | --- |
| **Operación Offline y Ventas** | Desafíos II, III y IV | **8** |
| **IA y Analítica Avanzada** | Desafío V | **4** |
| **SaaS Multitenant y Suscripciones** | Desafío VI | **6** |
| **Total** |  | **18** |