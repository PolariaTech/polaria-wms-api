# Purchases API — SOL y OC (POL-34)

Documentación de endpoints del módulo `purchases` en `polaria-wms-api`.

Guards en todos los endpoints: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`.

---

## Solicitudes de compra (SOL)

Base path: `/compras/solicitudes`  
Swagger tag: **Compras · Solicitudes (SOL)**

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/compras/solicitudes` | escritura | Crear borrador con líneas |
| GET | `/compras/solicitudes` | lectura | Listar (filtros query) |
| GET | `/compras/solicitudes/:id` | lectura | Detalle |
| PATCH | `/compras/solicitudes/:id` | escritura | Editar borrador |
| POST | `/compras/solicitudes/:id/enviar-aprobacion` | escritura | `borrador` → `pendiente_aprobacion` |
| POST | `/compras/solicitudes/:id/aprobar` | aprobación | → `aprobada` |
| POST | `/compras/solicitudes/:id/rechazar` | aprobación | → `rechazada` |
| POST | `/compras/solicitudes/:id/cancelar` | escritura | → `cancelada` |
| POST | `/compras/solicitudes/:id/convertir-oc` | escritura | SOL `aprobada` → OC + SOL `convertida` |

**Escritura:** `configurador`, `administrador_cuenta`, `operador_cuenta`, `administrador_bodega`, `jefe_bodega`  
**Aprobación:** `configurador`, `administrador_cuenta`

### Estados SOL

```
borrador → pendiente_aprobacion → aprobada → convertida
                              ↘ rechazada
borrador / pendiente_aprobacion → cancelada
```

### POST /compras/solicitudes

```json
{
  "codigoCuenta": "CTA001",
  "idBodega": "550e8400-e29b-41d4-a716-446655440000",
  "idProveedor": "550e8400-e29b-41d4-a716-446655440001",
  "observaciones": "Reposición semanal",
  "lineas": [
    { "idProducto": "550e8400-e29b-41d4-a716-446655440010", "cantidad": 100.5 }
  ]
}
```

- `idSolicitante` = usuario autenticado (JWT)
- Código único por cuenta: `SOL-000001`, … (contador `solicitud_compra`)
- Estado inicial: `borrador`

### GET /compras/solicitudes — query params

| Param | Tipo | Descripción |
|-------|------|-------------|
| `idBodega` | UUID | Filtrar por bodega |
| `estado` | enum | Filtrar por estado |
| `idProveedor` | UUID | Filtrar por proveedor |

---

## Órdenes de compra (OC)

Base path: `/compras/ordenes`  
Swagger tag: **Compras · Órdenes (OC)**

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/compras/ordenes` | escritura | Crear OC (desde cero o desde SOL aprobada) |
| GET | `/compras/ordenes` | lectura | Listar (filtros query) |
| GET | `/compras/ordenes/:id` | lectura | Detalle |
| POST | `/compras/ordenes/:id/emitir` | escritura | `borrador` → `emitida` |
| POST | `/compras/ordenes/:id/cancelar` | escritura | `borrador` / `emitida` → `cancelada` |

**Roles:** mismos que escritura/lectura SOL.

### Estados OC (fase actual)

Implementados en esta fase:

```
borrador → emitida → cancelada
borrador → cancelada
```

Implementados con recepción (POL-5):

```
emitida → parcialmente_recibida → recibida
```

Pendientes: `cerrada` (cierre administrativo post-recepción).

---

## Recepción de mercancía (POL-5)

Base path: `/compras/recepciones`  
Swagger tag: **Compras · Recepción (ingreso)**

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/compras/recepciones/ordenes/:idOrdenCompra/cerrar` | custodio, jefe, admin bodega, admin cuenta, configurador | Cierra recepción contra OC emitida |
| GET | `/compras/recepciones` | lectura | Listar recepciones |
| GET | `/compras/recepciones/ordenes/:idOrdenCompra` | lectura | Recepción de una OC |
| GET | `/compras/recepciones/:id` | lectura | Detalle por id |

**Escritura sensible:** bypass RLS vía Prisma + `RolesGuard` (roles de recepción, incl. custodio). No usa `SensitiveWriteGuard` genérico de inventario.

### POST cerrar recepción

```json
{
  "codigoCuenta": "CTA001",
  "idBodega": "550e8400-e29b-41d4-a716-446655440000",
  "lineas": [
    {
      "idLineaOrdenCompra": "550e8400-e29b-41d4-a716-446655440201",
      "cantidadRecibida": 50,
      "temperaturaRegistrada": -18.5
    }
  ],
  "idUbicacionIngreso": "550e8400-e29b-41d4-a716-446655440099",
  "notas": "Recepción sin novedad"
}
```

- Una recepción por OC (`uq_recepcion_orden`)
- `sinDiferencias=true` si cantidades coinciden exactamente con la OC y no hay líneas adicionales
- Con `idUbicacionIngreso`: crea `lote`, `warehouse_state` y `movimiento_inventario` tipo `recepcion`

---

## Órdenes de compra (OC) — detalle histórico

### POST /compras/ordenes — desde cero

```json
{
  "codigoCuenta": "CTA001",
  "idBodega": "550e8400-e29b-41d4-a716-446655440000",
  "idProveedor": "550e8400-e29b-41d4-a716-446655440001",
  "fechaEntregaEstimada": "2026-07-15",
  "destinoTipo": "interna",
  "observaciones": "Entrega en muelle 3",
  "lineas": [
    {
      "idProducto": "550e8400-e29b-41d4-a716-446655440010",
      "cantidad": 50,
      "precioUnitario": 12.5
    }
  ]
}
```

- `idCreador` = usuario autenticado
- Código único por cuenta: `OC-000001`, … (contador `orden_compra`)
- Estado inicial: `borrador`
- `precioUnitario` opcional (default `0`)

### POST /compras/ordenes — desde SOL aprobada

Alternativa al endpoint dedicado `convertir-oc`. Body mínimo:

```json
{
  "codigoCuenta": "CTA001",
  "idBodega": "550e8400-e29b-41d4-a716-446655440000",
  "idSolicitudCompra": "550e8400-e29b-41d4-a716-446655440100"
}
```

Opcionalmente se pueden enviar `fechaEntregaEstimada`, `destinoTipo`, `observaciones` o `lineas` para sobrescribir.

### POST /compras/solicitudes/:id/convertir-oc

Convierte una SOL en estado `aprobada` en una OC en transacción atómica:

1. Crea OC en `borrador` copiando líneas SOL (`precioUnitario = 0`)
2. Vincula `id_solicitud_compra` en la OC
3. Actualiza SOL: `estado = convertida`, `id_orden_compra = <nueva OC>`

Respuesta: objeto OC (`OrdenCompraResponse`).

**Errores:**

- SOL no en estado `aprobada`
- SOL ya convertida (`idOrdenCompra` presente)
- SOL sin proveedor

### GET /compras/ordenes — query params

| Param | Tipo | Descripción |
|-------|------|-------------|
| `idBodega` | UUID | Filtrar por bodega |
| `estado` | enum | Filtrar por estado |
| `idProveedor` | UUID | Filtrar por proveedor |
| `idSolicitudCompra` | UUID | Filtrar por SOL origen |

---

## Validaciones comunes

- `codigoCuenta` + `idBodega` coherentes con `TenantContext`
- Bodega activa y de la misma cuenta
- Proveedor y productos de la misma cuenta
- Líneas sin productos duplicados
- Productos activos

## Modelo de respuesta OC

```json
{
  "idOrdenCompra": "...",
  "codigoCuenta": "CTA001",
  "idBodega": "...",
  "idProveedor": "...",
  "idSolicitudCompra": null,
  "idCreador": "...",
  "codigo": "OC-000001",
  "estado": "borrador",
  "fechaEmision": "2026-06-28",
  "fechaEntregaEstimada": null,
  "destinoTipo": "interna",
  "observaciones": null,
  "createdAt": "...",
  "updatedAt": "...",
  "lineas": [
    {
      "idLineaOrdenCompra": "...",
      "idProducto": "...",
      "cantidad": "50.0000",
      "precioUnitario": "12.5000",
      "cantidadRecibida": "0.0000"
    }
  ]
}
```

## Tests unitarios

- `solicitud-compra.service.spec.ts` — ciclo SOL
- `orden-compra.service.spec.ts` — transiciones críticas OC (crear, convertir, emitir, cancelar)
