# Estrategia híbrida tenant + RLS (POL-2)

Polaria WMS combina dos canales de acceso a Postgres según el tipo de operación. Las políticas RLS viven en `polaria-wms-db` (migraciones `015`–`018`); este documento describe cómo el API y el cliente web deben usarlas.

## Resumen

| Canal | Credencial | RLS | Caso de uso |
|-------|------------|-----|-------------|
| Cliente web (lecturas) | Supabase JS + JWT del usuario (`SUPABASE_ANON_KEY`) | **Aplica** | Listados, detalle, catálogos acotados por rol/tenant |
| Backend NestJS (escrituras sensibles) | `DATABASE_URL` (rol `postgres` / service role) | **Bypass** | Inventario, contadores, transacciones operativas |
| Anónimo | `SUPABASE_ANON_KEY` sin sesión | **Aplica** (sin acceso a negocio) | Solo flujos públicos explícitos |

## Lecturas desde el cliente web

El frontend (`polaria-wms-web`) consulta tablas expuestas vía PostgREST usando **supabase-js** con la sesión del usuario autenticado:

1. El usuario inicia sesión (Supabase Auth o handoff Mateo → JWT).
2. El cliente envía el JWT en cada petición a PostgREST.
3. Postgres ejecuta las consultas como rol `authenticated`.
4. Las políticas RLS (`auth_wms_puede_ver_*`, `auth_wms_es_configurador`, etc.) filtran filas según `codigo_empresa`, `codigo_cuenta`, `id_bodega` y asignaciones.

Tablas con RLS de lectura en fase POL-2: `empresa`, `cuenta`, `usuario`, `rol`, `bodega`, `asignacion_bodega`.

**Ventaja:** el aislamiento multi-tenant no depende de que cada query del frontend recuerde filtros manuales; la BD aplica el alcance.

## Escrituras operativas sensibles (solo backend)

Operaciones que modifican estado crítico (movimientos de inventario, contadores, ajustes masivos, lógica transaccional compleja) **no** deben exponerse vía PostgREST al rol `authenticated`.

El API NestJS:

1. Conecta con **Prisma** usando `DATABASE_URL` (conexión directa Postgres, bypass RLS).
2. Valida en código el contexto del tenant antes de cada escritura:
   - `codigo_empresa`
   - `codigo_cuenta`
   - `id_bodega` (cuando aplique)
   - Rol y permisos del usuario que originó la acción
3. Ejecuta la lógica de negocio y commits atómicos.

Hoy el bypass RLS se usa principalmente en **auth fase 1** (lookup de `usuario` por `id_auth`). A medida que crezcan módulos operativos (POL-33+), el mismo patrón aplica: Prisma + validación explícita de tenant.

`SUPABASE_SERVICE_ROLE_KEY` en el backend solo si se necesita Admin API de Supabase (crear usuarios Auth, etc.). **No** sustituye la validación de tenant en código para escrituras de negocio.

## Qué NO hacer

| Anti-patrón | Riesgo |
|-------------|--------|
| Exponer `SUPABASE_SERVICE_ROLE_KEY` o `DATABASE_URL` al frontend | Bypass total de RLS; acceso a toda la BD |
| Confiar solo en RLS para escrituras operativas sensibles | Políticas SELECT no protegen lógica transaccional compleja |
| Duplicar `codigo_empresa` en tablas hijas de `bodega` | Inconsistencia tenant; usar join vía `cuenta` |
| Omitir validación de tenant en servicios Prisma | Conexión `postgres` ve todas las filas |

## Convención tenant (tablas operativas futuras)

Toda tabla operativa nueva debe incluir:

- `codigo_cuenta` → FK `cuenta` (aislamiento comercial)
- `id_bodega` → FK `bodega` (aislamiento físico / operativo)

`codigo_empresa` se resuelve vía `cuenta`; no duplicar en `bodega` ni en sus hijos.

Modelos Prisma alineados: `Bodega`, `AsignacionBodega` (`prisma/schema.prisma`).

## Patrón de escritura sensible

Escrituras de inventario, contadores y `warehouse_state` (POL-33) **solo** por endpoints NestJS protegidos con:

```typescript
@UseGuards(JwtAuthGuard, TenantGuard, SensitiveWriteGuard)
@RequireTenantContext()
```

### Flujo del servicio (pseudocódigo)

```typescript
async registrarMovimiento(
  ctx: TenantContext,
  dto: { codigoCuenta: string; idBodega: string; sku: string; cantidad: number },
) {
  // 1. Validar scope: nunca confiar en codigoCuenta/idBodega del body sin cruzar con ctx
  assertOperationalTenantScope(ctx, {
    codigoCuenta: dto.codigoCuenta,
    idBodega: dto.idBodega,
  });

  return this.prisma.$transaction(async (tx) => {
    // 2. Lecturas/updates acotados por tenant (Prisma bypass RLS)
    const estado = await tx.warehouseState.findFirst({
      where: applyTenantFilter(
        { codigoCuenta: dto.codigoCuenta, idBodega: dto.idBodega, sku: dto.sku },
        ctx,
      ),
    });

    // 3. Lógica de negocio + escritura
    // await tx.inventoryMovement.create({ ... });

    // 4. Auditoría (placeholder POL-33)
    // await this.auditService.registrar({
    //   idUsuario: ctx.idUsuario,
    //   accion: 'inventory.movement',
    //   codigoCuenta: dto.codigoCuenta,
    //   idBodega: dto.idBodega,
    //   metadata: { sku: dto.sku, cantidad: dto.cantidad },
    // });

    return estado;
  });
}
```

### Utilidades disponibles

| Artefacto | Ubicación | Uso |
|-----------|-----------|-----|
| `applyTenantFilter(where, ctx)` | `core/database/tenant-scope.util.ts` | Fusiona `codigoCuenta` / `idBodega` en `where` de Prisma |
| `assertOperationalTenantScope(ctx, payload)` | idem | Lanza `403` si el body trae tenant ajeno o cuenta fuera de `codigosCuentaEmpresa` |
| `TenantScopedRepository` | `core/database/tenant-scoped.repository.ts` | Base para repos POL-33 |
| `SensitiveWriteGuard` | `core/guards/sensitive-write.guard.ts` | Solo `configurador`, `administrador_bodega`, `jefe_bodega` |
| `PERMISSION` / `ROLE_PERMISSIONS` | `shared/constants/permissions.ts` | Matriz mínima documentada |
| `ROLES_ESCRITURA_INVENTARIO` | `shared/constants/roles.ts` | Roles con escritura inventario |

### Regla de oro

Los campos `codigoCuenta` e `idBodega` del request son **hints operativos**, no prueba de autorización. La autorización viene de `TenantContext` (JWT + guards) y de `assertOperationalTenantScope`.

## Cierre POL-138 (auditoría multi-tenant)

Validación formal de aislamiento por empresa:

| Capa | Artefacto | Comando |
|------|-----------|---------|
| BD RLS | `polaria-wms-db/scripts/validate-rls-pol138.sql` | Tras multitenant + operativo |
| API guards | `test/tenant-isolation.e2e-spec.ts` | `npm run test:e2e -- tenant-isolation` |
| Widget RLS | migración `052_widget_conversacion_rls_cuenta.sql` | `codigo_cuenta` alineado a tenant |

`TenantService.buildContext` carga `codigosCuentaEmpresa` para validar escrituras Prisma cuando el usuario es admin de empresa sin `codigoCuenta` fijo.

## Próximos pasos (fuera de este ticket)

- ~~Guards/interceptors NestJS que extraigan tenant del JWT y validen antes de Prisma.~~ (POL-2 guards implementados)
- Módulos operativos POL-33 consumiendo `TenantScopedRepository` + `SensitiveWriteGuard`.
- REVOKE explícito de INSERT/UPDATE/DELETE en tablas sensibles para `authenticated` (patrón `warehouse_state` en POL-33).

## Referencias

- [polaria-wms-db: rls-politicas.md](https://github.com/polaria/polaria-wms-db/blob/main/docs/rls-politicas.md)
- Migración `017_bodega_base.sql` — esquema `bodega` / `asignacion_bodega`
- `.env.example` — variables `DATABASE_URL` vs `SUPABASE_ANON_KEY`
