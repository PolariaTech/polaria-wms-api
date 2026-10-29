<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-187
**Rama:** dani/req-187-chat-ot-extension-leer-pedido
**Responsable:** Dani
**Confianza:** 95%

### Zonas que voy a tocar
- `src/modules/sales/controllers/orden-correo-relectura.controller.ts`
- `src/modules/sales/controllers/orden-correo-relectura.controller.spec.ts` — archivo nuevo

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Corrección del 429 en la consulta de la relectura: la consulta debe saltar también el límite auth
