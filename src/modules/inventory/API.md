# Inventory API — mapa, locking y movimientos (POL-6)

## warehouse_state

Base path: `/inventario/warehouse-state`  
Swagger tag: **Inventario · Mapa (warehouse_state)**

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/inventario/warehouse-state?idBodega=` | lectura | Lista posiciones del mapa |
| POST | `/inventario/warehouse-state/:id/lock` | operario, custodio, jefe, admin bodega, configurador | Bloquea posición |
| POST | `/inventario/warehouse-state/:id/unlock` | mismos | Libera bloqueo |

## movimientos (POL-106)

Base path: `/inventario/movimientos`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/inventario/movimientos` | Historial con filtros: `idProducto`, `idUbicacion`, `tipoMovimiento`, `idReferencia` |

## Locking (POL-104)

- Campo `version` en `warehouse_state` para control optimista (`expectedVersion` opcional en body).
- **Ejecutar OT** exige lock activo del operario en la posición origen (o lock stale).
- Jefe/admin/configurador puede forzar unlock o takeover de lock ajeno.
- Lock stale (>5 min): cualquier operario autorizado puede tomar la posición.

## FEFO (POL-102)

- OT `a_salida` y `bodega_a_bodega` auto-seleccionan `warehouse_state` por `lote.fecha_vencimiento ASC`.

## Sync estado_slot (POL-103)

- Utilidad `syncUbicacionEstadoSlot`: actualiza `ubicacion.estado_slot` según stock activo tras recepción, OT y procesamiento.

## Verificación POL-141

- Locks: `docs/MAPA-POL141.md`, `test/warehouse-state-lock.e2e-spec.ts`
- FEFO: `fefo-warehouse-state.util.spec.ts`
- Concurrencia manual: `docs/MAPA-CONCURRENCIA-POL141.md`

## Lectura en web

El frontend puede seguir usando Supabase Realtime para lectura; lock/unlock y movimientos **siempre** vía API.
