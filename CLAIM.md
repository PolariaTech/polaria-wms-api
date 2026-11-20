<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** POL-441
**Rama:** mauro/pol-441-aceptar-datos-fiscales-y-logo-al-crear-y
**Responsable:** Mauricio Jose Manjarres Duque
**Confianza:** 70%

### Zonas que voy a tocar
- `prisma/schema.prisma`
- `src/modules/configuracion/controllers/empresa.controller.ts`
- `src/modules/configuracion/dto/create-empresa.dto.ts`
- `src/modules/configuracion/dto/update-empresa.dto.ts`
- `src/modules/configuracion/dto/create-empresa-response.dto.ts`
- `src/modules/configuracion/dto/update-empresa-response.dto.ts`
- `src/modules/configuracion/interfaces/empresa.interfaces.ts`
- `src/modules/configuracion/infrastructure/empresa.repository.ts`
- `src/modules/configuracion/services/empresa.service.ts`
- `src/modules/configuracion/services/empresa.service.spec.ts`
- `src/modules/sales/ai/openai-pedido.prompt-snapshot.spec.ts` — autorizada por el usuario el 2026-11-20

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
El alta y la edicion de empresa aceptan la ficha fiscal y el logo
