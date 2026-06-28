# Módulo Purchases — SOL y OC (POL-34)

Gestión de **SolicitudCompra** y **OrdenCompra**.

Documentación completa de endpoints: [API.md](./API.md)

## SOL — `/compras/solicitudes`

Ver [API.md](./API.md#solicitudes-de-compra-sol).

## OC — `/compras/ordenes`

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/compras/ordenes` | Crear OC (desde cero o desde SOL aprobada) |
| GET | `/compras/ordenes` | Listar |
| GET | `/compras/ordenes/:id` | Detalle |
| POST | `/compras/ordenes/:id/emitir` | `borrador` → `emitida` |
| POST | `/compras/ordenes/:id/cancelar` | → `cancelada` |
| POST | `/compras/solicitudes/:id/convertir-oc` | SOL `aprobada` → OC |

Swagger: **Compras · Órdenes (OC)** en `/api/docs`.

