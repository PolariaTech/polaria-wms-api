<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** POL-415
**Rama:** dani/pol-415-marcar-como-fallido-el-ingreso-de-correo-que
**Responsable:** Dani
**Confianza:** 90%

### Zonas que voy a tocar
- `src/modules/sales/infrastructure/correo-ingreso.repository.ts`
- `src/modules/sales/infrastructure/correo-ingreso.repository.spec.ts`
- `src/modules/sales/services/correo-descartado.service.ts`
- `src/modules/sales/services/correo-descartado.service.spec.ts`

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
POL-415 marca como error el ingreso de correo vencido y tipa el parametro del jsonb
