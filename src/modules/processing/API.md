# Procesamiento (flujo frio)

Solicitudes de transformación primario → secundario con merma, alineado al panel de procesador en frio.

## Base path

`/procesamiento/solicitudes`

## Estados

`borrador` → `pendiente` → `en_proceso` → `pendiente_cierre` → `terminada` | `cancelada`

## Roles

| Acción | Roles |
|--------|-------|
| Lectura | configurador, admin cuenta, admin/jefe bodega, procesador, operario |
| Crear / asignar procesador | configurador, admin bodega, jefe bodega, procesador |
| Cambiar estado / cerrar con merma | configurador, procesador |

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar. Query: `estado`, `idProcesador` |
| GET | `/:id` | Detalle |
| POST | `/` | Crear solicitud + tarea cola `procesamiento`. Código `PROC-000001` |
| PATCH | `/:id/asignar-procesador` | Asigna procesador → `en_proceso` |
| PATCH | `/:id/estado` | Transición manual de estado |
| POST | `/:id/cerrar` | Cierre con `kilosSecundario`, `kilosMerma`, `sobranteKg` opcional |

Al cerrar:

- Actualiza solicitud a `terminada`
- Inserta `registro_merma`
- Inserta `movimiento_inventario` tipo `merma`
- Completa tarea cola vinculada por código

## Modelos Prisma

- `SolicitudProcesamiento`
- `RegistroMerma`
- `TareaCola`
- `MovimientoInventario`
- `Contador` clave `solicitud_procesamiento` por bodega

## Swagger

Tag: `Procesamiento · Solicitudes`.
