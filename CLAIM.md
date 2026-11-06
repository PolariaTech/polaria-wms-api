<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-197
**Rama:** dani/req-197-partir-ov-por-correo
**Responsable:** Dani
**Confianza:** 60%

### Zonas que voy a tocar
- `src/modules/sales/services/pedido-ia.service.ts`
- `src/modules/sales/services/pedido-ia.service.spec.ts`
- `src/modules/sales/services/pedido-ia.service.ingestar.spec.ts`
- `src/modules/sales/ai/openai-pedido.client.ts`
- `src/modules/sales/ai/utils/clasificar-adjunto-oc-mensual.ts`
- `src/modules/sales/ai/utils/clasificar-adjunto-oc-mensual.spec.ts`
- `src/modules/sales/ai/utils/origen-correo-ordenes-trabajo.ts`
- `src/modules/sales/ai/openai-reagrupacion.client.ts`
- `src/modules/sales/ai/openai-reagrupacion.client.spec.ts`
- `src/modules/sales/ai/utils/reagrupacion-ot.validator.ts`
- `src/modules/sales/ai/utils/reagrupacion-ot.validator.spec.ts`
- `src/modules/sales/services/orden-trabajo-reagrupacion.service.ts`
- `src/modules/sales/services/orden-trabajo-reagrupacion.service.spec.ts`
- `src/modules/sales/controllers/pedido-ia.controller.ts`
- `src/modules/sales/dto/ingestar-pedido-response.dto.ts`
- `src/modules/sales/dto/propuesta-reagrupacion.dto.ts`
- `src/modules/sales/ai/file-extractors.ts` — autorizada por el usuario el 2026-11-06
- `src/modules/sales/controllers/orden-trabajo-reagrupacion.controller.ts` — autorizada por el usuario el 2026-11-06
- `src/modules/sales/sales.module.ts` — autorizada por el usuario el 2026-11-06

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Un correo con varias OC o varios días debe crear OV separadas, y un pedido de Krystal o en foto no puede quedar sin ingresar.
