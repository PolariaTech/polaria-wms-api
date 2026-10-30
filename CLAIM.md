<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-239
**Rama:** dani/req-239-correos-birchstreet-ingesta
**Responsable:** Dani
**Confianza:** 60%

### Zonas que voy a tocar
- `src/modules/sales/ai/utils/extract-entrega-desde-texto.ts`
- `src/modules/sales/ai/utils/extract-entrega-desde-texto.spec.ts`
- `src/modules/sales/ai/utils/correo-chrome.ts`
- `src/modules/sales/ai/utils/direccion-correo-aplicativo.ts`
- `src/modules/sales/ai/utils/direccion-correo-aplicativo.spec.ts`
- `src/modules/sales/ai/openai-pedido.client.ts`
- `src/modules/sales/ai/openai-pedido.client.spec.ts`
- `src/modules/sales/ai/utils/correo-chrome.spec.ts` — archivo nuevo
- `src/modules/sales/ai/utils/limpiar-direccion-birchstreet.ts` — archivo nuevo
- `src/modules/sales/ai/utils/limpiar-direccion-birchstreet.spec.ts` — archivo nuevo
- `src/modules/sales/ai/utils/correo-remitente-birchstreet.ts` — archivo nuevo
- `src/modules/sales/ai/utils/correo-remitente-birchstreet.spec.ts` — archivo nuevo
- `src/modules/sales/ai/utils/notas-birchstreet.ts` — archivo nuevo
- `src/modules/sales/ai/utils/notas-birchstreet.spec.ts` — archivo nuevo

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Ingesta de correos BirchStreet en el api: direccion sin ATTN/FROM, correo real del remitente y notas sin horarios ni contactos. Rama apilada sobre REQ-231 (api #61).
