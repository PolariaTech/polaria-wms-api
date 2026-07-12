# Patch web — flujo procesamiento frio

Aplica los cambios de **servicios** (sin UI) para consumir el flujo completo de procesamiento de la API.

## Rama API

`cursor/frio-procesamiento-d2d9` (mergear o desplegar antes de probar).

## Aplicar en tu PC (polaria-wms-web)

```bash
cd polaria-wms-web
git fetch origin
git checkout main
git pull origin main
git checkout -b cursor/frio-procesamiento-web-d2d9
curl -L -o /tmp/web-proc.patch \
  "https://raw.githubusercontent.com/PolariaTech/polaria-wms-api/cursor/frio-procesamiento-d2d9/docs/patches/polaria-wms-web-frio-procesamiento.patch"
git am /tmp/web-proc.patch
npm run build
git push -u origin cursor/frio-procesamiento-web-d2d9
```

Si `git am` falla por contexto:

```bash
git am --abort
git apply --3way /tmp/web-proc.patch
git add -A && git commit -m "feat(procesamiento): consumir flujo frio vía API Nest (patch)"
```

## Qué incluye (solo servicios)

- `processing-api.service.ts` — endpoints frio: asignar operario, iniciar, cerrar, OT post-cierre, aplicar, terminar, desperdicio sugerido
- `processing.service.ts` — wrappers exportados para la UI existente
- `processing.types.ts` — campos `sobrante_kg`, `kg_primario_descontado`, `perdida_procesamiento_pct`, etc.
- `index.ts` — reexporta nuevas funciones

**No modifica componentes** (`OrdenProcesamientoCreateModal`, páginas operador, etc.).

## Endpoints API consumidos

| Método | Ruta |
|--------|------|
| POST | `/procesamiento/solicitudes` |
| PATCH | `/procesamiento/solicitudes/:id/asignar-operario` |
| POST | `/procesamiento/solicitudes/:id/iniciar` |
| PATCH | `/procesamiento/solicitudes/:id/asignar-procesador` |
| POST | `/procesamiento/solicitudes/:id/cerrar` |
| POST | `/procesamiento/solicitudes/:id/ordenes-post-cierre` |
| POST | `/procesamiento/solicitudes/:id/ordenes/:idOrden/aplicar` |
| POST | `/procesamiento/solicitudes/:id/terminar` |
| GET | `/procesamiento/solicitudes/:id/desperdicio-sugerido` |

## Flujo esperado (frio)

1. Crear solicitud → `pendiente`
2. Jefe asigna operario
3. Operario inicia → descuenta primario, `en_proceso`
4. Procesador cierra con merma → `pendiente_cierre`
5. Jefe crea OT procesado + sobrante
6. Operario aplica OTs al mapa
7. Jefe termina → `terminada`
