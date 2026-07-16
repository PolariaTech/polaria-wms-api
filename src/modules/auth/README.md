# modules/auth

Autenticación y autorización a nivel de negocio (Supabase Auth + `public.usuario`).

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/prelogin` | Valida identidad y contexto (platform/tenant) |
| POST | `/auth/login` | Autentica con Supabase y retorna tokens |
| POST | `/auth/mateo-handoff` | Genera código SSO para Mateo (requiere Bearer) |
| POST | `/auth/mateo-exchange` | Canjea código SSO y retorna tokens |
| POST | `/auth/mateo/widget-token` | JWT HS256 del widget embebido (n8n POL-71) |
| GET | `/auth/me` | Perfil y scope del usuario autenticado |
| POST | `/auth/logout` | Cierra sesión global en Supabase |

Contrato completo: [API.md](./API.md)  
Integración Mateo (SSO + widget): [docs/MATEO-INTEGRATION.md](../../../docs/MATEO-INTEGRATION.md)  
Conversaciones del widget: módulo `mateo-widget` → `/mateo/conversaciones`

## Configuración

Copiar `.env.example` → `.env` y completar Supabase, `MATEO_HANDOFF_SECRET` y **`MATEO_WIDGET_JWT_SECRET`** (mismo valor que el guard n8n; ver `iss`/`aud`/`kid` en MATEO-INTEGRATION).
