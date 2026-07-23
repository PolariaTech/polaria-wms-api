# Cierre POL-141 — Mapa: locks, FEFO y estados

Validación formal de bloqueos, prioridad FEFO y sincronización `estado_slot` ↔ `warehouse_state`.

## Sub-issues

| Issue | Alcance | Evidencia |
|-------|---------|-----------|
| POL-181 | Locks OT/slot | `assert-warehouse-state-lock.util.spec.ts`, `warehouse-state.service.spec.ts`, `test/warehouse-state-lock.e2e-spec.ts` |
| POL-182 | Sync estados | `sync-ubicacion-estado-slot.util.spec.ts`, refetch ubicaciones en web |
| POL-186 | FEFO salidas | `fefo-warehouse-state.util.spec.ts`, `map-ejecutar-orden-error.spec.ts` |

## Locks (POL-181)

| Caso | Comportamiento esperado |
|------|-------------------------|
| Sin lock | OT ejecutar → `LOCK_REQUIRED` (400) |
| Lock de otro operario activo | Lock API → 409; OT → `LOCK_HELD_BY_OTHER` (409) |
| Lock stale (>5 min) | Takeover permitido en `POST lock`; movimiento OT permitido sin re-lock |
| Force unlock | Jefe/admin/configurador puede `POST unlock` sobre lock ajeno |
| Versión optimista | `expectedVersion` opcional en body de lock |

Constante: `LOCK_STALE_MS = 5 * 60 * 1000` en `inventory.constants.ts`.

## FEFO (POL-186)

Orden en `fefo-warehouse-state.util.ts`:

1. `lote.fechaVencimiento ASC` (sin fecha → última prioridad)
2. Empate → `updatedAt ASC`

Aplicado en OT `a_salida` y `bodega_a_bodega` vía `orden-trabajo.repository.ts`.

| Caso | Resultado |
|------|-----------|
| 2 lotes, distinta fecha | Elige vencimiento más próximo |
| Misma fecha | Elige `updatedAt` más antiguo |
| Sin fecha vs con fecha | Prioriza el que tiene fecha |
| FEFO elige lote sin lock del operario | OT falla `LOCK_REQUIRED` — operario debe bloquear el slot/lote correcto |

FEFO es **automático en backend** al ejecutar OT; no hay selector manual en UI (POL-141 Opción A).

## Sync estado_slot (POL-182)

- API: `syncUbicacionEstadoSlot` tras movimientos → `libre` si `cantidad = 0`, else `ocupado`.
- Web grid: ocupación visual desde `warehouse_state` (Realtime); `estado_slot` para routing de sección se refresca con refetch debounced tras eventos Realtime.

## Comandos de prueba

```bash
# API — unit
npm test -- assert-warehouse-state-lock
npm test -- sync-ubicacion-estado-slot
npm test -- fefo-warehouse-state
npm test -- warehouse-state.service
npm test -- map-ejecutar-orden-error

# API — e2e
npm run test:e2e -- warehouse-state-lock
```

## Prerequisito POL-142

Ver `docs/MAPA-CONCURRENCIA-POL141.md` para escenarios manuales con 2–3 operarios.

## Referencias

- `src/modules/inventory/API.md` — POL-102/103/104 (implementación base)
- `polaria-wms-db/scripts/validate-mapa-pol141.sql` — asserts SQL post-movimiento
