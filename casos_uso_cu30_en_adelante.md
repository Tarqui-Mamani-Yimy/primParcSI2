Casos de Uso Implementados — CU30 en adelante

CU30: Sincronizar Operaciones Pendientes y Gestionar Conflictos

Nombre:
Sincronizar Operaciones Pendientes y Gestionar Conflictos
Autor:
Yimy Tarqui
Fecha:
24/10/2026
Descripción:
Permite enviar al servidor central las operaciones registradas sin conexión en el dispositivo (ventas de contado offline y reservas offline) y gestionar las que el servidor no pudo confirmar. Cada operación conserva su identificador único (UUID), que el servidor usa como clave de idempotencia para no registrarla dos veces. La sincronización se ejecuta automáticamente al recuperar la conexión, al iniciar sesión y cada 30 segundos, y también puede lanzarse a mano desde la "Cola de Sincronización", donde cada operación se muestra con su estado: "Local", "Enviado", "Confirmado" o "Rechazado por conflicto".
Actores:
Cajero, Encargado de Sucursal, Administrador.
Pre-Condiciones:
1. El usuario inició sesión con una cuenta que pertenece a una empresa.
2. Existen operaciones registradas sin conexión en el dispositivo (CU28 u otras operaciones offline).
3. El dispositivo tiene conexión con el servidor central.
Flujo normal:
1. El usuario selecciona "Cola de Sincronización" en el menú lateral, que indica la cantidad de operaciones pendientes.
2. El sistema muestra el estado de conexión ("Conectado al servidor central"), los totales "Total en Cola", "Pendientes", "Confirmadas" y "Conflictos", y la tabla de operaciones con su tipo, identificador, fecha, estado y detalle.
3. El usuario puede filtrar por "Todas", "Pendientes", "Confirmadas" o "Conflictos", o buscar con "Buscar por ID o comprobante...".
4. El usuario selecciona "Sincronizar ahora".
5. El sistema toma hasta 100 operaciones en estado "Local" o "Enviado", en orden de creación, y las marca como "Enviado".
6. El sistema envía el lote al servidor central con el UUID de cada operación.
7. El servidor procesa cada operación por separado: verifica el permiso del usuario (registrar ventas o reservas) y que el plan de la empresa incluya la funcionalidad correspondiente.
8. El servidor valida los datos de la operación y verifica el stock disponible de la sucursal.
9. El servidor registra la venta (con su pago en efectivo, el detalle, el movimiento de inventario y los puntos de fidelización) o la reserva, y guarda el resultado asociado al UUID.
10. El sistema marca cada operación aceptada como "Confirmado", guarda la venta o reserva definitiva en el dispositivo y actualiza las existencias locales con los valores del servidor.
11. El sistema descarga del servidor los cambios recientes del catálogo, existencias, reservas y ventas.
12. El sistema informa "Sincronización completada" con la cantidad de operaciones enviadas y confirmadas.
13. Opcionalmente, el usuario selecciona "Limpiar confirmadas" y el sistema elimina del dispositivo las operaciones confirmadas, informando "Operaciones limpiadas".
Flujo alternativo:
2a. Rol no autorizado: si el usuario no es Cajero, Encargado de Sucursal ni Administrador, el sistema muestra "Acceso restringido" y no muestra la cola.
4a. Sin conexión: el sistema informa "Sin conexión" con el mensaje "No es posible sincronizar sin acceso a internet." y las operaciones permanecen en estado "Local".
4b. Sincronización automática: al recuperar la conexión, al iniciar sesión o cada 30 segundos, el sistema ejecuta los pasos 5 a 11 sin intervención del usuario.
6a. Error de comunicación o tiempo de espera agotado: el sistema devuelve las operaciones enviadas al estado "Local" para reintentarlas en el siguiente ciclo, sin perder datos.
7a. Permiso o plan insuficiente: el servidor rechaza la operación y el sistema la marca como "Rechazado por conflicto" con el código del motivo.
8a. Stock insuficiente en el servidor: el servidor no registra la operación e informa el stock disponible; el sistema la marca como "Rechazado por conflicto" con el detalle "Stock insuficiente en la sucursal seleccionada" y actualiza las existencias locales con las del servidor.
8b. Datos inválidos (cliente inexistente, monto pagado distinto del total, producto o inventario no encontrado, fecha de reserva pasada, entre otros): el servidor rechaza la operación y el sistema la marca como "Rechazado por conflicto".
9a. Operación ya sincronizada: si el servidor ya registró una operación con ese UUID, devuelve el resultado guardado sin duplicarla; si el UUID se reutiliza con datos distintos, la rechaza.
12a. Operaciones con conflicto: el sistema informa "Sincronización con novedades" con la cantidad de operaciones confirmadas y con conflicto, y muestra un aviso "Operación offline requiere atención" por cada una.
12b. Reintentar conflicto: el usuario selecciona "Reintentar" en una operación rechazada; el sistema vuelve a descontar sus cantidades de las existencias locales, la pasa a "Local" y la reenvía. Si el servidor la acepta, informa "Operación sincronizada"; si no, informa "Conflicto persistente".
12c. Descartar conflicto: el usuario selecciona "Descartar" en una operación rechazada; el sistema la elimina de la cola e informa "Operación descartada".
12d. App móvil del Cliente: las reservas registradas sin conexión en la app móvil se envían automáticamente al recuperar la conexión y quedan como "confirmada", "conflicto" o "rechazada" según la respuesta del servidor.
Poscondiciones:
Las operaciones aceptadas quedan registradas una sola vez en el servidor central, asociadas a la empresa y al usuario del token de sesión, y marcadas como "Confirmado" en el dispositivo. Las operaciones rechazadas se conservan en el dispositivo con su motivo hasta que el usuario las reintente o las descarte; ninguna operación se pierde por fallas de conexión.

CU31: Gestionar Cambios y Devoluciones de Prendas de Vestir

Nombre:
Gestionar Cambios y Devoluciones de Prendas de Vestir
Autor:
Yimy Tarqui
Fecha:
27/10/2026
Descripción:
Permite registrar la devolución de prendas o el cambio de una prenda por otra a partir de una venta realizada dentro de los 30 días posteriores a la compra. El sistema reintegra las prendas devueltas al inventario de la sucursal donde se vendieron, descuenta la prenda entregada en un cambio, calcula el monto a reembolsar o la diferencia a cobrar, y registra el movimiento de dinero en efectivo o con tarjeta (Stripe) según el método de pago de la venta original. Está disponible en todos los planes.
Actores:
Administrador, Encargado de Sucursal, Cajero.
Pre-Condiciones:
1. El usuario inició sesión y su rol tiene los permisos para ver y gestionar devoluciones.
2. Existe una venta registrada de la empresa con no más de 30 días de antigüedad.
3. La venta original se pagó en efectivo o con tarjeta (Stripe).
Flujo normal:
1. El usuario selecciona "Cambios y Devoluciones" en el menú lateral y la pestaña "Nueva Operación".
2. El usuario ingresa el número de la venta en "1. Buscar Venta por ID" y selecciona "Buscar Venta".
3. El sistema muestra las prendas de la venta con las cantidades vendidas, ya devueltas y disponibles, y su precio unitario, indicando "Período de validez: 30 días desde la fecha de compra".
4. El usuario selecciona en "3. Tipo de Operación" la opción "Devolución de Prenda(s)" o "Cambio de Prenda".
5. Para una devolución, el usuario indica la cantidad a devolver de cada prenda y el sistema muestra el "Monto Total a Reembolsar:".
6. Para un cambio, el usuario selecciona la prenda a cambiar y su cantidad, busca la prenda de reemplazo por nombre, tipo o color con "Buscar", la elige con "Seleccionar" e indica su cantidad; el sistema muestra la diferencia de precio a cobrar o a reembolsar al cliente.
7. El usuario selecciona "Confirmar Devolución" o "Confirmar Cambio".
8. El sistema verifica que la venta exista, esté dentro del plazo de 30 días, tenga un método de pago admitido y que las cantidades no superen lo disponible para devolver.
9. En un cambio, el sistema verifica que la prenda de reemplazo tenga stock suficiente en la sucursal de la venta y lo reserva.
10. El sistema registra el reembolso o el cobro: en efectivo, registra el egreso o ingreso de caja de la sucursal; con tarjeta, procesa el reembolso en Stripe.
11. El sistema reintegra las prendas devueltas al inventario, descuenta la prenda de reemplazo, registra los movimientos de inventario, ajusta los puntos de fidelización de la venta y deja la operación como "Completada" en la bitácora.
12. El sistema informa "Devolución Registrada" con el monto reembolsado o "Cambio Registrado", y limpia el formulario.
13. El usuario puede consultar la pestaña "Historial de Operaciones", filtrar por tipo y estado, y ver el detalle de cada devolución o cambio.
Flujo alternativo:
2a. Número inválido: el sistema informa "Ingresá un número de venta válido.".
2b. Venta inexistente: el sistema informa "No se encontró la venta con el ID especificado.".
2c. Plazo vencido: el sistema informa "El período de devolución expiró (máximo 30 días desde la fecha de venta).".
6a. Sin resultados de búsqueda: el sistema informa "No se encontraron prendas con el término buscado.".
7a. Sin permiso de gestión: el sistema informa "Acceso denegado" con el mensaje "No tenés permisos para gestionar devoluciones." y no registra la operación.
8a. Método de pago no admitido (por ejemplo, pago QR): el sistema informa "El método de pago de la venta original no admite devoluciones automatizadas (ej. pago QR).".
8b. Cantidad excedida: el sistema informa "La cantidad a devolver excede el límite devolvible" indicando la cantidad restante.
9a. Stock de reemplazo insuficiente: el sistema informa "No hay stock suficiente en la sucursal para el producto de reemplazo seleccionado.".
10a. Diferencia a cobrar con tarjeta: el sistema abre "Cobro de Diferencia con Tarjeta"; al aprobarse el pago, confirma el cambio, lo completa e informa "Pago Confirmado".
10b. Pago con tarjeta rechazado: el sistema informa "Pago rechazado" y el cambio queda con pago pendiente.
10c. Pago con tarjeta cancelado: el sistema informa "Pago cancelado" con el mensaje "La operación quedó registrada con pago pendiente. Podés reintentarla desde el historial.".
10d. Reembolso con tarjeta no completado o fallido: la operación queda en estado "Pendiente" o "Fallida" sin mover el inventario; el usuario puede seleccionar "Reintentar" desde el historial y, al completarse, el sistema informa "Reembolso Completado".
10e. Pasarela de pagos no disponible: el sistema informa "La pasarela de pagos Stripe no está configurada." o "Error al procesar el reembolso en Stripe.".
Poscondiciones:
La devolución o el cambio queda registrado con su tipo, estado, montos y prendas; el inventario de la sucursal, los movimientos de caja o tarjeta y los puntos de fidelización quedan actualizados y la operación queda en la bitácora. Las operaciones con pago o reembolso pendiente no modifican el inventario hasta completarse.

CU32: Solicitar Reportes Generativos mediante Inteligencia Artificial (Texto / Voz)

Nombre:
Solicitar Reportes Generativos mediante Inteligencia Artificial (Texto / Voz)
Autor:
Yimy Tarqui
Fecha:
27/10/2026
Descripción:
Permite al Administrador pedir reportes escribiendo o dictando una consulta en lenguaje natural. El servicio de Inteligencia Artificial (Gemini) interpreta la consulta y elige uno de cuatro tipos de reporte fijos (ventas por período, stock bajo, productos más vendidos, y devoluciones y cambios); el sistema consulta los datos reales de la empresa, la IA redacta un resumen en español y el sistema muestra el resultado en una tabla que puede exportarse a CSV. La consulta por voz se transcribe a texto antes de procesarla.
Actores:
Administrador, Servicio de IA (Gemini), Servicio de transcripción de voz (Groq).
Pre-Condiciones:
1. El usuario inició sesión con el rol Administrador y tiene el permiso para ver reportes.
2. La empresa tiene una suscripción al plan Profesional, que incluye la funcionalidad de Inteligencia Artificial.
3. El servicio de IA está configurado en el servidor.
Flujo normal:
1. El Administrador selecciona "Reportes con IA" en el menú lateral.
2. El sistema muestra el campo de consulta y sugerencias como "Ventas por sucursal del último mes" o "Prendas con stock bajo en inventario".
3. El Administrador escribe la consulta, elige una sugerencia o la dicta por voz con el micrófono.
4. Si la consulta es por voz, el sistema captura el audio, obtiene el texto (dictado del navegador o transcripción en el servidor), lo agrega al campo de consulta e informa "Voz capturada".
5. El Administrador selecciona "Consultar Reporte".
6. El sistema muestra "Gemini está procesando tu consulta…" y envía la consulta al servicio de IA junto con la fecha actual.
7. El servicio de IA elige uno de los cuatro tipos de reporte y deduce el período y los filtros (sucursal, producto, cantidad) a partir de la consulta.
8. El sistema valida que el tipo de reporte y los filtros sean permitidos y consulta los datos reales de la empresa.
9. El servicio de IA redacta un resumen en español basado únicamente en los datos obtenidos.
10. El sistema muestra el resumen, el tipo de reporte ("Ventas por Período", "Stock Bajo", "Top Productos" o "Devoluciones y Cambios"), el período consultado y la tabla de resultados.
11. El Administrador selecciona "Exportar CSV".
12. El sistema genera el archivo CSV del reporte, lo descarga e informa "Descarga iniciada".
Flujo alternativo:
1a. Rol distinto de Administrador: el sistema muestra "Acceso Restringido" con el mensaje "Esta funcionalidad está reservada exclusivamente para usuarios con rol Administrador." y el servidor rechaza la solicitud con "Solo Admin puede solicitar reportes generativos.".
1b. Plan sin Inteligencia Artificial: la opción "Reportes con IA" no aparece en el menú y el servidor rechaza la solicitud porque la funcionalidad no está incluida en el plan.
4a. Navegador sin soporte de voz: el sistema muestra "Dictado por voz no compatible en este navegador".
4b. Permiso de micrófono denegado: el sistema informa "Error de micrófono" con el mensaje "Permiso de micrófono denegado. Habilitá el acceso al micrófono en la configuración de tu navegador.".
4c. Grabación demasiado larga: la grabación se detiene sola a los 60 segundos y el sistema informa "Límite de tiempo alcanzado".
4d. Audio vacío o demasiado grande: el sistema informa "Audio vacío" o "Audio demasiado grande" (límite de 10 MB) y no lo transcribe.
4e. Sin texto detectado: el sistema informa "Sin texto detectado" con el mensaje "No se pudo transcribir texto del audio grabado. Intentá hablar más cerca del micrófono.".
4f. Transcripción no configurada: el servidor informa "La transcripción por voz no está configurada en este servidor. Configure GROQ_API_KEY.".
5a. Consulta vacía: el sistema informa "Por favor, ingresá una consulta antes de continuar." y no envía la solicitud.
6a. Servicio de IA no configurado: el sistema informa "Gemini no está configurado en este servidor. Configure GEMINI_API_KEY.".
7a. Consulta no interpretable o tipo de reporte no permitido: el sistema muestra "No se pudo generar el reporte" con el error devuelto por el modelo Gemini y sugiere reformular la consulta.
10a. Sin datos: el sistema muestra el resumen y el mensaje "No se encontraron filas de datos para el período o filtros de esta consulta.".
Poscondiciones:
El Administrador obtiene un reporte basado solo en datos reales de su empresa, con resumen, período y tabla, y opcionalmente lo descarga en formato CSV. La IA no puede consultar datos fuera de los cuatro tipos de reporte permitidos ni de otra empresa.

CU33: Consultar Dashboard Analítico y Proyecciones de Machine Learning

Nombre:
Consultar Dashboard Analítico y Proyecciones de Machine Learning
Autor:
Yimy Tarqui
Fecha:
27/10/2026
Descripción:
Permite al Administrador consultar, dentro del dashboard, la pestaña "Proyecciones (ML)" con cuatro análisis calculados sobre los datos históricos de la empresa: el pronóstico de ventas con banda de confianza (modelo supervisado de regresión lineal con estacionalidad semanal), el riesgo de quiebre de stock con la reposición sugerida, la tendencia de ventas de cada producto (creciendo, estable o cayendo) y la segmentación de clientes por recencia, frecuencia y gasto (modelo no supervisado KMeans) en los grupos "Frecuentes", "Ocasionales" y "En riesgo".
Actores:
Administrador.
Pre-Condiciones:
1. El usuario inició sesión con el rol Administrador y tiene el permiso para ver reportes.
2. La empresa tiene una suscripción al plan Profesional, que incluye la funcionalidad de Inteligencia Artificial.
Flujo normal:
1. El Administrador abre el "Centro de Operaciones" o la vista "Indicadores" y selecciona la pestaña "Proyecciones (ML)".
2. El sistema calcula y muestra los cuatro análisis con la sucursal "Todas las sucursales (Consolidado)" y un horizonte de 30 días.
3. El sistema muestra el "Pronóstico Predictivo de Ventas": un gráfico con el historial real, el pronóstico y la banda de confianza, el "Total Proyectado" y el error medio del modelo.
4. El Administrador cambia el horizonte a "7 Días", "30 Días" o "90 Días" y el sistema recalcula el pronóstico.
5. El Administrador selecciona una sucursal y el sistema recalcula el pronóstico y el riesgo de quiebre de stock para esa sucursal.
6. El sistema muestra el "Riesgo de Quiebre de Stock" con producto, talla, sucursal, stock actual, demanda diaria, días hasta agotarse y reposición sugerida, ordenado de mayor a menor riesgo.
7. El Administrador puede activar "Solo Críticos (< 7 días)" para ver solo los productos que se agotarían en menos de 7 días.
8. El sistema muestra la "Tendencia de Productos" con las ventas de los últimos 30 días, de los 30 días previos y la pendiente de cada producto; el Administrador puede filtrar por tendencia.
9. El sistema muestra la "Segmentación de Clientes (KMeans RFM)" con cada segmento, sus promedios de recencia, frecuencia y gasto, y la lista de clientes con su segmento, días desde la última compra, cantidad de compras y monto acumulado.
10. El Administrador selecciona "Actualizar Modelos" y el sistema vuelve a calcular los cuatro análisis.
Flujo alternativo:
1a. Rol distinto de Administrador o plan sin Inteligencia Artificial: la pestaña "Proyecciones (ML)" no se muestra; si se solicita igual, el servidor la rechaza con "Solo Admin puede consultar proyecciones." o porque la funcionalidad no está incluida en el plan.
3a. Historial insuficiente para el pronóstico (menos de 28 días con ventas en el período analizado): el sistema muestra "Aún no hay suficiente historial para proyectar".
6a. Historial insuficiente para el riesgo de quiebre (menos de 14 días con ventas) o sin inventario: el sistema muestra "Aún no hay suficiente historial para proyectar".
6b. Producto sin demanda reciente: el sistema no calcula sus días hasta agotarse y lo ubica al final de la lista.
8a. Historial insuficiente para tendencias (menos de 8 semanas con ventas): el sistema muestra "Aún no hay suficiente historial para proyectar".
9a. Menos de 3 clientes con compras o sin diferencias suficientes entre ellos: el sistema muestra "Aún no hay suficiente historial para proyectar" con el mensaje "El algoritmo KMeans requiere una muestra representativa de clientes y transacciones para generar grupos diferenciados.".
10a. Error al consultar: el sistema informa "Error al cargar pronóstico de ventas" con el motivo, o "Ocurrió un error inesperado al consultar las proyecciones de Machine Learning.".
Poscondiciones:
El Administrador visualiza las proyecciones calculadas con los datos reales de su empresa en el momento de la consulta, sin modificar ningún dato del sistema.

CU34: Gestionar Tabla de Medidas por Producto

Nombre:
Gestionar Tabla de Medidas por Producto
Autor:
Yimy Tarqui
Fecha:
07/11/2026
Descripción:
Permite al Administrador y al Encargado de Sucursal registrar, editar y consultar las medidas reales en centímetros (pecho, largo, hombros, manga, cintura y cadera) de cada talla de un producto desde la sección Archivo de la web. Cada prenda puede tener su propia tabla de medidas; si un producto no tiene tabla propia, el sistema usa la tabla genérica como respaldo. Junto a la tabla se muestra el resumen de opiniones de ajuste de los clientes (CU36) para ayudar a calibrar las medidas.
Actores:
Administrador, Encargado de Sucursal.
Pre-Condiciones:
1. El usuario inició sesión con un rol que tiene el permiso "producto.editar" (Administrador o Encargado de Sucursal).
2. La empresa tiene contratado el plan Intermedio o Profesional (funcionalidad "tallas"). Sin ella, el sistema solo muestra la tabla genérica de respaldo y no permite guardar una tabla propia.
3. El producto existe en el catálogo de la empresa (CU05).
4. El dispositivo tiene conexión a Internet.
Flujo normal:
1. El usuario abre la sección Archivo y selecciona "Tabla de medidas" en la tarjeta del producto.
2. El sistema muestra "Cargando tabla de medidas..." y obtiene la tabla del producto.
3. El sistema muestra la tabla con su origen, "Tabla propia" o "Tabla genérica (respaldo)", y el resumen "Opiniones de ajuste de clientes (CU36)" con la cantidad de opiniones "Quedó pequeña", "Quedó bien" y "Quedó grande" y sus porcentajes.
4. El usuario agrega tallas con "Agregar talla" o elimina filas con "Eliminar fila".
5. El usuario ingresa por cada talla su nombre y las medidas en centímetros que apliquen al tipo de prenda, dejando en blanco las demás.
6. El usuario selecciona "Guardar".
7. El sistema valida que la tabla tenga al menos una talla, que cada talla tenga nombre y no se repita, que cada medida sea un número entre 1 y 300 cm y que cada talla tenga al menos una medida.
8. El sistema normaliza el nombre de cada talla a mayúsculas y reemplaza por completo la tabla anterior del producto con las tallas enviadas.
9. El sistema devuelve la tabla guardada ordenada por talla y la marca como "Tabla propia".
10. El sistema muestra "Tabla de medidas guardada con éxito.".
Flujo alternativo:
2a. Error al cargar: el sistema muestra "No se pudo cargar la tabla de medidas del producto." con la opción "Reintentar".
3a. Producto sin opiniones: el sistema muestra "Este producto aún no cuenta con opiniones de compra de clientes.".
3b. Alerta de ajuste: si al menos el 60% de las opiniones (con un mínimo de 3) indica que la prenda queda pequeña o grande, el sistema muestra "Alerta de ajuste detectada" y recomienda calibrar las medidas.
4a. Restablecer a genérica: el usuario selecciona "Restablecer a genérica"; el sistema pregunta "¿Desea restablecer la tabla a la versión genérica?"; al elegir "Confirmar y restablecer", elimina la tabla propia del producto y muestra "Se restableció la tabla de medidas a la versión genérica de respaldo.".
6a. Sin conexión: los botones "Guardar" y "Restablecer a genérica" quedan deshabilitados con el aviso "Operación no disponible sin conexión a internet".
7a. Tabla vacía: el sistema muestra "La tabla no tiene tallas. Para volver a la tabla genérica de respaldo, use "Restablecer a genérica"." y no guarda.
7b. Talla vacía o repetida: el sistema indica la fila con error, por ejemplo "Fila 2: La talla no puede estar vacía." o que la talla "está duplicada. Cada talla debe ser única.", y no guarda.
7c. Medida inválida: el sistema indica la fila y la medida que no es un número válido o que no está entre 1 y 300 cm, y no guarda.
7d. Talla sin medidas: el sistema indica que la fila "Debe ingresar al menos una medida (pecho, largo, hombros, manga, cintura o cadera)." y no guarda.
8a. Plan sin la funcionalidad "tallas" o error del servidor: el sistema rechaza la operación y muestra "No se pudo guardar la tabla de medidas.".
Poscondiciones:
El producto queda con su tabla de medidas propia (o vuelve a la genérica si se restableció). La tabla propia es la que usa la recomendación de talla (CU35) para ese producto.

CU35: Recomendar Talla según Medidas Reales de la Prenda

Nombre:
Recomendar Talla según Medidas Reales de la Prenda
Autor:
Yimy Tarqui
Fecha:
07/11/2026
Descripción:
Compara las medidas corporales del Cliente (pecho y cintura registradas en su perfil, CU11) con la tabla de medidas del producto (CU34) y recomienda la talla más adecuada, indicando si le quedará ajustada, justa u holgada. Avisa cuando la prenda talla más grande o más pequeña de lo habitual y muestra la experiencia de otros clientes (CU36). Está disponible en la ficha del producto de la web y en el probador virtual de la app móvil.
Actores:
Cliente.
Pre-Condiciones:
1. El Cliente inició sesión en la tienda de la empresa.
2. La empresa tiene contratado el plan Intermedio o Profesional (funcionalidad "tallas"). Sin ella, el sistema oculta la recomendación de talla.
3. El dispositivo tiene conexión a Internet.
Flujo normal:
1. El Cliente abre la ficha de un producto desde el catálogo (en la app móvil, selecciona la prenda en el probador virtual).
2. El sistema muestra la sección "Tu talla recomendada" con el mensaje "Calculando recomendación personalizada…".
3. El sistema obtiene las medidas de pecho y cintura del Cliente y la tabla de medidas del producto; si el producto no tiene tabla propia, usa la tabla genérica de respaldo.
4. El sistema compara, para cada talla, la medida de la prenda con la medida del Cliente y clasifica el ajuste como ajustada, justa u holgada.
5. El sistema elige como talla recomendada la talla con ajuste justo más cercana a las medidas del Cliente; si ninguna queda justa, la talla más pequeña que no quede ajustada.
6. El sistema compara la talla recomendada con la talla que correspondería según la tabla genérica para generar el aviso de tallaje.
7. El sistema calcula las opiniones de ajuste registradas por otros clientes para el producto.
8. El sistema muestra la talla recomendada ("Talla M", por ejemplo), la etiqueta "Ajuste" con el resultado y el mensaje "Te recomendamos la talla <talla>; te quedará <ajuste>".
9. El sistema muestra "Ajuste por talla:" con el ajuste calculado para cada talla de la tabla.
10. Si la prenda talla distinto a lo habitual, el sistema muestra el aviso, por ejemplo "Esta prenda talla pequeño; te recomendamos M en lugar de S" o "Esta prenda talla grande; te recomendamos S en lugar de M".
11. Si al menos el 60% de las opiniones (con un mínimo de 3) indica un mismo problema, el sistema muestra la nota "El <porcentaje>% de los clientes indica que esta prenda queda pequeña" (o "grande").
Flujo alternativo:
1a. Usuario que no es cliente: el sistema rechaza la consulta con "Esta función es exclusiva para clientes".
2a. Sin conexión o error al calcular: en la web, el sistema no muestra recomendación; en la app móvil, calcula un ajuste local aproximado o muestra "Sin conexión: no hay medidas para calcular el ajuste.".
3a. Cliente sin medidas registradas: el sistema muestra "Registra tus medidas en tu perfil para recibir una recomendación de talla" y el botón "Registrar mis medidas en Mi Perfil", que lo lleva a su perfil (CU11).
3b. Tabla genérica: el sistema muestra la etiqueta "Genérica" indicando que la recomendación se basa en la tabla genérica de respaldo y no muestra aviso de tallaje.
5a. Sin medidas comparables: si ninguna talla tiene medidas de pecho o cintura, el sistema muestra "Sin recomendación directa" y "No hay medidas comparables para recomendar una talla".
Poscondiciones:
El Cliente conoce la talla recomendada para la prenda y su ajuste esperado. La consulta no modifica datos.

CU36: Registrar Retroalimentación de Ajuste de la Prenda

Nombre:
Registrar Retroalimentación de Ajuste de la Prenda
Autor:
Yimy Tarqui
Fecha:
07/11/2026
Descripción:
Permite al Cliente indicar, después de una compra, cómo le quedó cada prenda ("Me quedó pequeña", "Me quedó bien" o "Me quedó grande"). El sistema acumula estas respuestas por producto y talla, las muestra al personal como indicador para calibrar la tabla de medidas (CU34) y las usa en la recomendación de talla (CU35).
Actores:
Cliente.
Pre-Condiciones:
1. El Cliente inició sesión en la tienda de la empresa.
2. La empresa tiene contratado el plan Intermedio o Profesional (funcionalidad "tallas"). Sin ella, el sistema oculta la sección de retroalimentación.
3. El Cliente compró previamente el producto sobre el que opina.
4. El dispositivo tiene conexión a Internet.
Flujo normal:
1. El Cliente abre "Mi Perfil" en la web (en la app móvil, su "Historial de Compras").
2. El sistema muestra la sección "¿Cómo te quedó?" con el mensaje "Cargando tus compras…".
3. El sistema lista los productos comprados por el Cliente con su imagen, nombre y talla, e indica la opinión ya guardada, si existe ("Guardado: Me quedó …").
4. El Cliente selecciona "Me quedó pequeña", "Me quedó bien" o "Me quedó grande" en un producto.
5. El sistema verifica que el usuario sea un cliente y que el producto pertenezca a una compra suya.
6. El sistema registra la opinión con la talla del producto y la fecha; si el Cliente ya había opinado sobre ese producto, reemplaza su opinión anterior.
7. El sistema muestra "Ajuste guardado" con el mensaje "Tu opinión sobre "<producto>" se guardó correctamente." (en la app móvil, "Gracias, guardamos cómo te quedó.").
8. El sistema actualiza en la lista la opinión guardada del producto.
Flujo alternativo:
3a. Sin compras: el sistema muestra "No tienes productos comprados pendientes de evaluar.".
4a. Sin conexión: los botones quedan deshabilitados; si se intenta opinar, el sistema muestra "Se requiere conexión a internet para opinar.".
5a. Producto no comprado: el sistema rechaza la opinión con "Solo puedes opinar sobre productos que compraste".
5b. Usuario que no es cliente: el sistema rechaza la opinión con "Esta función es exclusiva para clientes".
6a. Error al guardar: el sistema muestra "No se pudo registrar tu opinión." (en la app móvil, "No se pudo guardar tu respuesta.").
Poscondiciones:
La opinión del Cliente queda registrada (una por cliente y producto). El sistema la suma a los indicadores que el Administrador y el Encargado de Sucursal consultan en "Indicadores de ajuste" y en la tabla de medidas (CU34), y a la nota de experiencia de otros clientes de la recomendación de talla (CU35).

CU37: Gestionar Promociones y Cupones de Descuento

Nombre:
Gestionar Promociones y Cupones de Descuento
Autor:
Yimy Tarqui
Fecha:
07/11/2026
Descripción:
Permite al Administrador definir promociones automáticas con vigencia (porcentaje, monto fijo por unidad o "Lleva N Paga M") para todos los productos, un producto, una colección, una temporada o un tipo de prenda, y cupones de descuento con código, mínimo de compra, límite de usos y uso único por cliente. El sistema aplica la mejor promoción vigente a cada línea en la venta de caja y en el checkout del cliente, aplica el cupón ingresado y muestra el ahorro en el comprobante.
Actores:
Administrador, Cajero, Cliente.
Pre-Condiciones:
1. El Administrador inició sesión con el permiso "promocion.gestionar".
2. La empresa tiene contratado el plan Intermedio o Profesional (funcionalidad "promociones"). Sin ella, el sistema oculta la sección y las ventas se cobran a precio de lista.
3. El dispositivo tiene conexión a Internet.
Flujo normal:
1. El Administrador abre "Promociones y Cupones" en el menú de administración.
2. El sistema muestra las pestañas "Promociones Automáticas" y "Cupones de Descuento" con sus registros.
3. El Administrador selecciona "Nueva Promoción".
4. El Administrador ingresa el nombre, el tipo de descuento ("Porcentaje (%)", "Monto Fijo por Unidad (Bs)" o "Lleva N Paga M (NxM)") con su valor, el alcance con su referencia, las fechas de inicio y fin y si la promoción está activa, y selecciona "Guardar Promoción".
5. El sistema valida la regla de la promoción y las fechas, la registra y muestra "Promoción Creada".
6. El Administrador cambia a la pestaña "Cupones de Descuento" y selecciona "Nuevo Cupón".
7. El Administrador ingresa el código, el tipo y valor del descuento, el mínimo de compra, el límite de usos totales, las fechas de vigencia, si es de un solo uso por cliente y si está activo, y selecciona "Guardar Cupón".
8. El sistema normaliza el código a mayúsculas, verifica que no exista otro cupón con el mismo código, lo registra y muestra "Cupón Creado".
9. Durante una venta en caja (Cajero) o una compra en línea (Cliente), el sistema cotiza el ticket y aplica a cada línea la promoción vigente que otorga el mayor descuento.
10. El Cajero o el Cliente ingresa un código de cupón y selecciona "Aplicar".
11. El sistema valida el cupón (vigencia, estado, cliente asignado, mínimo de compra y límites de uso) y calcula su descuento sobre el total con promociones.
12. El sistema muestra el desglose "Subtotal", "Promociones aplicadas", "Cupón aplicado" y el total a pagar.
13. Al confirmar el pago, el sistema registra la venta con los descuentos aplicados y el uso del cupón, y el comprobante muestra "Ahorraste en promociones" y "Ahorraste con cupón".
Flujo alternativo:
2a. Editar o desactivar: el Administrador selecciona "Editar" para modificar una promoción o un cupón, o "Desactivar" para retirarlo; el sistema muestra "Promoción Desactivada" o "Cupón Desactivado" y deja de aplicarlo.
5a. Regla inválida: el sistema rechaza la promoción indicando, según el caso, "El porcentaje debe estar entre 1 y 90", "El monto fijo debe ser mayor que cero", "La promoción 2x1 requiere n > m >= 1 y no admite valor", "Debe indicar el alcance de la promoción" o "La fecha de fin debe ser posterior a la fecha de inicio".
8a. Código duplicado: el sistema muestra "Ya existe un cupón con ese código" y no registra el cupón.
8b. Cupón inválido: si el porcentaje supera 90 el sistema muestra "El porcentaje del cupón debe estar entre 1 y 90"; si el cliente asignado no existe, muestra "Cliente inexistente".
9a. Confirmación de reserva: al convertir una reserva en venta no se aplican promociones.
10a. Sin conexión: el sistema muestra "Cupones de descuento no disponibles sin conexión." y, en la venta offline, aplica solo las promociones vigentes al sincronizar (CU30).
11a. Cupón no aplicable: el sistema muestra el aviso "Cupón inválido o vencido", "No alcanza el mínimo de compra" o "Ya usaste este cupón", y no confirma la venta con ese cupón.
Poscondiciones:
Las promociones y cupones quedan registrados para la empresa. Cada venta guarda su subtotal, el descuento por promociones, el descuento por cupón y la promoción aplicada en cada línea; el uso del cupón queda registrado para controlar sus límites.

CU40: Buscar Prendas por Foto

Nombre:
Buscar Prendas por Foto
Autor:
Yimy Tarqui
Fecha:
07/11/2026
Descripción:
Permite al Cliente subir o tomar una foto de una prenda para que el sistema, mediante un modelo de visión con inteligencia artificial, encuentre las prendas más parecidas del catálogo que tienen stock disponible, ordenadas por similitud. Funciona en el catálogo de la web y en la colección de la app móvil.
Actores:
Cliente.
Pre-Condiciones:
1. El Cliente inició sesión en la tienda de la empresa.
2. La empresa tiene contratado el plan Profesional (funcionalidad "ia"). Sin ella, el sistema oculta la opción de búsqueda por foto.
3. El personal indexó las imágenes de los productos con "Indexar imágenes para búsqueda por foto" en la sección Archivo, o los productos se indexaron al guardar su imagen.
4. El dispositivo tiene conexión a Internet.
Flujo normal:
1. El Cliente selecciona "Buscar por foto" en el catálogo.
2. El sistema muestra la ventana "Buscar Prendas por Foto" con las opciones "Subir archivo" y "Tomar foto con cámara" e indica "Formatos admitidos: JPG, PNG, WEBP (máx. 5 MB)".
3. El Cliente sube una imagen, la arrastra a la ventana o toma una foto con la cámara.
4. El sistema verifica que el archivo sea una imagen de hasta 5 MB y muestra su vista previa.
5. El sistema muestra "Analizando imagen con IA y buscando similitudes…".
6. El sistema genera el vector de características visuales de la foto con el modelo de visión.
7. El sistema compara la foto con las imágenes indexadas de los productos de la empresa que tienen stock disponible y calcula su similitud.
8. El sistema muestra "Prendas similares encontradas" con hasta 8 resultados ordenados por similitud, indicando el porcentaje de similitud, el precio, la talla, el color y las unidades "en stock", y la cantidad de productos comparados.
9. El Cliente selecciona "Ver detalle" en una prenda.
10. El sistema abre la ficha del producto (en la app móvil, lo carga en el probador virtual).
Flujo alternativo:
3a. Cambiar imagen: el Cliente selecciona "Cambiar imagen" y el sistema repite la búsqueda con la nueva foto.
4a. Imagen no válida o muy pesada: el sistema muestra "La imagen no es válida o supera 5 MB" y no realiza la búsqueda.
6a. Error en la búsqueda: el sistema muestra "No se pudo realizar la búsqueda" con el detalle del error (en la app móvil, "No pudimos buscar prendas con esa foto.").
7a. Catálogo sin imágenes indexadas: el sistema muestra "El catálogo aún no tiene imágenes indexadas".
7b. Sin coincidencias con stock: el sistema muestra "No encontramos prendas parecidas con stock" y sugiere probar con otra foto, mejor iluminación o un ángulo frontal.
Poscondiciones:
El Cliente obtiene las prendas del catálogo más parecidas a su foto que tienen stock disponible. La foto no se almacena y la búsqueda no modifica datos.

CU43: Gestionar Programa de Fidelización por Puntos

Nombre:
Gestionar Programa de Fidelización por Puntos
Autor:
Yimy Tarqui
Fecha:
07/11/2026
Descripción:
Cada compra de un cliente acumula puntos según el monto pagado (1 punto por cada 10 Bs, multiplicado según el nivel). El cliente sube de nivel (Bronce, Plata, Oro) según sus puntos históricos, lo que aumenta su multiplicador, y puede canjear puntos como descuento (cada punto equivale a Bs 0,10) en una venta en caja o en línea. El cliente consulta su saldo, nivel e historial de movimientos en su perfil.
Actores:
Cliente, Cajero.
Pre-Condiciones:
1. El Cliente o el Cajero inició sesión; el Cajero tiene el permiso "venta.crear".
2. La empresa tiene contratado el plan Intermedio o Profesional (funcionalidad "fidelizacion"). Sin ella, no se ganan ni se canjean puntos y el sistema oculta la sección.
3. El dispositivo tiene conexión a Internet para canjear puntos y consultar el saldo.
Flujo normal:
1. El Cajero selecciona al cliente de la venta en el POS (o el Cliente abre el resumen de su compra en línea).
2. El sistema cotiza el ticket y muestra "Puntos de fidelización" con el saldo y el nivel del cliente ("Saldo: <saldo> pts (Nivel <nivel>)").
3. El sistema calcula los puntos máximos canjeables, que no superan el saldo ni el 50% del total a pagar.
4. El Cajero o el Cliente ingresa los "Puntos a canjear" o selecciona "Máx (<puntos>)".
5. El sistema recotiza la venta, aplica el descuento por puntos y muestra el total a pagar y los "Puntos a ganar" con la venta.
6. El Cajero o el Cliente confirma el pago con tarjeta.
7. El sistema registra la venta, descuenta los puntos canjeados del saldo y registra un movimiento "canjeado".
8. El sistema suma los puntos ganados, calculados sobre el total pagado con el multiplicador del nivel, al saldo y al acumulado histórico, y registra un movimiento "ganado".
9. El comprobante muestra "Ahorraste con puntos (<puntos> pts)" y "Puntos ganados con esta compra:".
10. El Cliente abre "Mi Perfil" y el sistema muestra "Mis Puntos y Beneficios" con el "Saldo Disponible" y su equivalente en bolivianos, el "Total Histórico Acumulado", el nivel con su multiplicador y los puntos que faltan para el próximo nivel.
11. El sistema muestra el "Historial de Movimientos" del Cliente, del más reciente al más antiguo.
Flujo alternativo:
1a. Venta en efectivo: al cobrar en efectivo, el sistema no canjea puntos, pero el cliente gana los puntos de la venta al registrarse en el servidor (CU28/CU30).
4a. Puntos superiores al permitido: el sistema muestra "Los puntos solicitados superan el saldo o el límite de canje" y no confirma la venta con esa cantidad.
4b. Sin conexión: el sistema muestra "Canje de puntos deshabilitado sin conexión." y no permite canjear.
7a. Saldo insuficiente al registrar la venta: el sistema rechaza la operación con "Saldo de puntos insuficiente".
8a. Devolución de la compra: al completarse una devolución (CU31), el sistema revierte de forma proporcional los puntos ganados y devuelve los puntos canjeados, registrando los movimientos "revertido" y "devuelto".
10a. Nivel máximo: si el Cliente es nivel Oro, el sistema muestra "¡Felicitaciones! Has alcanzado el nivel máximo de fidelización (Oro).".
11a. Sin movimientos: el sistema muestra "Aún no tienes movimientos registrados.".
Poscondiciones:
El saldo y el acumulado histórico de puntos del cliente quedan actualizados, junto con su nivel (Bronce desde 0, Plata desde 2000 y Oro desde 5000 puntos históricos). Cada canje, ganancia, reversión o devolución queda registrada como movimiento asociado a la venta.
