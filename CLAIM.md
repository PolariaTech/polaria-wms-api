<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-317
**Rama:** dani/req-317-gmail-lectura-correos
**Responsable:** Dani
**Confianza:** 80%

### Zonas que voy a tocar
- `src/modules/sales/infrastructure/n8n-correos.client.ts`
- `src/modules/sales/infrastructure/n8n-correos.client.spec.ts`
- `src/modules/sales/services/correo-descartado.service.ts`
- `src/modules/sales/services/correo-descartado.contenido.spec.ts`
- `src/modules/sales/services/correo-descartado.ingreso.spec.ts`
- `src/modules/sales/services/correo-descartado.service.spec.ts`
- `src/modules/sales/sales.module.ts`
- `src/modules/sales/API.md`
- `CHANGELOG.md`
- `.env.example`
- `package.json`
- `package-lock.json`
- `src/modules/sales/services/correo-descartado.fila.spec.ts` — autorizada por el usuario el 2026-11-17
- `src/modules/sales/services/correo-descartado.service.orden.spec.ts` — autorizada por el usuario el 2026-11-17

### Compartidos (cambio mínimo y aviso)
- `CHANGELOG.md`
- `package.json`
- `package-lock.json`

### Por qué
Sustituir el puente n8n de lectura de correos por Gmail API al buzón compartido
