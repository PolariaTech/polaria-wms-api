# Procesamiento (flujo frio)

Solicitudes de transformación primario → secundario con merma, alineado al panel de procesador en [frio](https://github.com/eldani13/frio).

## Base path

`/procesamiento/solicitudes`

## Estados (mapeo frio)

| frio | Polaria |
|------|---------|
| Iniciado | `pendiente` |
| En curso | `en_proceso` |
| Pendiente | `pendiente_cierre` |
| Terminado | `terminada` |

Flujo: `pendiente` → `en_proceso` → `pendiente_cierre` → `terminada`

## Roles

| Acción | Roles |
|--------|-------|
| Lectura | configurador, admin cuenta, admin/jefe bodega, procesador, operario |
| Crear | configurador, jefe bodega |
| Asignar operario / procesador / terminar | configurador, jefe bodega |
| Cerrar con merma | configurador, procesador (sin `inventory:write`; no usa `SensitiveWriteGuard`) |
| OT post-cierre (tras cerrar) | configurador, jefe bodega, procesador |
| Iniciar / aplicar OT | operario, procesador |

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar. Query: `estado`, `idProcesador` |
| GET | `/:id` | Detalle |
| GET | `/:id/desperdicio-sugerido` | Kg merma sugeridos según % catálogo |
| POST | `/` | Crear (Iniciado). Calcula estimado con regla de tres + % merma catálogo |
| PATCH | `/:id/asignar-operario` | Jefe asigna operario (permanece `pendiente`) |
| POST | `/:id/iniciar` | Operario → `en_proceso`. Descuenta primario, calcula `sobranteKg` |
| PATCH | `/:id/asignar-procesador` | Pre-asigna procesador sin cambiar estado |
| PATCH | `/:id/estado` | Transición manual con reglas frio |
| POST | `/:id/cerrar` | Procesador → `pendiente_cierre` con `kilosMerma` |
| POST | `/:id/ordenes-post-cierre` | Procesador o jefe crea OT procesado + sobrante hacia almacén |
| POST | `/:id/ordenes/:idOrden/aplicar` | Operario ubica stock en mapa |
| POST | `/:id/terminar` | Jefe marca `terminada` tras ubicar |

## Flujo operativo

1. Operador/jefe crea solicitud (`pendiente`) — valida stock en almacenamiento, **sin** tarea cola
2. Jefe asigna operario (`PATCH asignar-operario`): persiste `idOperario`, crea OT `a_procesamiento` y tarea `procesamiento`
3. Operario inicia (`POST iniciar`): ejecuta movimiento almacenamiento → procesamiento, solicitud `en_proceso`
4. Operario completa tarea (`POST /operaciones/tareas/:id/completar`) — solo cierra la tarea (el stock ya se movió en `iniciar`)
5. Procesador cierra (`POST cerrar`) con `kilosMerma` → `pendiente_cierre`
6. Jefe crea OT post-cierre (`POST ordenes-post-cierre`) con ubicaciones destino
7. Operario aplica cada OT (`POST ordenes/:idOrden/aplicar`)
8. Jefe o auto-cierre marca `terminada` cuando stock ubicado y OT completas

## Cálculos (frio)

- Estimado secundario: regla de tres `kilosPrimario / reglaA * reglaB`, luego aplica `% merma` del catálogo
- `sobranteKg` al iniciar: diferencia entre kg descontados y estimado convertido a kg primario
- `kilosSecundario` al cerrar: opcional; default `floor(estimado)`
- Desperdicio sugerido: `% merma` × cantidad primario

## Al cerrar

- Actualiza solicitud a `pendiente_cierre` (no `terminada`)
- Inserta `registro_merma`
- Inserta `movimiento_inventario` tipo `merma` si `kilosMerma > 0`
- Completa tarea cola vinculada

## Modelos Prisma

- `SolicitudProcesamiento`
- `RegistroMerma`
- `TareaCola`
- `OrdenTrabajo` (OT procesado / sobrante)
- `MovimientoInventario`
- `Contador` clave `solicitud_procesamiento` por bodega

## Swagger

Tag: `Procesamiento · Solicitudes`.
