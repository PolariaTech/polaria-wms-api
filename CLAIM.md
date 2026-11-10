<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** POL-413
**Rama:** dani/pol-413-dividir-la-ov-por-orden-de-compra-desde-el-chat
**Responsable:** Daniel De Jesus Galvis Zambrano
**Confianza:** 80%

### Zonas que voy a tocar
- `src/modules/sales/ai/openai-pedido.client.ts`
- `src/modules/sales/ai/openai-pedido.client.spec.ts`
- `src/modules/sales/services/orden-correo-relectura.service.ts`
- `src/modules/sales/services/orden-correo-relectura.service.spec.ts`
- `src/modules/sales/services/pedido-ia.service.ts`
- `src/modules/sales/services/pedido-ia.service.spec.ts`
- `src/modules/sales/dto/propuesta-correccion-correo.dto.ts` — autorizada por el usuario el 2026-11-10

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
POL-413 (enrutador: dividir por OC) y POL-414 (instruccion al lector de la relectura) en una sola rama
