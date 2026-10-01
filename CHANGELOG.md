# Changelog — polaria-wms-api

Versión de producto alineada con Polaria WMS. Swagger: `2.8.20`.

## 2.8.20 — 2026-10-01

- Endpoints IA pedidos (opcionales / listos): `POST /ventas/leer-pedido`, `POST /ventas/ai/extraer-archivos`.
- En runtime actual el web sigue usando su BFF; estos endpoints requieren `OPENAI_API_KEY` (+ `INTERNAL_API_KEY` para extraer-archivos) en el API si se activan.

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
