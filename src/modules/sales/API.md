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

## Proponer reagrupación de OT con IA (POL-390 / REQ-125)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/ventas/ordenes/:id/ordenes-trabajo/propuesta-reagrupacion` | Propone una nueva distribución de las OT de una OV `por_confirmar` |

Autenticación: Bearer JWT + `TenantGuard` + `RolesGuard` (`operador_cuenta`, `administrador_cuenta`). **No** acepta la API key de integración. La cuenta sale del JWT: el body no lleva `codigoCuenta` (el `ValidationPipe` global rechaza campos extra con 400).

**No escribe nada en la base de datos.** El cliente aplica la propuesta como borrador del formulario y la guarda por el flujo normal de la OV.

### Body

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `requestId` | uuid | Identifica la solicitud; se devuelve igual |
| `instruccion` | string | Instrucción en lenguaje natural (no puede estar vacía) |
| `historial` | `[{ instruccion }]` | Opcional. Instrucciones previas rechazadas, en orden. El modelo parte siempre del estado original. Máximo 20 entradas (techo técnico provisional) |
| `estadoBase.ots[]` | `{ otId, etiqueta, almacen, numeroPedido, renglones[] }` | Borrador actual de las OT |
| `estadoBase.ots[].renglones[]` | `{ renglonId, producto, cantidad, unidad? }` | `renglonId` estable, asignado por el cliente |

### Qué puede hacer el modelo

Solo mover **renglones completos** entre las OT existentes o hacia OT nuevas (`NUEVA-n`). No cambia cantidades ni datos, no parte un renglón y no inventa renglones. Al modelo solo le llegan referencias opacas (`r1`, `OT-A`) y almacén, pedido, producto y cantidad truncados a 60 caracteres: sin cuerpo de correo, adjuntos, notas, comprador ni teléfonos, y sin `tools`.

### Respuesta 200 (una de tres)

| Caso | Forma |
|------|-------|
| Propuesta | `{ requestId, propuestaId, baseHash, ots[], resumen, movimientos[] }` |
| Aclaración | `{ requestId, aclaracion }` — texto fijo del servidor (instrucción ambigua, o sin cambios) |
| Fuera de alcance | `{ requestId, rechazo: "FUERA_DE_ALCANCE" }` |

- `ots[]`: `{ otId, nuevaClave, etiquetaSugerida, renglonIds[] }`. Una OT existente trae `otId`; una nueva trae `nuevaClave` (`NUEVA-n`) y una `etiquetaSugerida` saneada (≤ 60 caracteres, sin marcado). El cliente genera el id real de las OT nuevas. Las OT que se quedan sin renglones no aparecen.
- `resumen`: `{ antes, despues, nuevas, vacias }`.
- `movimientos[]`: `{ renglonId, deOtId, aOtId }`.
- `baseHash`: SHA-256 del estado base recibido (JSON canónico con OT y renglones ordenados por id, cantidades en escala 1e6).

### Errores

El código de negocio viaja en el campo `error` del cuerpo (el filtro global no reenvía otros campos).

| HTTP | `error` | Caso |
|------|---------|------|
| 400 | `Bad Request` | Instrucción vacía, UUID inválido o campos desconocidos (incluido `codigoCuenta`) |
| 400 | `ESTADO_BASE_INVALIDO` | Sin OT ni renglones, ids repetidos o cantidad inválida |
| 401 | — | Sin JWT |
| 403 | — | Rol no permitido |
| 404 | — | OV inexistente **o de otra cuenta** (misma respuesta) |
| 409 | `OV_ESTADO_CAMBIO` | La OV ya no está `por_confirmar`; no se consulta al modelo |
| 422 | `PROPUESTA_INVALIDA` | La salida del modelo no pasó el validador (se reintenta una vez) |
| 502 | `PROVEEDOR_IA` | Falló la consulta al proveedor de IA |

### Validador determinista

La salida del modelo es solo una propuesta. Se acepta únicamente si: cada renglón base aparece exactamente una vez, solo se usan OT existentes o `NUEVA-n`, el total de cantidades no cambia y no hay campos extra. El cliente recibe la propuesta reconstruida desde el estado base, nunca texto del modelo (salvo `etiquetaSugerida`, saneada).

### Configuración y pendientes

- Usa `OPENAI_API_KEY` y `OPENAI_MODEL` (`gpt-4o-mini` si no se define). Si el modelo rechaza `temperature: 0`, se reintenta sin ella.
- **Sin timeout ni tope de tokens** por decisión del producto. Límites de caracteres, turnos, tasa y máximo de OT nuevas: pendientes (R13 de POL-390), se definen tras las pruebas. Mientras tanto hay techos técnicos provisionales (`TECHOS_PROVISIONALES_REAGRUPACION`) solo contra entradas desbordadas.
- Rate limit: aplica el throttler global; no hay uno específico todavía.

## Correos de pedidos de n8n e ingreso manual (REQ-104)

Lista los correos que el workflow de n8n registra en el data table `correos_aguacates_entrada` y deja al operador ingresar como OV los que el workflow descartó (no pasaron sus filtros). Requiere JWT y rol `operador_cuenta` o `administrador_cuenta`. Solo para las cuentas de `N8N_CORREOS_CUENTAS`; otra cuenta recibe 403 `CORREOS_NO_DISPONIBLES`.

| Método y ruta | Qué hace |
|---|---|
| `GET /ventas/correos` | Lista paginada. Query: `modo` (`todos` o `descartados`), `pagina`, `tamano` (máx. 50), `desde`, `hasta`, `remitente`, `asunto`. Cada fila trae `ingreso` si el WMS ya la tiene como OV o la está procesando. Límite: 60 por minuto. |
| `POST /ventas/correos/:messageId/ingresar` | Reserva el correo y responde **202**; la OV `por_confirmar` se crea en segundo plano con el mismo núcleo que `ingestar-pedido`. Límite: 10 por minuto. |
| `GET /ventas/correos/:messageId/ingreso` | Estado del ingreso: `procesando`, `ingresado` (con `codigoOrdenVenta`) o `error` (con el motivo). Es el sondeo: salta los dos límites globales. |

### Sin duplicados

La tabla `correo_pedido_ingreso` (migración 114) tiene llave única (`codigo_cuenta`, `message_id`). El segundo clic mientras procesa devuelve el estado actual (no crea otra OV); si ya está ingresado responde **409** `CORREO_YA_INGRESADO` (el código de la OV va en el mensaje y se consulta con `GET …/ingreso`). Un ingreso en `error`, o en `procesando` por más de 10 minutos, se puede reintentar.

### Puente con n8n

El api no habla con Gmail: llama a dos webhooks de un workflow puente de n8n, con el header `X-Api-Key` (`N8N_CORREOS_API_KEY`).

- `POST {N8N_CORREOS_URL}/wms-correos-listar`. Recibe `{ modo, soloDescartados, pagina, tamano, desde?, hasta?, remitente?, asunto? }` y responde `{ total, filas }` con las columnas del data table (`recibido_en`, `de`, `para`, `asunto`, `message_id`, `hilo`, `adjunto`, `nuevo_pedido`, `motivo`) y, si las manda, las de sistema `id`, `createdAt` y `updatedAt`.
- `POST {N8N_CORREOS_URL}/wms-correos-obtener`. Recibe `{ messageId }` y responde `{ asunto, de, para, fecha, texto, html, adjuntos: [{ nombre, mimeType, base64 }] }`.

Errores del puente: 503 `CORREOS_NO_CONFIGURADOS`, 502 `N8N_NO_RESPONDE`, `N8N_ERROR` o `N8N_RESPUESTA_INVALIDA`.
