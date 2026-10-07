# Changelog — polaria-wms-api

Versión de producto alineada con Polaria WMS. Swagger: `2.9.12`.

## 2.9.15 — 2026-10-07

- Leer pedido (Mateo): al armar `origenCorreo` ahora persiste también entrega (dirección, andén, teléfono, ventanas, notas, contacto) que ya extraía OpenAI pero no copiaba al JSON.

## 2.9.14 — 2026-10-07

- Leer pedido (Mateo): prompt de matching de catálogo más estricto (null si hay variantes ambiguas); validación/coacción de `productoCatalogo` contra claves reales del catálogo.

## 2.9.12 — 2026-10-06

- Estados de OV **alistamiento** / **alistada** en el flujo operativo.
- Listado de OV por `created_at` (más reciente primero).

## 2.8.20 — 2026-10-01

- Endpoints IA de integración (sin login de usuario): `POST /ventas/leer-pedido` y `POST /ventas/ai/extraer-archivos` con `X-Api-Key` (`PEDIDO_IA_API_KEY`) o `X-Internal-Api-Key`.
- OpenAI sigue solo en el servidor (`OPENAI_API_KEY` / `OPENAI_MODEL`).

## 2.8.12 — 2026-09-30

- Versión OpenAPI / Swagger fijada a 2.8.12.

## 2.7.15 — 2026-09-25

- Versión OpenAPI / Swagger fijada a 2.7.15.
- TTL de sesión WMS y JWT del widget Mateo: **23 días** (1987200 s). El handoff SSO one-time sigue en **60 s**.

## 2.7.5 — 2026-09-17

- Acceso WMS/Mateo en `usuario` (`acceso_wms` / `acceso_mateo`).
- PATCH de usuarios del configurador y sesión con esos flags.
- Versión OpenAPI / Swagger fijada a 2.7.5.

## 2.4.9 — 2026-09-03

- Emitir OV idempotente: si ya está confirmada (o más adelante), no falla al reintentar.
- Versión OpenAPI / Swagger fijada a 2.4.9.

## 2.4.3 — 2026-08-29

- Versión OpenAPI / Swagger fijada a 2.4.3.
- Compatible con sesión WMS 12 h, Mateo y catálogo (alias en web/BD).
