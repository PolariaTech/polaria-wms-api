<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-187
**Rama:** dani/req-187-chat-ot-extension-leer-pedido
**Responsable:** Dani
**Confianza:** 60%

### Zonas que voy a tocar
- `src/modules/sales/ai/utils/normalize-numero-pedido.ts`
- `src/modules/sales/ai/utils/normalize-numero-pedido.spec.ts`
- `src/modules/sales/ai/utils/origen-correo-ordenes-trabajo.ts`
- `src/modules/sales/ai/openai-pedido.client.ts#extraerPedido`
- `src/modules/sales/services/pedido-ia.service.ts`
- `src/modules/sales/controllers/orden-trabajo-reagrupacion.controller.ts`
- `src/modules/sales/controllers/orden-trabajo-reagrupacion.controller.spec.ts`
- `src/modules/sales/ai/utils/checksum-total-documento.ts` — archivo nuevo
- `src/modules/sales/ai/utils/checksum-total-documento.spec.ts` — archivo nuevo
- `src/modules/sales/ai/storage-ov-adjuntos.ts` — archivo nuevo
- `src/modules/sales/ai/storage-ov-adjuntos.spec.ts` — archivo nuevo
- `src/modules/sales/services/orden-correo-relectura.service.ts` — archivo nuevo
- `src/modules/sales/services/orden-correo-relectura.service.spec.ts` — archivo nuevo
- `src/modules/sales/services/pedido-ia.service.spec.ts` — archivo nuevo
- `src/modules/sales/dto/propuesta-correccion-correo.dto.ts` — archivo nuevo
- `src/modules/sales/ai/utils/__fixtures__/relectura-ov-940-943.json` — archivo nuevo
- `src/modules/sales/controllers/orden-correo-relectura.controller.ts` — autorizada por el usuario el 2026-10-29
- `src/modules/sales/controllers/orden-correo-relectura.controller.spec.ts` — autorizada por el usuario el 2026-10-29
- `src/modules/sales/ai/utils/pdf-paginas.ts` — autorizada por el usuario el 2026-10-29
- `src/modules/sales/ai/utils/pdf-paginas.spec.ts` — autorizada por el usuario el 2026-10-29
- `src/modules/sales/ai/precios-openai.json` — autorizada por el usuario el 2026-10-29
- `src/modules/sales/ai/file-extractors.ts` — autorizada por el usuario el 2026-10-29
- `src/modules/sales/ai/file-extractors.spec.ts` — autorizada por el usuario el 2026-10-29
- `src/modules/sales/ai/upload-ov-adjunto-cloudinary.ts` — autorizada por el usuario el 2026-10-29
- `src/modules/sales/dto/pedido-ia-response.dto.ts` — autorizada por el usuario el 2026-10-29
- `src/modules/sales/controllers/pedido-ia.controller.ts` — autorizada por el usuario el 2026-10-29
- `.env.example` — autorizada por el usuario el 2026-10-29
- `src/modules/sales/ai/openai-pedido.client.spec.ts` — autorizada por el usuario el 2026-10-29

### Compartidos (cambio mínimo y aviso)
- `src/modules/sales/sales.module.ts`
- `CHANGELOG.md`

### Por qué
Modo 'corregir contra el correo' del chat de OT: relee PDF/eml de la OV por documento, valida contra Total pedido y propone OT por OC+almacén (casos OV-940 y OV-943). No cambia contratos de leer-pedido ni ingestar-pedido.
