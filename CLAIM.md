<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-275
**Rama:** dani/req-275-correos-resultado-ov
**Responsable:** Dani
**Confianza:** 60%

### Zonas que voy a tocar
- `src/modules/sales/infrastructure/n8n-correos.client.ts`
- `src/modules/sales/infrastructure/n8n-correos.client.spec.ts`
- `src/modules/sales/dto/correos-response.dto.ts`
- `src/modules/sales/dto/correos-query.dto.ts`
- `src/modules/sales/services/correo-descartado.service.ts`
- `src/modules/sales/services/correo-descartado.service.spec.ts`
- `src/modules/sales/services/correo-descartado.contenido.spec.ts`
- `src/modules/sales/controllers/correo-descartado.controller.ts`
- `src/modules/sales/controllers/correo-descartado.controller.spec.ts`
- `src/modules/sales/infrastructure/correo-ingreso.repository.ts`
- `src/modules/sales/infrastructure/correo-ingreso.repository.spec.ts`
- `src/modules/sales/API.md`
- `CHANGELOG.md` — autorizada por el usuario el 2026-11-09

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Lote correos no tomados (REQ-253, REQ-261, REQ-275): el listado de correos del api expone resultado, confianza, tipo y la OV en que se convirtió cada correo, y guarda en memoria el listado del Puente.
