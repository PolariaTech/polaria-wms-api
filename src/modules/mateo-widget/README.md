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

Tablas Supabase: `mateo_support.widget_conversacion` / `mateo_support.widget_mensaje`  
Migración: `polaria-wms-db` → `051` + `055_widget_tables_mateo_support_schema.sql`  
Prisma: `WidgetConversacion` / `WidgetMensaje` (`@@schema("mateo_support")`)

## Docs

- [docs/MATEO-INTEGRATION.md](../../../docs/MATEO-INTEGRATION.md)
- [polaria-wms-db WIDGET-MATEO-CONVERSACIONES](https://github.com/PolariaTech/polaria-wms-db/blob/main/docs/WIDGET-MATEO-CONVERSACIONES.md)
