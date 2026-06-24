# Modelo operativo V2 — Prisma (POL-33)

Espejo del esquema Postgres aplicado en `polaria-wms-db` (migraciones `020`–`030`). El cliente Prisma vive en `prisma/schema.prisma` y se genera en `src/generated/prisma`.

Referencia de diseño: [modelo-operativo-v2.md](https://github.com/PolariaTech/polaria-wms-db/blob/main/docs/modelo-operativo-v2.md) y [TENANT-RLS.md](./TENANT-RLS.md).

## Convención tenant

| Alcance | Columnas | Uso |
|---------|----------|-----|
| **C** (cuenta) | `codigo_cuenta` → FK `cuenta` | Catálogos maestros compartidos entre bodegas de la misma cuenta |
| **C+B** (cuenta + bodega) | `codigo_cuenta` + `id_bodega` | Documentos operativos, layout, inventario |
| Empresa | *(no duplicar)* | `codigo_empresa` se resuelve vía join `cuenta`; no en hijos de `bodega` |

En tablas **C+B**, `codigo_cuenta` se sincroniza desde `bodega` vía trigger en BD (`layout_sync_codigo_cuenta_desde_bodega`). El backend debe validar scope con `assertOperationalTenantScope` y `applyTenantFilter` antes de escrituras Prisma (bypass RLS).

## Modelos Prisma por migración

### Fundacional (POL-2, ya en schema)

| Modelo Prisma | Tabla | Migración |
|---------------|-------|-----------|
| `Rol` | `rol` | 010 |
| `Empresa` | `empresa` | 011 |
| `Usuario` | `usuario` | 012 |
| `Cuenta` | `cuenta` | 013 |
| `Bodega` | `bodega` | 017 |
| `AsignacionBodega` | `asignacion_bodega` | 017 |

### 020 — Layout de bodega (C+B)

| Modelo | Tabla | Alcance |
|--------|-------|---------|
| `TipoUbicacion` | `tipo_ubicacion` | C+B |
| `Zona` | `zona` | C+B |
| `Ubicacion` | `ubicacion` | C+B |

### 021 — Catálogos maestros (C)

| Modelo | Tabla |
|--------|-------|
| `Proveedor` | `proveedor` |
| `Cliente` | `cliente` |
| `Producto` | `producto` |
| `Comprador` | `comprador` |
| `Planta` | `planta` |
| `Camion` | `camion` |

### 022 — Compras (C+B)

| Modelo | Tabla |
|--------|-------|
| `SolicitudCompra` | `solicitud_compra` |
| `SolicitudCompraLinea` | `solicitud_compra_linea` |
| `OrdenCompra` | `orden_compra` |
| `OrdenCompraLinea` | `orden_compra_linea` |

Enums: `EstadoSolicitudCompra`, `EstadoOrdenCompra`.

### 023 — Inventario en vivo (C+B)

| Modelo | Tabla |
|--------|-------|
| `Lote` | `lote` |
| `WarehouseState` | `warehouse_state` |

### 024 — Movimientos (C+B, append-only)

| Modelo | Tabla |
|--------|-------|
| `MovimientoInventario` | `movimiento_inventario` |

Enum: `TipoMovimiento`.

### 025 — Contadores (C + B opcional)

| Modelo | Tabla |
|--------|-------|
| `Contador` | `contador` |

`id_bodega` nullable: secuencia a nivel cuenta cuando es `NULL`.

### 026 — Auditoría operativa (C + B nullable)

| Modelo | Tabla |
|--------|-------|
| `AuditoriaOperacion` | `auditoria_operacion` |

Enum: `TipoAuditoria`. Append-only en BD.

### 027 — Procesamiento / OT (C+B)

| Modelo | Tabla |
|--------|-------|
| `OrdenTrabajo` | `orden_trabajo` |
| `OrdenTrabajoLinea` | `orden_trabajo_linea` |

Enums: `EstadoOrdenTrabajo`, `TipoOrdenTrabajo`, `TipoLineaOt`.

### 028 — Ventas / OV (C+B)

| Modelo | Tabla |
|--------|-------|
| `OrdenVenta` | `orden_venta` |
| `OrdenVentaLinea` | `orden_venta_linea` |

Enum: `EstadoOrdenVenta`.

### 029 — Transporte (C+B)

| Modelo | Tabla |
|--------|-------|
| `ViajeTransporte` | `viaje_transporte` |
| `GuiaEnvio` | `guia_envio` |
| `EvidenciaTransporte` | `evidencia_transporte` |

Enums: `EstadoViajeTransporte`, `EstadoGuiaEnvio`, `TipoEvidenciaTransporte`.

`guia_envio.codigo_cuenta` se deriva del viaje (trigger BD); no tiene FK explícita a `cuenta` en SQL.

### 030 — RLS consolidación

Sin tablas nuevas. Añade helper `auth_wms_puede_ver_fila_operativa` en BD.

## Tablas solo-backend (escritura vía NestJS)

Mutaciones **no** expuestas a PostgREST (`authenticated`). El API usa `DATABASE_URL` (rol `postgres`, bypass RLS) + guards tenant.

| Tabla | SELECT PostgREST | Escritura |
|-------|:----------------:|:---------:|
| `warehouse_state` | Sí (bodega) | **Solo backend** |
| `movimiento_inventario` | Sí (bodega) | **Solo backend** |
| `contador` | **No** | **Solo backend** |
| `auditoria_operacion` | Sí (admin cuenta / configurador) | **Solo backend** (INSERT) |

Documentos operativos (compras, OT, OV, transporte, layout): SELECT vía cliente web; INSERT/UPDATE/DELETE vía API en fases POL-4, POL-5, POL-6 (REVOKE a `authenticated` en BD).

Catálogos (`proveedor`, `cliente`, `producto`, etc.): SELECT + INSERT/UPDATE vía PostgREST para admin cuenta; DELETE solo configurador. El backend puede gestionarlos igual con validación explícita.

## Enums operativos (Prisma)

| Enum Prisma | Tipo Postgres |
|-------------|---------------|
| `EstadoSolicitudCompra` | `estado_solicitud_compra` |
| `EstadoOrdenCompra` | `estado_orden_compra` |
| `TipoMovimiento` | `tipo_movimiento` |
| `TipoAuditoria` | `tipo_auditoria` |
| `EstadoOrdenTrabajo` | `estado_orden_trabajo` |
| `TipoOrdenTrabajo` | `tipo_orden_trabajo` |
| `TipoLineaOt` | `tipo_linea_ot` |
| `EstadoOrdenVenta` | `estado_orden_venta` |
| `EstadoViajeTransporte` | `estado_viaje_transporte` |
| `EstadoGuiaEnvio` | `estado_guia_envio` |
| `TipoEvidenciaTransporte` | `tipo_evidencia_transporte` |

## Uso en código (fases siguientes)

| Ticket | Módulo API | Modelos principales |
|--------|------------|---------------------|
| POL-5 | `purchases` / ingreso | `OrdenCompra`, `MovimientoInventario`, `WarehouseState` |
| POL-6 | `inventory` / mapa | `WarehouseState`, `Ubicacion`, Realtime |
| POL-4 | `warehouses` | `TipoUbicacion`, `Zona`, `Ubicacion` |

Esta fase (**POL-33 API**) solo alinea Prisma y documentación. No incluye controllers ni servicios operativos.

## Comandos

```bash
npx prisma generate   # regenerar cliente tras cambios en schema
npm run build         # generate + nest build + tsc prisma-client
```
