# modules/mateo-widget

Persistencia de conversaciones del **widget Mateo embebido** en Polaria WMS.

## Endpoints

Prefijo: `/mateo/conversaciones`  
Guards: `JwtAuthGuard` + `TenantGuard` (Bearer **sesión WMS**, no el JWT de n8n).

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Lista del usuario autenticado |
| GET | `/:id` | Detalle + mensajes (`ParseUUIDPipe`) |
| POST | `/` | Crear `{ titulo? }` |
| POST | `/:id/mensajes` | Append `{ rol, tipo?, contenido, esError?, createdAt? }` |
| DELETE | `/:id` | Eliminar si es dueño |

## Auth en el host

| Uso | Token |
|-----|--------|
| n8n (chat) | JWT de `POST /auth/mateo/widget-token` |
| Este CRUD | Bearer Supabase de la sesión WMS (`conversationTokenFetcher`) |

## Modelo

Tablas Supabase: `widget_conversacion` / `widget_mensaje`  
Migración: `polaria-wms-db` → `051_widget_mateo_conversaciones.sql`  
Prisma: `WidgetConversacion` / `WidgetMensaje`

## Docs

- [docs/MATEO-INTEGRATION.md](../../../docs/MATEO-INTEGRATION.md)
- [polaria-wms-db WIDGET-MATEO-CONVERSACIONES](https://github.com/PolariaTech/polaria-wms-db/blob/main/docs/WIDGET-MATEO-CONVERSACIONES.md)
