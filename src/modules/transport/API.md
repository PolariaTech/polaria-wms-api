# Transporte

## Base path

`/transporte`

Bearer JWT + tenant scope.

## Endpoints

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| POST | `/paquetes-despacho` | Armar paquete OV → viaje + guías → camión ocupado | configurador, admin/jefe bodega, custodio |
| POST | `/entregas` | Cerrar entrega (foto/firma Cloudinary + cantidades + conformidad) | configurador, transportista, admin/jefe |

### Body

```json
{
  "codigoCuenta": "49M04",
  "idBodega": "uuid",
  "idCamion": "uuid",
  "idOrdenesVenta": ["uuid", "uuid"]
}
```

### Efectos

1. Valida camión `disponible=true` de la cuenta
2. Valida OVs de la misma bodega/cuenta sin guía previa
3. Crea `viaje_transporte` (`programado`, TV-####) + `guia_envio` por OV (GE-####, estado `asignada`)
4. Completa despacho de líneas pendientes y deja OV en `despachada`
5. Consume stock de ubicaciones de salida (`es_picking`) con movimiento `despacho`
6. Marca camión `disponible=false`

El rol transportista lista el viaje en `/dashboard/transporte` vía `listViajesEntrega`.
