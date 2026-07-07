# modules/processing

Procesamiento de productos en bodega (primario → secundario con merma).

## Documentación

Ver [API.md](./API.md) para endpoints, roles y flujo alineado a frio.

## Responsabilidad

- Solicitudes de procesamiento (`SolicitudProcesamiento`)
- Asignación a procesador y transiciones de estado
- Cierre con registro de merma y movimiento de inventario
- Encolado automático en `TareaCola` tipo `procesamiento`
