<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-348
**Rama:** dani/req-348-confirmar-ov-25-ot
**Responsable:** Dani
**Confianza:** 70%

### Zonas que voy a tocar
- `src/modules/sales/infrastructure/orden-venta.repository.ts`
- `src/modules/sales/services/orden-venta.service.ts`
- `src/modules/sales/services/orden-venta.service.spec.ts`
- `src/modules/operations/infrastructure/orden-trabajo.repository.ts`
- `src/modules/sales/API.md`
- `CHANGELOG.md`

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Confirmar OV grande vence la transaccion de 5 s en emitir; timeout, error claro y registro de rendimiento; fase 2 opcional reduce sentencias
