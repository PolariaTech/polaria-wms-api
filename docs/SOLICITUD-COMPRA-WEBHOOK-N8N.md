# Webhook n8n — solicitud de compra

## Flujo

```
Usuario guarda solicitud
  → POST Nest /compras/solicitudes (crea en BD)
  → POST /api/solicitud-compra (route handler Next.js, solo servidor)
  → POST n8n webhook
```

Mismo patrón que `pedido-proveedor`: la URL de n8n **no** va al navegador; vive en variables de entorno del deploy web.

## Variable de entorno (web)

En `.env.local` o en el hosting (Vercel, etc.):

```env
SOLICITUD_COMPRA_WEBHOOK_URL=https://polariatech.app.n8n.cloud/webhook-test/solicitudcompra
```

**No** usar prefijo `NEXT_PUBLIC_`.

## Payload que recibe n8n

```json
{
  "codigo_cuenta": "49M04",
  "telefono": "+573017447947",
  "id_proveedor": "88522d67-4de0-428e-8bec-bf2581916df0",
  "razon_social": "Pat-lafrieda",
  "codigo": "60ERA",
  "estado": "Iniciado",
  "solicitud_compra_linea": [
    {
      "id_producto": "5dbb31df-e070-407e-bb05-d7714afd0a98",
      "sku": "OH2WF",
      "descripcion": "Frozen-Lamb Racks",
      "cantidad": 300
    }
  ],
  "mensaje_final": "Hola, solicito cotización de los productos detallados.",
  "correlationId": "uuid",
  "sentAt": "2026-07-01T20:00:00.000Z"
}
```

- `estado`: al crear, la BD guarda `borrador` y n8n recibe **"Iniciado"**.
- `telefono` / `razon_social`: del proveedor seleccionado.
- Si el proveedor no tiene teléfono, no se envía el webhook (la solicitud sí se guarda).

## Aplicar patch web

```powershell
cd C:\Users\...\Videos\polaria-wms-web
git checkout main
git pull

Invoke-WebRequest `
  -Uri "https://raw.githubusercontent.com/PolariaTech/polaria-wms-api/cursor/solicitud-compra-webhook-n8n-d2d9/docs/patch-solicitud-compra-webhook-n8n-d2d9-web.patch" `
  -OutFile "patch-solicitud-compra-webhook-n8n-d2d9-web.patch"

git am patch-solicitud-compra-webhook-n8n-d2d9-web.patch
npm test
```

## Archivos nuevos en web

- `src/lib/solicitud-compra-n8n/solicitud-compra-n8n.schema.ts`
- `src/app/api/solicitud-compra/route.ts`
- `src/modules/purchases/services/solicitud-compra-n8n-client.service.ts`
- `SolicitudCompraCreateModal.tsx` — dispara el webhook tras crear

## API Nest

Sin cambios: la creación sigue en `POST /compras/solicitudes`.
