<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-313
**Rama:** dani/req-313-correo-partido-varias-ov
**Responsable:** Dani
**Confianza:** 75%

### Zonas que voy a tocar
- `src/modules/sales/services/orden-correo-relectura.service.ts`
- `src/modules/sales/services/orden-correo-relectura.service.spec.ts`
- `src/modules/sales/services/orden-correo-relectura.instruccion.spec.ts`
- `src/modules/sales/services/orden-correo-relectura.fixtures.ts`
- `src/modules/sales/services/pedido-ia.service.ts`
- `src/modules/sales/API.md`
- `CHANGELOG.md`

### Compartidos (cambio mínimo y aviso)
- `src/modules/sales/dto/propuesta-correccion-correo.dto.ts`
- `src/modules/sales/controllers/orden-correo-relectura.controller.spec.ts`

### Por qué
Releer correo en OV de un correo partido no debe traer las OC de las OV hermanas
