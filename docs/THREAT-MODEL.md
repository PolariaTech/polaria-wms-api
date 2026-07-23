# Modelo de amenazas — Polaria WMS V2

Documento STRIDE-lite para Supabase Auth + RLS + API NestJS.

## Activos

| Activo | Ubicación |
|--------|-----------|
| Datos operativos multi-tenant | PostgreSQL (Supabase) |
| Credenciales usuarios | Supabase Auth |
| Tokens sesión / JWT widget | Cliente (memoria/localStorage) + headers API |
| Secretos integración | Env servidor (API, route handlers web) |

## Amenazas y controles

| Amenaza | Vector | Control implementado |
|---------|--------|----------------------|
| **Spoofing** | Token JWT falsificado | `JwtAuthGuard` + validación Supabase `getUser` |
| **Tampering** | Mutación cross-tenant | RLS + `TenantGuard` + `assertOperationalTenantScope` |
| **Repudiation** | Negar acción operativa | `auditoria_operacion` append-only; `security_event` (053) |
| **Information disclosure** | Lectura empresa ajena | RLS políticas POL-138; tests `tenant-isolation` |
| **Denial of service** | Flood login/API | `@nestjs/throttler` auth + tenant tracker; rate limit web resolve-tenant |
| **Elevation of privilege** | UI bypass | `SensitiveWriteGuard` + RLS; no service role en browser |

## Superficies de ataque

1. **Browser → PostgREST** — mitigado por RLS + anon key + JWT usuario.
2. **Browser → API Nest** — mitigado por guards + validación tenant en Prisma.
3. **Browser → Next route handlers** — secretos solo `SUPABASE_SERVICE_ROLE_KEY` server; sin `NEXT_PUBLIC_` fallback en prod.
4. **Widget Mateo → n8n** — JWT efímero 300s; validación POL-137/138.
5. **Mateo SSO** — código one-time 60s firmado con `MATEO_HANDOFF_SECRET`.

## Controles pendientes (roadmap)

- MFA obligatoria Supabase para `configurador` y `administrador_cuenta` (config dashboard Supabase).
- WAF / edge rate limiting (Vercel/Render).
- Pruebas de carga y SLOs documentados.
- DR: RPO/RTO y runbook failover Supabase.

## Referencias

- `docs/SECURITY.md` (API)
- `polaria-wms-web/docs/SECURITY.md`
- `docs/TENANT-RLS.md`
- `scripts/validate-security-hardening.sql`
