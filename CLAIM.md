<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-200
**Rama:** lucho/req-200-lote-mateo-despacho
**Responsable:** Lucho
**Confianza:** 60%

### Zonas que voy a tocar
- `src/modules/sales/ai/openai-pedido.client.ts`
- `src/modules/sales/ai/openai-pedido.client.spec.ts`
- `src/modules/sales/ai/utils/extract-entrega-desde-texto.ts`
- `src/modules/sales/ai/utils/extract-entrega-desde-texto.spec.ts`
- `src/modules/sales/services/pedido-ia.service.ts`
- `src/modules/sales/services/pedido-ia.service.spec.ts`
- `src/modules/sales/ai/utils/clasificar-adjunto-oc-mensual.ts` — archivo nuevo
- `src/modules/sales/ai/utils/clasificar-adjunto-oc-mensual.spec.ts` — archivo nuevo
- `src/modules/sales/utils/orden-venta-estado.util.ts`
- `src/modules/transport/controllers/paquete-despacho.controller.ts`
- `src/modules/transport/infrastructure/paquete-despacho.repository.ts`
- `src/modules/operations/infrastructure/orden-trabajo.repository.ts`
- `src/modules/sales/services/validar-captura-despacho.service.ts` — archivo nuevo

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Parte API del lote En Revisión: REQ-200 Mateo mes/año, REQ-244 OC mensuales SEADUST/KRYSTAL, REQ-243 check-in despacho. Pareja web: lucho/req-223-lote-revision-ov.
