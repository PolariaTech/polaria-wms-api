# Operaciones de bodega (flujo frio)

Módulo alineado al dashboard unificado de [frio](https://github.com/eldani13/frio): órdenes de trabajo, cola de tareas, alertas y llamadas al jefe.

## Base path

`/operaciones`

Autenticación: Bearer JWT. Todos los endpoints requieren `codigoCuenta` + `idBodega` en query o body y validación tenant (`assertOperationalTenantScope`).

## Roles

| Acción | Roles |
|--------|-------|
| Lectura general | configurador, admin cuenta, admin/jefe bodega, custodio, operario, procesador |
| Crear OT | configurador, administrador_bodega, jefe_bodega |
| Ejecutar OT / reportar | configurador, custodio, operario |
| Gestionar tareas | configurador, admin/jefe bodega, custodio, operario |
| Gestionar alertas | configurador, admin/jefe bodega |
| Ejecutar alertas | configurador, custodio, operario |
| Llamar jefe | configurador, operario, procesador |
| Atender llamada | configurador, admin/jefe bodega |

## Roles (alineado a frio)

| Rol | Permisos API |
|-----|----------------|
| **Custodio** | Entradas vía `POST /compras/recepciones` (módulo purchases). Salidas/despacho vía ventas (fase siguiente). |
| **Jefe bodega** | Crear OT (`a_bodega`, `a_salida`, `bodega_a_bodega`, `revisar`), asignar tareas, gestionar alertas, crear/asignar procesamiento |
| **Admin bodega** | Solo lectura: listados + `GET /operaciones/reportes/bodega` |
| **Operario** | Ejecutar OT, completar tareas movimiento/despacho/revisión, reportar fallos, llamar jefe |
| **Procesador** | Ejecutar/cerrar procesamiento, llamar jefe |

## Reportes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/reportes/bodega` | Resumen ingresos, salidas, movimientos, alertas, merma (admin/jefe) |

## Órdenes de trabajo

Flujos (`tipoFlujo`) equivalentes a frio:

| tipoFlujo | Significado frio | Tipo OT Prisma | Tarea cola |
|-----------|------------------|----------------|------------|
| `a_bodega` | Entrada a slot de bodega | `reabasto` | `movimiento` |
| `a_salida` | Movimiento a zona salida | `picking` | `despacho` |
| `revisar` | Conteo / revisión de posición | `conteo` | `revision` |

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/ordenes-trabajo` | Listar OT. Query: `estado`, `tipoFlujo` |
| GET | `/ordenes-trabajo/:id` | Detalle |
| POST | `/ordenes-trabajo` | Crear OT + tarea en cola. Body opcional: `idAsignado`, `idOrdenVenta` (vínculo OV) |
| POST | `/ordenes-trabajo/:id/ejecutar` | Operario completa OT. Opcional `idWarehouseState` + `version` para transferencia |
| POST | `/ordenes-trabajo/:id/reportar` | Crea alerta `orden_reportada` |

Al ejecutar con `idWarehouseState`, el backend:

1. Transfiere la cantidad de `orden_trabajo_linea` (o el total de líneas) al `idUbicacionDestino`; si la OT no tiene líneas, mueve la posición completa
2. Registra `movimiento_inventario` tipo `transferencia`
3. Marca tarea y OT como completadas

## Tareas en cola

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/tareas` | Listar. Query: `estado`, `idAsignado` |
| PATCH | `/tareas/:id/asignar` | Asignar operario |
| POST | `/tareas/:id/completar` | Marcar completada. Si la tarea tiene `idOrdenTrabajo`, ejecuta la OT en la misma transacción: mueve `warehouse_state`, registra `movimiento_inventario` tipo `transferencia`, completa OT y actualiza slots origen/destino. Body: `{ codigoCuenta, idBodega }` |

## Operarios y presencia

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/operarios-disponibles` | Operarios de bodega con `tareasPendientes` y `disponible` (`usuario.esta_activo`). Roles: jefe/admin bodega |
| POST | `/presencia/ping` | Heartbeat opcional del operario en app (solo metadata `ultimoPing`) |

Al crear OT con `idAsignado` opcional:

- Valida operario asignado a la bodega
- Valida cuenta activa (`esta_activo`)
- Propaga `id_asignado` a `orden_trabajo` y `tarea_cola`

## Alertas operativas

Tipos: `temperatura`, `demora`, `orden_reportada`, `otro`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/alertas` | Listar (excluye llamadas al jefe) |
| POST | `/alertas` | Crear alerta |
| PATCH | `/alertas/:id/asignar` | Asignar a operario |
| POST | `/alertas/:id/cerrar` | Cerrar con `motivoCierre` opcional |

## Llamadas al jefe

Persistidas en `alerta_operativa` con `metadata.subtipo = llamada_jefe` (sin migración extra).

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/llamadas` | Listar llamadas |
| POST | `/llamadas` | Operario/procesador llama al jefe |
| POST | `/llamadas/:id/atender` | Jefe marca atendida |

## Modelos Prisma

- `OrdenTrabajo`, `OrdenTrabajoLinea`
- `TareaCola`
- `SesionOperativa` (presencia operativa / heartbeat)
- `AlertaOperativa`
- `MovimientoInventario` (en ejecución de OT)
- `Contador` clave `orden_trabajo` por bodega

## Swagger

Tags: `Operaciones · Órdenes de trabajo`, `Operaciones · Tareas en cola`, `Operaciones · Alertas`, `Operaciones · Llamadas al jefe`.
