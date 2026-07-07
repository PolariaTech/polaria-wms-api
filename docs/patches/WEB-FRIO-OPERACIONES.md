# Patch web — flujo operaciones frio

Aplica los cambios del front que consumen la API de operaciones.

## Rama

`cursor/frio-operaciones-web-d2d9` (commit `7f27768`)

## Aplicar en tu PC (polaria-wms-web)

```bash
cd polaria-wms-web
git fetch origin
git checkout main
git pull origin main
git checkout -b cursor/frio-operaciones-web-d2d9
curl -L -o /tmp/web-frio.patch \
  "https://raw.githubusercontent.com/PolariaTech/polaria-wms-api/cursor/frio-operaciones-bodega-d2d9/docs/patches/polaria-wms-web-frio-operaciones.patch"
git am /tmp/web-frio.patch
npm run build
git push -u origin cursor/frio-operaciones-web-d2d9
```

Si `git am` falla por contexto:

```bash
git am --abort
git apply --3way /tmp/web-frio.patch
git add -A && git commit -m "feat(operaciones): consumir API Nest (patch)"
```

## Qué incluye

- `operations-api.service.ts` — OT, tareas, alertas, llamadas, reportes
- `processing-api.service.ts` — solicitudes procesamiento
- Jefe bodega: modales crean OT y procesamiento
- Operario/procesador: cola, completar, llamar jefe
- Reportes admin/jefe vía API

## API requerida

Rama API: `cursor/frio-operaciones-bodega-d2d9` (mergear o desplegar antes de probar).
