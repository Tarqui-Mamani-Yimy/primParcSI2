# Diagramas de casos de uso — Sprint 2

Este documento representa los casos de uso definidos en `planing.md`. Cada diagrama conserva los actores y el entorno indicados en esa fuente; no se agregan relaciones `include` o `extend` porque no están especificadas.

## CU1 — Registrar Cliente

```plantuml
@startuml
left to right direction
actor Cliente
rectangle "Web / Móvil" {
  usecase "CU1\nRegistrar Cliente" as CU1
}
Cliente --> CU1
@enduml
```

## CU6 — Gestionar Temporadas y Colecciones

```plantuml
@startuml
left to right direction
actor Administrador
actor "Encargado de Sucursal" as Encargado
rectangle "Web" {
  usecase "CU6\nGestionar Temporadas y Colecciones" as CU6
}
Administrador --> CU6
Encargado --> CU6
@enduml
```

## CU10 — Consultar Catálogo Multicanal

```plantuml
@startuml
left to right direction
actor "Encargado de Sucursal" as Encargado
actor Cliente
rectangle "Web / Móvil" {
  usecase "CU10\nConsultar Catálogo Multicanal" as CU10
}
Encargado --> CU10
Cliente --> CU10
@enduml
```

## CU12 — Registrar Reserva de Prendas

```plantuml
@startuml
left to right direction
actor Cliente
actor "Encargado de Sucursal" as Encargado
rectangle "Web / Móvil" {
  usecase "CU12\nRegistrar Reserva de Prendas" as CU12
}
Cliente --> CU12
Encargado --> CU12
@enduml
```

## CU13 — Consultar y Cancelar Reservas

```plantuml
@startuml
left to right direction
actor Cliente
actor "Encargado de Sucursal" as Encargado
rectangle "Web / Móvil" {
  usecase "CU13\nConsultar y Cancelar Reservas" as CU13
}
Cliente --> CU13
Encargado --> CU13
@enduml
```

## CU14 — Recepcionar y Preparar Reserva

```plantuml
@startuml
left to right direction
actor "Encargado de Sucursal" as Encargado
rectangle "Web / Móvil" {
  usecase "CU14\nRecepcionar y Preparar Reserva" as CU14
}
Encargado --> CU14
@enduml
```

## CU15 — Confirmar Recepción/Atención de Cliente

```plantuml
@startuml
left to right direction
actor "Encargado de Sucursal" as Encargado
actor Cliente
rectangle "Web / Móvil" {
  usecase "CU15\nConfirmar Recepción/Atención de Cliente" as CU15
}
Encargado --> CU15
Cliente --> CU15
@enduml
```

## CU17 — Realizar Compra Digital (Web/Móvil)

```plantuml
@startuml
left to right direction
actor Cliente
rectangle "Web / Móvil" {
  usecase "CU17\nRealizar Compra Digital (Web/Móvil)" as CU17
}
Cliente --> CU17
@enduml
```

## CU18 — Procesar Pago Electrónico

```plantuml
@startuml
left to right direction
actor Cliente
actor "Pasarela de Pago" as Pasarela
rectangle "Web / Móvil" {
  usecase "CU18\nProcesar Pago Electrónico" as CU18
}
Cliente --> CU18
Pasarela --> CU18
@enduml
```

## CU19 — Registrar Venta Presencial (POS)

```plantuml
@startuml
left to right direction
actor Cajero
rectangle "Web" {
  usecase "CU19\nRegistrar Venta Presencial (POS)" as CU19
}
Cajero --> CU19
@enduml
```

## CU20 — Procesar Pago en Caja y Emitir Comprobante

```plantuml
@startuml
left to right direction
actor Cajero
rectangle "Web" {
  usecase "CU20\nProcesar Pago en Caja y Emitir Comprobante" as CU20
}
Cajero --> CU20
@enduml
```

## CU21 — Actualizar Inventario Automáticamente

```plantuml
@startuml
left to right direction
actor "Sistema (Proceso Automático)" as Sistema
rectangle "Backend" {
  usecase "CU21\nActualizar Inventario Automáticamente" as CU21
}
Sistema --> CU21
@enduml
```
