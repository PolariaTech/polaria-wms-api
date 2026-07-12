# Ventas · Órdenes de venta (OV)

## Base path

`/ventas/ordenes`

Autenticación: Bearer JWT. Validación tenant vía `assertOperationalTenantScope`.

## Listar órdenes de venta

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Lista OVs del tenant con estado actualizado |

### Query

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `codigoCuenta` | string | Requerido |
| `idBodega` | uuid | Requerido |
| `estado` | enum | Filtro opcional por estado |
| `paraSalida` | boolean | Si `true`, solo OVs `confirmada` pendientes de registrar salida (picker del jefe) |

### Respuesta

Compatible con `OrdenVentaOperadorRow` del front.

## Emitir orden de venta

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/:id/emitir` | Emite OV en borrador → `confirmada` |

### Efectos (transacción atómica)

1. `orden_venta.estado = confirmada`
2. Reserva stock: `warehouse_state.cantidad_reservada` (FIFO por lote/vencimiento)
3. `movimiento_inventario` tipo `reserva` con `tipo_referencia = orden_venta`
4. Una `orden_trabajo` + `tarea_cola` por cada asignación de slot (despacho `a_salida` o traslado `bodega_a_bodega`)

## Transiciones automáticas de estado (OV)

| Evento | Transición |
|--------|------------|
| Jefe registra salida: `POST /operaciones/ordenes-trabajo` con `tipoFlujo=a_salida` e `idOrdenVenta` | `confirmada` → `en_preparacion`; cancela OTs pendientes creadas al emitir |
| Operario ejecuta OT `a_salida` y el stock queda en slot `esPicking` | Actualiza `cantidad_despachada` por línea → `parcialmente_despachada` o `despachada`; si queda `despachada`, cancela OTs pendientes restantes de la OV |

### Vincular OT ↔ OV

`POST /operaciones/ordenes-trabajo` acepta `idOrdenVenta` (uuid) además de observaciones `OV {codigo}`.

### Respuesta emitir

Compatible con `OrdenVentaOperadorRow` del front (`idOrdenVenta`, `venta`, `cuenta`, `comprador`, `productos`, `cantidadKg`, `total`, `estado`, `fecha`, `destino`).

### Errores emitir

| Código | Caso |
|--------|------|
| 404 | OV no encontrada o fuera del tenant |
| 409 | No está en borrador, sin líneas o stock insuficiente |
| 400 | Cliente/comprador/producto inactivo |

### Migración requerida

`docs/migrations/046_orden_trabajo_orden_venta.sql` — columna `orden_trabajo.id_orden_venta`.
