# Patch web — flujo operaciones frio

Aplica los cambios del front que consumen la API de operaciones.

## Rama

`cursor/frio-operaciones-web-d2d9` (commit `7f27768`)

## Aplicar en tu PC (polaria-wms-web)

### Opción A — traer la rama ya pusheada (recomendado)

```bash
cd polaria-wms-web
git fetch origin cursor/frio-operaciones-web-d2d9
git checkout cursor/frio-operaciones-web-d2d9
npm install
npm run build
```

### Opción B — aplicar el patch manualmente

**Linux / macOS / Git Bash**

```bash
cd polaria-wms-web
git checkout main && git pull origin main
git checkout -b cursor/frio-operaciones-web-d2d9
curl -L -o /tmp/web-frio.patch \
  "https://raw.githubusercontent.com/PolariaTech/polaria-wms-api/main/docs/patches/polaria-wms-web-frio-operaciones.patch"
git am /tmp/web-frio.patch
npm run build
git push -u origin cursor/frio-operaciones-web-d2d9
```

**Windows PowerShell** (no uses `/tmp`; el `curl` debe ir en **una sola línea**):

```powershell
cd polaria-wms-web
git checkout main; git pull origin main
git checkout -b cursor/frio-operaciones-web-d2d9
curl.exe -L -o "$env:TEMP\web-frio.patch" "https://raw.githubusercontent.com/PolariaTech/polaria-wms-api/main/docs/patches/polaria-wms-web-frio-operaciones.patch"
git am "$env:TEMP\web-frio.patch"
npm run build
git push -u origin cursor/frio-operaciones-web-d2d9
```

Si `git am` falla por contexto:

```bash
git am --abort
git apply --3way /tmp/web-frio.patch   # o en PowerShell: "$env:TEMP\web-frio.patch"
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
