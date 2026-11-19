<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-365
**Rama:** lucho/req-365-ov-duplicada-correo
**Responsable:** Lucho
**Confianza:** 80%

### Zonas que voy a tocar
- `src/modules/sales/services/correo-descartado.service.ts`
- `src/modules/sales/services/correo-descartado.service.ingresar.spec.ts`
- `src/modules/sales/services/correo-descartado.ingreso.spec.ts`
- `src/modules/sales/infrastructure/correo-ingreso.repository.ts`
- `src/modules/sales/infrastructure/correo-ingreso.repository.spec.ts`
- `src/modules/sales/services/pedido-ia.service.ts`
- `src/modules/sales/controllers/pedido-ia.controller.ts`
- `src/modules/sales/ai/utils/stamp-origen-correo-meta.ts`
- `src/modules/sales/ai/utils/stamp-origen-correo-meta.spec.ts`

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Evitar OV duplicada cuando n8n ya creó una y el ingreso manual vuelve a ingestar el mismo correo
