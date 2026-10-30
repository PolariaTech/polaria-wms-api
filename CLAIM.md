<!-- polaria-reclamo v1 -->
## 🔒 Reclamo de trabajo en paralelo

**Estado:** ACTIVO
**Issue:** REQ-231
**Rama:** dani/req-231-direccion-correo-aplicativo
**Responsable:** Dani
**Confianza:** 70%

### Zonas que voy a tocar
- `src/modules/sales/ai/openai-pedido.client.ts#extraerPedido`
- `src/modules/sales/ai/openai-pedido.client.spec.ts`
- `src/modules/sales/ai/utils/direccion-correo-aplicativo.ts` — archivo nuevo
- `src/modules/sales/ai/utils/direccion-correo-aplicativo.spec.ts` — archivo nuevo

### Compartidos (cambio mínimo y aviso)
Ninguno.

### Por qué
Punto 1 de REQ-231: la dirección de los correos del aplicativo se guarda como correo + lista de precios; la línea Dirección: del correo debe mandar sobre la regla Ship To
