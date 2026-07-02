# Crear bodegas vía API (fix RLS configurador)

## Problema

Como **configurador**, crear bodega interna/externa fallaba con:

```
new row violates row-level security policy for table "bodega"
```

El web insertaba directo en Supabase. El API Nest escribe con Prisma (bypass RLS).

**Nota:** `administrador_cuenta` **no crea** bodegas; solo vincula las ya existentes. Este endpoint es solo para **configurador**.

---

## Descargar y aplicar (Windows / PowerShell)

Desde `polaria-wms-web`:

```powershell
cd C:\Users\...\Videos\polaria-wms-web

Invoke-WebRequest -Uri "https://raw.githubusercontent.com/PolariaTech/polaria-wms-api/cursor/bodega-api-create-d2d9/docs/patch-bodega-api-create-d2d9-web.patch" -OutFile "bodega-api.patch"

git apply --3way bodega-api.patch
```

Si `git apply` falla, edita manualmente los 2 archivos (ver sección abajo).

---

## API (obligatorio)

```powershell
cd C:\Users\...\Videos\polaria-wms-api
git fetch origin
git checkout cursor/bodega-api-create-d2d9
npm install
npm run start:dev
```

---

## Archivos web que cambian

| Archivo |
|---------|
| `src/modules/configurator/services/bodegas-internas.service.ts` |
| `src/modules/configurator/services/bodegas-externas.service.ts` |

---

## Cambio manual (si el patch no aplica)

En ambos archivos, **reemplazar** el bloque `runDomainMutation` + `client.from("bodega").insert(...)` por:

```typescript
const created = await apiRequest<{
  idBodega: string;
  capacidadSlots: number | null;
}>("/configuracion/bodegas", {
  method: "POST",
  auth: true,
  headers: {
    [TENANT_HEADER_NAMES.codigoEmpresa]: codigoEmpresa, // solo internas
    [TENANT_HEADER_NAMES.codigoCuenta]: codigoCuenta,
  },
  body: {
    codigoCuenta,
    codigo,
    nombre,
    tipo: "interna", // o "externa"
    capacidadSlots: Math.trunc(input.capacidad),
  },
});

const idBodega = created.idBodega;
```

Imports a agregar (si faltan):

```typescript
import { TENANT_HEADER_NAMES } from "@/lib/tenant-headers";
import { apiRequest } from "@/services/api";
```

Quitar `runDomainMutation` del import si ya no se usa.

---

## Cómo probar

1. API corriendo (`npm run start:dev`)
2. Web: `VITE_API_URL=http://localhost:3000` en `.env`
3. Login **configurador**
4. Configurador → Bodegas internas / externas → Nueva bodega

---

## Endpoint

```
POST /configuracion/bodegas
Rol: configurador
```

Body ejemplo:

```json
{
  "codigoCuenta": "TU_CODIGO_CUENTA",
  "codigo": "BOD-PRUEBA",
  "nombre": "Bodega Prueba",
  "tipo": "interna",
  "capacidadSlots": 10
}
```

Bodega interna: después el web llama automáticamente `POST /configuracion/bodegas/{id}/bootstrap-layout`.
