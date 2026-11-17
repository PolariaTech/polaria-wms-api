<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-314
**Rama:** dani/req-314-descartados-ingresados
**Responsable:** Dani
**Confianza:** 85%

### Zonas que voy a tocar
- `src/modules/sales/dto/correos-query.dto.ts`
- `src/modules/sales/dto/correos-response.dto.ts`
- `src/modules/sales/infrastructure/correo-entrada.consultas.ts`
- `src/modules/sales/infrastructure/correo-entrada.consultas.spec.ts`
- `src/modules/sales/infrastructure/correo-ingreso.repository.ts`
- `src/modules/sales/infrastructure/correo-ingreso.repository.spec.ts`
- `src/modules/sales/services/correo-descartado.service.ts`
- `src/modules/sales/services/correo-descartado.service.spec.ts`
- `src/modules/sales/controllers/correo-descartado.controller.ts`
- `src/modules/sales/controllers/correo-descartado.controller.spec.ts`
- `src/modules/sales/API.md`
- `CHANGELOG.md`

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Descartados sin los ya ingresados, modo procesados y fila de un correo (REQ-314, REQ-318)
