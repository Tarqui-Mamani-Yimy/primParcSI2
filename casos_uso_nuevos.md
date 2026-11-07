# Casos de Uso Nuevos — Medidas Reales por Prenda

## Contexto

Hoy el sistema determina si una prenda le queda al cliente (CU11, Vestidor Virtual) usando **una única tabla de talles genérica** para todo el catálogo: una talla S mide lo mismo en cualquier polera. En la realidad no es así: según la marca, el corte o el proveedor, una S puede tallar más grande o más pequeña que otra S. Estos casos de uso incorporan las medidas reales de cada prenda para que la recomendación de talla sea confiable.

## 1. Tabla Consolidada

| Código | Caso de Uso | Actores Principales | Plataforma / Canal |
| :--- | :--- | :--- | :--- |
| **CU34** | Gestionar Tabla de Medidas por Producto | Admin, Encargado de Sucursal | Web |
| **CU35** | Recomendar Talla según Medidas Reales de la Prenda | Cliente | Web / Móvil |
| **CU36** | Registrar Retroalimentación de Ajuste de la Prenda | Cliente | Web / Móvil |

---

## 2. Descripción de los Casos de Uso

### CU34 — Gestionar Tabla de Medidas por Producto
- **Actores:** Admin, Encargado de Sucursal
- **Plataforma:** Web
- **Descripción:** Permite registrar, editar y consultar las medidas reales en centímetros (pecho, largo, hombros, manga, cintura, cadera según el tipo de prenda) de cada talla de un producto. Así, la talla S de una polera puede tener medidas distintas a la talla S de otra. Si un producto no tiene tabla propia, el sistema sigue usando la tabla genérica como respaldo.

### CU35 — Recomendar Talla según Medidas Reales de la Prenda
- **Actores:** Cliente
- **Plataforma:** Web / Móvil
- **Descripción:** Compara las medidas corporales del cliente (registradas en su perfil, CU11) con la tabla de medidas propia del producto (CU34) y recomienda la talla más adecuada, indicando si la prenda le quedará ajustada, holgada o justa. Además, avisa cuando una talla "talla grande" o "talla pequeña" respecto a lo habitual (por ejemplo: "Esta polera talla pequeño; te recomendamos M en lugar de S").

### CU36 — Registrar Retroalimentación de Ajuste de la Prenda
- **Actores:** Cliente
- **Plataforma:** Web / Móvil
- **Descripción:** Después de una compra, el cliente puede indicar cómo le quedó la prenda ("me quedó pequeña", "me quedó bien", "me quedó grande"). El sistema acumula estas respuestas por producto y talla, y las muestra al encargado como indicador para ajustar la tabla de medidas (CU34). También alimenta la recomendación (CU35) con la experiencia de otros clientes. Complementa los cambios por talla de CU31.

---

## 3. Relación con Casos de Uso Existentes

- **CU11 (Vestidor Virtual):** hoy usa la tabla genérica; con CU34 y CU35 pasa a usar las medidas propias de cada prenda.
- **CU05 (Catálogo de Productos):** la tabla de medidas se gestiona como parte de la ficha del producto.
- **CU31 (Cambios y Devoluciones):** los cambios por talla son una señal de que la tabla de medidas puede estar mal calibrada; CU36 permite registrar ese motivo de forma explícita.

---

# Propuestas de Casos de Uso Extra (por decidir)

Propuestas que no están cubiertas por los casos de uso actuales. Ninguna está aprobada ni implementada todavía; se decidirá cuáles se desarrollan.

## 1. Tabla Consolidada

| Código | Caso de Uso | Actores Principales | Plataforma / Canal |
| :--- | :--- | :--- | :--- |
| **CU37** | Gestionar Promociones y Cupones de Descuento | Admin, Cliente | Web / Móvil |
| **CU38** | Generar Órdenes de Compra a Proveedores desde la Predicción de Quiebre de Stock | Encargado de Sucursal | Web |
| **CU39** | Sugerir Liquidación de Stock con Precio Dinámico | Admin | Web |
| **CU40** | Buscar Prendas por Foto | Cliente | Web / Móvil |
| **CU41** | Completar el Look con Inteligencia Artificial | Cliente | Web / Móvil |
| **CU42** | Gestionar Lista de Deseos y Alertas de Reposición o Baja de Precio | Cliente | Web / Móvil |
| **CU43** | Gestionar Programa de Fidelización por Puntos | Cliente, Cajero | Web / Móvil |

## 2. Descripción de los Casos de Uso

### CU37 — Gestionar Promociones y Cupones de Descuento
- **Actores:** Admin, Cliente
- **Plataforma:** Web / Móvil
- **Descripción:** El administrador define reglas de descuento con vigencia (2x1, porcentaje por colección o temporada, monto fijo, cupón de un solo uso o por cliente). El sistema las aplica automáticamente en la venta de caja y en el checkout del cliente, mostrando el ahorro en el comprobante.

### CU38 — Generar Órdenes de Compra a Proveedores desde la Predicción de Quiebre de Stock
- **Actores:** Encargado de Sucursal
- **Plataforma:** Web
- **Descripción:** A partir del riesgo de quiebre de stock (CU33), el sistema propone una orden de compra por proveedor con las cantidades sugeridas de reposición. El encargado la revisa, la envía y luego registra la recepción, que incrementa el inventario (CU08/CU09).

### CU39 — Sugerir Liquidación de Stock con Precio Dinámico
- **Actores:** Admin
- **Plataforma:** Web
- **Descripción:** Detecta productos con tendencia de ventas "cayendo" (CU33) y alto stock al acercarse el fin de su temporada (CU06), y sugiere un porcentaje de descuento para liquidarlos. El administrador puede aceptar la sugerencia, que se publica como promoción (CU37).

### CU40 — Buscar Prendas por Foto
- **Actores:** Cliente
- **Plataforma:** Web / Móvil
- **Descripción:** El cliente sube o toma una foto de una prenda y el sistema, mediante un modelo de visión con IA, encuentra las prendas más parecidas del catálogo que tienen stock disponible, ordenadas por similitud.

### CU41 — Completar el Look con Inteligencia Artificial
- **Actores:** Cliente
- **Plataforma:** Web / Móvil
- **Descripción:** Desde la ficha de un producto, la IA arma un conjunto (outfit) combinándolo con otras prendas del catálogo disponibles en la talla recomendada para el cliente (CU35), con la opción de agregar todo el conjunto al carrito.

### CU42 — Gestionar Lista de Deseos y Alertas de Reposición o Baja de Precio
- **Actores:** Cliente
- **Plataforma:** Web / Móvil
- **Descripción:** El cliente guarda prendas en su lista de deseos y recibe una notificación cuando vuelve a haber stock de su talla o cuando el precio baja (por ejemplo, por una promoción de CU37).

### CU43 — Gestionar Programa de Fidelización por Puntos
- **Actores:** Cliente, Cajero
- **Plataforma:** Web / Móvil
- **Descripción:** Cada compra acumula puntos según el monto. El cliente sube de nivel (Bronce, Plata, Oro) con beneficios distintos y puede canjear puntos como descuento en una venta, tanto en caja como en línea.

## 3. Relación con Casos de Uso Existentes

- **CU33 (Dashboard ML):** fuente de datos de CU38 (quiebre de stock) y CU39 (tendencia de productos).
- **CU07 (Proveedores) y CU08/CU09 (Inventario):** CU38 cierra el ciclo de compra y recepción de mercadería.
- **CU21/CU22 (Recomendaciones y Chatbot con IA):** CU40 y CU41 reutilizan la integración con Gemini.
- **CU35 (Recomendar Talla):** CU41 arma el conjunto en la talla recomendada para el cliente.
- **CU37 (Promociones):** base para CU39 (liquidación) y fuente de alertas de baja de precio en CU42.
