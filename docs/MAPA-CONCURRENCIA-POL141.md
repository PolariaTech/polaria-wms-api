# Playbook concurrencia mapa — POL-141 → POL-142

Escenarios manuales para validar locks, FEFO y estados antes de la prueba formal con 2–3 operarios (POL-142).

## Preparación

- Entorno: dev/staging con al menos 2 usuarios operario (`operario-a`, `operario-b`) en la misma bodega.
- Producto con **2 lotes** en la misma ubicación (fechas de vencimiento distintas) para FEFO.
- Dos navegadores o ventanas incógnito (una sesión por operario).

## Escenario 1 — Lock exclusivo (POL-181)

| Paso | Operario A | Operario B | Resultado esperado |
|------|------------|------------|-------------------|
| 1 | Abre mapa tabla (`/dashboard/mapa` o vista inventario) | Abre mismo mapa | Ambos ven mismo stock |
| 2 | Bloquea posición X | — | Badge lock visible en A |
| 3 | — | Intenta bloquear posición X | Error 409 / toast conflicto |
| 4 | — | Intenta ejecutar OT sobre X sin lock | Error: debe bloquear primero |
| 5 | Libera lock | Bloquea posición X | B obtiene lock OK |

**Evidencia:** captura de error 409 en B + lock exitoso tras unlock de A.

## Escenario 2 — Realtime + estado_slot (POL-182)

| Paso | Operario A | Operario B | Resultado esperado |
|------|------------|------------|-------------------|
| 1 | Ejecuta OT que vacía slot Y | Observa grid estado bodega | B ve slot vacío sin recargar página |
| 2 | Ejecuta OT que llena slot Z | Observa grid | B ve slot ocupado; sección coherente tras ~1 s |

**Evidencia:** video corto o capturas antes/después sin F5.

## Escenario 3 — FEFO en salida (POL-186)

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | Seed: mismo producto, lote A (vence junio), lote B (vence diciembre), misma ubicación | — |
| 2 | Operario bloquea posición y ejecuta OT `a_salida` | Sale stock del lote A (junio) |
| 3 | Verificar movimiento en historial | `id_lote` = lote A |

**Variante lock:** si operario bloquea pero FEFO apunta a otro lote en la misma ubicación → OT debe fallar con mensaje de lock requerido.

## Escenario 4 — Stale lock (opcional)

| Paso | Acción | Resultado esperado |
|------|--------|-------------------|
| 1 | A bloquea posición y abandona (>5 min sin actividad) | — |
| 2 | B intenta lock | Takeover permitido |

## Criterios de paso para POL-142

- [ ] Escenarios 1–3 ejecutados sin hallazgos graves.
- [ ] Estados visuales coinciden con BD (consulta `warehouse_state` + `ubicacion.estado_slot`).
- [ ] Ningún inventario duplicado tras movimientos concurrentes controlados.

## Consultas SQL de verificación

```sql
-- Coherencia slot vs stock
SELECT u.codigo, u.estado_slot,
       COUNT(ws.id_warehouse_state) FILTER (WHERE ws.cantidad > 0) AS filas_con_stock
FROM ubicacion u
LEFT JOIN warehouse_state ws ON ws.id_ubicacion = u.id_ubicacion AND ws.cantidad > 0
WHERE u.id_bodega = '<id_bodega>'
GROUP BY u.id_ubicacion, u.codigo, u.estado_slot
HAVING (u.estado_slot = 'ocupado') <> (COUNT(ws.id_warehouse_state) FILTER (WHERE ws.cantidad > 0) > 0);
-- Debe retornar 0 filas
```

Ver también: `polaria-wms-db/scripts/validate-mapa-pol141.sql`.
