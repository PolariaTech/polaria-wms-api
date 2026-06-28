# Módulo Configuración

Endpoints de configuración operativa del tenant (layout de bodegas, etc.).

## POST /configuracion/bodegas/:idBodega/bootstrap-layout

Genera el layout inicial de una **bodega interna** según el esquema `020_warehouse_layout` (`tipo_ubicacion`, `zona`, `ubicacion`).

### Autorización

- Bearer JWT (Supabase)
- `JwtAuthGuard` + `TenantGuard` + `RolesGuard`
- Roles: `configurador` (cualquier tenant) | `administrador_cuenta` (solo bodegas de su `codigoCuenta`)

### Parámetros

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `idBodega` | uuid (path) | Bodega interna a configurar |

### Qué crea (transacción Prisma)

| Entidad | Detalle |
|---------|---------|
| `tipo_ubicacion` INGRESO | `es_recepcion=true`, `es_almacenamiento=false` |
| `tipo_ubicacion` ALMACEN | `es_almacenamiento=true` |
| `zona` GENERAL | Nombre visible: **General** |
| `ubicacion` × N | Códigos `SLOT-001` … `SLOT-N`, tipo ALMACEN, zona General |

`N` = `capacidad_slots` de la bodega (default **1**, máximo **500**).

### Idempotencia

Si la bodega **ya tiene ubicaciones**, responde **409 Conflict** sin modificar datos.

### Response 201

```json
{
  "idBodega": "550e8400-e29b-41d4-a716-446655440000",
  "codigoCuenta": "CTA001",
  "capacidadSlots": 50,
  "tiposUbicacionCreados": 2,
  "zonasCreadas": 1,
  "ubicacionesCreadas": 50
}
```

### Errores

| HTTP | Motivo |
|------|--------|
| 400 | `idBodega` inválido o bodega no interna |
| 401 | Token ausente o inválido |
| 403 | Rol no autorizado, bodega inactiva o fuera del tenant |
| 404 | Bodega no encontrada |
| 409 | Layout ya bootstrappeado (existen ubicaciones) |

### Swagger

Documentado en tag **Configuración · Bodegas** en `/api/docs`.
