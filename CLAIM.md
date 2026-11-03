<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-104
**Rama:** dani/req-104-correos-descartados-ingreso
**Responsable:** Dani
**Confianza:** 60%

### Zonas que voy a tocar
- `src/modules/sales/sales.module.ts`
- `src/modules/sales/README.md`
- `src/modules/sales/API.md`
- `src/modules/sales/controllers/correo-descartado.controller.ts` — archivo nuevo
- `src/modules/sales/controllers/correo-descartado.controller.spec.ts` — archivo nuevo
- `src/modules/sales/services/correo-descartado.service.ts` — archivo nuevo
- `src/modules/sales/services/correo-descartado.service.spec.ts` — archivo nuevo
- `src/modules/sales/infrastructure/n8n-correos.client.ts` — archivo nuevo
- `src/modules/sales/infrastructure/n8n-correos.client.spec.ts` — archivo nuevo
- `src/modules/sales/infrastructure/correo-ingreso.repository.ts` — archivo nuevo
- `src/modules/sales/infrastructure/correo-ingreso.repository.spec.ts` — archivo nuevo
- `src/modules/sales/dto/correos-query.dto.ts` — archivo nuevo
- `src/modules/sales/dto/correos-response.dto.ts` — archivo nuevo
- `src/modules/sales/dto/ingreso-correo-response.dto.ts` — archivo nuevo

### Compartidos (cambio mínimo y aviso)
- `prisma/schema.prisma`
- `.env.example`
- `CHANGELOG.md`

### Por qué
Endpoints para listar correos del data table de n8n, ingreso manual como OV y registro message_id con OV
