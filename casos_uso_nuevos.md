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
