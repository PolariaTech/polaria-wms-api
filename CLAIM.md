<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-309
**Rama:** dani/req-309-solicitado-especificacion
**Responsable:** Dani
**Confianza:** 70%

### Zonas que voy a tocar
- `src/modules/sales/ai/openai-pedido.client.ts`
- `src/modules/sales/ai/openai-pedido.client.spec.ts`
- `src/modules/sales/ai/utils/reglas-lectura-pedido.ts`
- `src/modules/sales/ai/utils/reglas-lectura-pedido.spec.ts`
- `src/modules/sales/dto/pedido-ia-response.dto.ts`
- `src/modules/sales/ai/utils/correo-chrome.ts` — autorizada por el usuario el 2026-11-12
- `src/modules/sales/ai/utils/correo-chrome.spec.ts` — autorizada por el usuario el 2026-11-12

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Lote 1 de precisión de Mateo (REQ-309 y REQ-287): regla de columnas código/descripción en la lectura y especificación de cada renglón en origen_correo
