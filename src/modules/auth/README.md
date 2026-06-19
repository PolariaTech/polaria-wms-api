# modules/auth

Autenticación y autorización a nivel de negocio (Supabase Auth + `public.usuario`).

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/prelogin` | Valida identidad y contexto (platform/tenant) |
| POST | `/auth/login` | Autentica con Supabase y retorna tokens |
| POST | `/auth/mateo-handoff` | Genera código SSO para Mateo (requiere Bearer) |
| POST | `/auth/mateo-exchange` | Canjea código SSO y retorna tokens |
| GET | `/auth/me` | Perfil y scope del usuario autenticado |
| POST | `/auth/logout` | Cierra sesión global en Supabase |

Contrato completo: [API.md](./API.md)  
Integración Mateo: [docs/MATEO-INTEGRATION.md](../../../docs/MATEO-INTEGRATION.md)

## Configuración

Copiar `.env.example` → `.env` y completar credenciales de Supabase (`zmdokvjewvqaftnvulsr`) y `MATEO_HANDOFF_SECRET`.
