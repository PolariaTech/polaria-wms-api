<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-180
**Rama:** lucho/req-180-lote-revision-ov
**Responsable:** Lucho
**Confianza:** 40%

### Zonas que voy a tocar
- `src/modules/sales/ai/openai-pedido.client.ts`
- `src/modules/sales/ai/openai-pedido.client.spec.ts`
- `src/modules/sales/ai/utils/extract-entrega-desde-texto.ts`
- `src/modules/sales/ai/utils/extract-entrega-desde-texto.spec.ts`
- `src/modules/sales/ai/utils/origen-correo-ordenes-trabajo.ts`
- `src/modules/sales/ai/utils/centro-consumo-vs-cliente.ts`
- `src/modules/sales/ai/utils/centro-consumo-vs-cliente.spec.ts`
- `src/modules/sales/ai/utils/direccion-correo-aplicativo.ts`
- `src/modules/sales/ai/utils/direccion-correo-aplicativo.spec.ts`
- `src/modules/sales/ai/utils/reagrupacion-ot.validator.ts`
- `src/modules/sales/ai/utils/reagrupacion-ot.validator.spec.ts`
- `src/modules/sales/ai/utils/enrich-almacen-codigo.ts`
- `src/modules/sales/ai/utils/enrich-almacen-codigo.spec.ts`
- `src/modules/sales/ai/utils/normalize-numero-pedido.ts`
- `src/modules/sales/ai/utils/normalize-numero-pedido.spec.ts`
- `src/modules/sales/ai/utils/clasificar-adjunto-oc-mensual.ts`
- `src/modules/sales/ai/utils/clasificar-adjunto-oc-mensual.spec.ts`
- `src/modules/sales/ai/utils/stamp-origen-correo-meta.ts`
- `src/modules/sales/ai/utils/stamp-origen-correo-meta.spec.ts`
- `src/modules/sales/ai/utils/texto-origen-pedido.ts`
- `src/modules/sales/services/pedido-ia.service.ts`
- `src/modules/sales/services/pedido-ia.service.spec.ts`
- `src/modules/sales/services/orden-venta.service.ts`
- `src/modules/sales/services/orden-venta.service.spec.ts`
- `src/modules/sales/services/orden-trabajo-reagrupacion.service.ts`
- `src/modules/sales/services/orden-trabajo-reagrupacion.service.spec.ts`
- `src/modules/sales/services/orden-correo-relectura.service.ts`
- `src/modules/sales/services/orden-correo-relectura.service.spec.ts`
- `src/modules/sales/infrastructure/orden-venta.repository.ts`
- `src/modules/sales/sales.module.ts`
- `src/modules/sales/utils/orden-venta-estado.util.ts`

### Compartidos (cambio mínimo y aviso)
- `src/modules/sales/sales.module.ts`

### Por qué
Pareja API del lote En Revisión (sin 170): Mateo multi-pedido/OT (197/238/253/262), direcciones (252), edición concurrente (180).
