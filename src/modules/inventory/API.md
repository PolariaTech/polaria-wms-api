# Inventory API — mapa y locking (POL-6)

Base path: `/inventario/warehouse-state`  
Swagger tag: **Inventario · Mapa (warehouse_state)**

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/inventario/warehouse-state?idBodega=` | lectura | Lista posiciones del mapa |
| POST | `/inventario/warehouse-state/:id/lock` | operario, custodio, jefe, admin bodega, configurador | Bloquea posición |
| POST | `/inventario/warehouse-state/:id/unlock` | mismos | Libera bloqueo |

**Escritura sensible:** `SensitiveWriteGuard` + bypass RLS vía Prisma.

## Locking

- Campo `version` en `warehouse_state` para control optimista (`expectedVersion` opcional en body).
- Jefe/admin/configurador puede forzar unlock o takeover de lock ajeno.
- Lock stale (>5 min): cualquier operario autorizado puede tomar la posición.

## Lectura en web

El frontend puede seguir usando Supabase Realtime para lectura; lock/unlock **siempre** vía API.

## Pendiente (fases siguientes POL-6)

- Movimientos entre slots (transferencia)
- Cola operativa / órdenes de trabajo
- FEFO automático en salidas
- Sincronización `ubicacion.estado_slot` ↔ `warehouse_state`
