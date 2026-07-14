# Patch web — POL-5 / POL-6 sub-issues

Aplica cambios de servicios y UI mínima (conciliación ciega, lock en grid, API movimientos).

## Rama API

`cursor/pol-5-6-subissues-d2d9`

## PowerShell (una línea)

```powershell
curl.exe -L -o web-pol56.patch "https://raw.githubusercontent.com/PolariaTech/polaria-wms-api/cursor/pol-5-6-subissues-d2d9/docs/patches/polaria-wms-web-pol-5-6-subissues.patch"; git apply --3way web-pol56.patch; git add -A; git commit -m "feat(pol-5/6): sub-issues ingreso y mapa bodega"
```

Si ya aplicaste el patch de procesamiento frio, este patch es adicional y compatible.

## Archivos

- `RecepcionCompraModal.tsx` — conciliación ciega, temperatura obligatoria
- `CustodioOrdenIngresoForm.tsx` — conciliación ciega
- `recepcion-compra-draft.ts` — sin pre-llenar cantidad pedida
- `EstadoBodegaSlotCell.tsx` — indicador lock
- `estado-bodega-slot-content.ts` / `estado-bodega.types.ts` — `lockedBy`
- `inventory-api.service.ts` — `listMovimientosInventarioApi`
- (+ procesamiento si no lo tenías: `processing-api.service.ts`, etc.)

## Sub-issues cubiertos

| Issue | Qué |
|-------|-----|
| POL-91 | UI conciliación ciega |
| POL-94 | Temperatura obligatoria en web; validación en API |
| POL-105 | Badge lock en grid |
| POL-106 | Cliente API movimientos |

POL-102, 103, 104 son solo API (FEFO, sync slot, lock OT).
