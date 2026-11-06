<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-262
**Rama:** dani/req-197-partir-ov-por-correo
**Responsable:** sin responsable
**Confianza:** 80%

### Zonas que voy a tocar
- `src/modules/sales/ai/openai-reagrupacion.client.ts`
- `src/modules/sales/ai/openai-reagrupacion.client.spec.ts`
- `src/modules/sales/ai/utils/reagrupacion-ot.validator.ts`
- `src/modules/sales/ai/utils/reagrupacion-ot.validator.spec.ts`
- `src/modules/sales/dto/propuesta-reagrupacion.dto.ts`
- `src/modules/sales/services/orden-trabajo-reagrupacion.service.ts`
- `src/modules/sales/services/orden-trabajo-reagrupacion.service.spec.ts`
- `src/modules/sales/services/pedido-ia.service.ts` — autorizada por el usuario el 2026-11-06
- `src/modules/sales/services/pedido-ia.service.ingestar.spec.ts` — autorizada por el usuario el 2026-11-06

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Reorganizar divide también por día y horario de entrega, con mensajes claros cuando no se puede (REQ-262, REQ-273)
