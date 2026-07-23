# Seguridad — Polaria WMS API

Stack: **Supabase Auth + PostgreSQL RLS + NestJS guards**.

## Capas

| Capa | Mecanismo |
|------|-----------|
| Autenticación | Supabase Auth; `JwtAuthGuard` |
| Autorización | `TenantGuard`, `RolesGuard`, `SensitiveWriteGuard` |
| Multi-tenant | RLS (lecturas) + validación tenant Prisma (escrituras) |
| Rate limiting | `@nestjs/throttler` global + `@AuthThrottle()` en auth |
| Cabeceras HTTP | `security-headers.middleware.ts` |
| Secretos | Validación `validateSecurityEnv()` al arranque (prod) |

## Endpoints auth protegidos contra abuso

- `POST /auth/prelogin`
- `POST /auth/login`
- `POST /auth/mateo-exchange`

Límite: 15 req/min por IP (throttler `auth`).

## Logout y revocación

`POST /auth/logout` ejecuta `admin.signOut(userId, 'global')` — invalida sesiones Supabase del usuario.

## Permisos operario

Alineado con matriz TXT: `inventory:write`, `warehouse_state:write` vía `ROLE_PERMISSIONS` y `SensitiveWriteGuard`.

## Comandos

```bash
npm run test:e2e -- tenant-isolation
npm run test:e2e -- warehouse-state-lock
```

## Ver también

- [THREAT-MODEL.md](./THREAT-MODEL.md)
- [TENANT-RLS.md](./TENANT-RLS.md)
- `polaria-wms-db/scripts/validate-security-hardening.sql`
