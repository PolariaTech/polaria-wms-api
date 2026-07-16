# Polaria WMS API

API backend del sistema de gestión de almacenes (WMS) de Polaria. Construida con [NestJS 11](https://nestjs.com), TypeScript, Prisma y Supabase Auth.

El proyecto implementa autenticación multitenant, SSO con Mateo, alta de usuarios por rol y un esquema de datos operativo completo en PostgreSQL (Supabase). Varios módulos de negocio están definidos como carpetas placeholder para desarrollo futuro.

**Repositorio:** [github.com/PolariaTech/polaria-wms-api](https://github.com/PolariaTech/polaria-wms-api)  
**Rama activa de desarrollo:** `pol-4` (issue POL-4 — configuración operativa / admin cuenta)  
**Rama estable:** `main`

---

## Tabla de contenidos

- [Repositorio y ramas](#repositorio-y-ramas)
- [Historial de issues y PRs](#historial-de-issues-y-prs)
- [Estado de implementación](#estado-de-implementación)
- [Stack](#stack)
- [Requisitos](#requisitos)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Variables de entorno](#variables-de-entorno)
- [Documentación interactiva (Swagger)](#documentación-interactiva-swagger)
- [Arquitectura](#arquitectura)
- [Roles del sistema](#roles-del-sistema)
- [Endpoints HTTP](#endpoints-http)
- [Módulos](#módulos)
- [Base de datos (Prisma)](#base-de-datos-prisma)
- [Infraestructura transversal (`core`)](#infraestructura-transversal-core)
- [Pruebas](#pruebas)
- [CI/CD](#cicd)
- [Documentación adicional](#documentación-adicional)
- [Árbol completo del proyecto](#árbol-completo-del-proyecto)
- [Licencia](#licencia)

---

## Repositorio y ramas

### Remotes

| Remote | URL |
|---|---|
| `origin` | `https://github.com/PolariaTech/polaria-wms-api.git` |

### Ramas

| Rama | Tipo | Base | Estado | Descripción |
|---|---|---|---|---|
| **`main`** | estable | — | remoto + local | Rama principal mergeada. Auth, tenant, Prisma, configurador usuarios. |
| **`pol-4`** | feature | `main` | remoto + local (**activa**) | POL-4: `POST /administracion/usuarios` para `administrador_cuenta`. Push en `origin/pol-4`. |
| `feat/pol-2-api-tenant-foundation` | feature | `main` | mergeada → `main` | POL-2: guards tenant, contexto multitenant, escritura sensible. PR #2. |
| `cursor/pol-33-prisma-operativo-68e9` | feature | `main` | mergeada → `main` | POL-33: modelo Prisma operativo V2. PR #3. |
| `cursor/configurador-usuarios-api-68e9` | feature | `main` | mergeada → `main` | `POST /configurador/usuarios`. PR #4. |
| `cursor/pol-2-multitenant-rls-2e24` | feature | — | solo remoto | Variante Cursor del trabajo POL-2. |
| `cursor/linear-issues-export-d2d9` | utilidad | — | solo remoto | Exportación issues Linear. |

### Rama `pol-4` — detalle

```
main ──► pol-4
         │
         └── cc30f8e  feat(admin): POST /administracion/usuarios para admin cuenta (POL-4)
```

**Commit publicado en `origin/pol-4`:**

| Archivo | Cambio |
|---|---|
| `src/modules/configurator/controllers/administracion-usuarios.controller.ts` | Controller `POST /administracion/usuarios` |
| `src/modules/configurator/services/administracion-usuarios.service.ts` | Servicio con tenant del JWT |
| `src/modules/configurator/dto/create-administracion-usuario.dto.ts` | DTO sin codigoEmpresa/codigoCuenta en body |
| `src/modules/configurator/configurator.module.ts` | Registro controller + service |
| `test/administracion-usuarios.e2e-spec.ts` | 4 tests e2e |

**Cambios locales en `pol-4` (aún sin commit):** Swagger organizado por rol (`src/core/swagger/`), compilador SWC (`.swcrc`, `nest-cli.json`, `tsconfig.json`), README ampliado.

**PR sugerido:** https://github.com/PolariaTech/polaria-wms-api/pull/new/pol-4

### Comandos git habituales

```bash
# Clonar
git clone https://github.com/PolariaTech/polaria-wms-api.git
cd polaria-wms-api

# Trabajar en POL-4
git checkout pol-4
git pull origin pol-4

# Volver a estable
git checkout main
git pull origin main
```

---

## Historial de issues y PRs

| Issue | PR | Rama | Entregable principal |
|---|---|---|---|
| — | — | — | Login, prelogin, logout, `/auth/me` |
| — | — | — | SSO Mateo (`mateo-handoff`, `mateo-exchange`) |
| **POL-2** | [#2](https://github.com/PolariaTech/polaria-wms-api/pull/2) | `feat/pol-2-api-tenant-foundation` | `JwtAuthGuard`, `TenantGuard`, `TenantService`, `TenantContext`, scope Prisma, `SensitiveWriteGuard` |
| **POL-33** | [#3](https://github.com/PolariaTech/polaria-wms-api/pull/3) | `cursor/pol-33-prisma-operativo-68e9` | Schema Prisma operativo (40 modelos, enums WMS) |
| — | [#4](https://github.com/PolariaTech/polaria-wms-api/pull/4) | `cursor/configurador-usuarios-api-68e9` | `POST /configurador/usuarios` (rol `configurador`) |
| **POL-4** | pendiente | `pol-4` | `POST /administracion/usuarios` (rol `administrador_cuenta`) |

### Línea de tiempo (`main`)

```
239aed0  first commit
9d6fba9  Implementación de login
57f68c3  Mateo integrado (SSO handoff/exchange)
13bc3c7  POL-2: tenant guards y contexto multi-tenant
95eacfa  POL-2: patrón escritura sensible y scope Prisma tenant
112e23f  POL-33: Prisma modelo operativo V2
21c7274  Prisma: alinear modelos migraciones 031-040
47d463d  POST /configurador/usuarios
253fb19  Merge PR #4 (estado actual de main)
```

---

## Estado de implementación

### Funcionalidad entregada

| Área | Estado | Detalle |
|---|---|---|
| Auth Supabase | ✅ | prelogin, login, logout, me |
| SSO Mateo | ✅ | handoff + exchange bidireccional |
| Widget Mateo | ✅ | `widget-token` + `/mateo/conversaciones` |
| Multitenancy | ✅ | Guards, contexto JWT, scope empresa/cuenta/bodega |
| Prisma ORM | ✅ | 40 modelos, cliente en `src/generated/prisma/` |
| Alta usuarios configurador | ✅ | `POST /configurador/usuarios` |
| Alta usuarios admin cuenta | ✅ | `POST /administracion/usuarios` (rama `pol-4`) |
| Swagger OpenAPI | ✅ | `/api/docs`, tags por rol |
| Tests e2e | ✅ | 19 tests (4 suites) |
| Tests unitarios | ✅ | 7 suites en `src/**/*.spec.ts` |
| CI GitHub Actions | ✅ | build + test + e2e en PR a `main` |

### Módulos placeholder (solo estructura + README)

`accounts`, `audit`, `companies`, `files`, `health`, `inventory`, `notifications`, `processing`, `purchases`, `sales`, `settings`, `transport`, `users`, `warehouses`

### Tests unitarios

| Archivo | Cubre |
|---|---|
| `src/app.controller.spec.ts` | AppController |
| `src/modules/auth/auth.service.spec.ts` | AuthService |
| `src/modules/auth/mateo-handoff.service.spec.ts` | MateoHandoffService |
| `src/modules/configurator/services/configurador-usuarios.service.spec.ts` | ConfiguradorUsuariosService |
| `src/core/guards/tenant.guard.spec.ts` | TenantGuard |
| `src/core/guards/sensitive-write.guard.spec.ts` | SensitiveWriteGuard |
| `src/core/database/tenant-scope.util.spec.ts` | Tenant scope utils |

---

## Stack

| Tecnología | Uso |
|---|---|
| NestJS 11 | Framework HTTP, módulos, guards, pipes |
| TypeScript 5 | Lenguaje principal |
| SWC | Compilación rápida (dev y build) |
| Prisma 7 | ORM, acceso directo a PostgreSQL (bypass RLS) |
| Supabase Auth | Login, JWT, creación de usuarios Auth |
| class-validator | Validación de DTOs |
| Swagger (OpenAPI) | Documentación en `/api/docs` |
| Jest + Supertest | Tests unitarios y e2e |

---

## Requisitos

- Node.js 20+ (probado también en Node 24)
- npm
- PostgreSQL accesible vía `DATABASE_URL` (Supabase)
- Proyecto Supabase con Auth habilitado

---

## Instalación y ejecución

```bash
# 1. Clonar e instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env con credenciales reales

# 3. Generar cliente Prisma
npm run prisma:generate

# 4. Desarrollo (hot-reload con SWC)
npm run start:dev

# 5. Producción
npm run build
npm run start:prod
```

La API escucha en `http://localhost:3000` (o el `PORT` definido en `.env`).

> **Nota:** No ejecutes `npm run build` mientras corre `start:dev`; el build borra `dist` y puede interrumpir el servidor en caliente.

### Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run start:dev` | Desarrollo con watch (SWC) |
| `npm run start:debug` | Desarrollo con inspector Node |
| `npm run start:prod` | Ejecuta `dist/src/main.js` |
| `npm run build` | Prisma generate + compilación SWC + tipos Prisma |
| `npm run prisma:generate` | Regenera cliente Prisma |
| `npm run test` | Tests unitarios |
| `npm run test:e2e` | Tests end-to-end |
| `npm run test:cov` | Cobertura |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

---

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `PORT` | No | Puerto HTTP (default `3000`) |
| `SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Sí | Anon key (validación JWT, login) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Service role (crear/borrar usuarios Auth, logout global) |
| `DATABASE_URL` | Sí | Postgres directo para Prisma (rol `postgres`, bypass RLS) |
| `MATEO_HANDOFF_SECRET` | Sí | Secreto JWT para SSO WMS ↔ Mateo |
| `MATEO_WIDGET_JWT_SECRET` | Sí (widget) | Secreto HS256 del chat embebido (= n8n POL-71) |
| `MATEO_WIDGET_JWT_ISSUER` | No | Default `bodega-frio-v2` |
| `MATEO_WIDGET_JWT_AUDIENCE` | No | Default `mateo-support-widget` |
| `MATEO_WIDGET_JWT_KID` | No | Default `local-dev-v1` |
| `MATEO_ALLOWED_ORIGINS` | No | Orígenes CORS permitidos (comma-separated) |

Ver `.env.example` para plantilla comentada.

---

## Documentación interactiva (Swagger)

- **UI:** `GET /api/docs`
- **JSON OpenAPI:** `GET /api/docs-json`

Los endpoints están agrupados por dominio y rol:

| Grupo Swagger | Tag | Descripción |
|---|---|---|
| Autenticación y sesión | `Autenticación` | Login, perfil, SSO Mateo |
| Gestión de usuarios por rol | `Usuarios · Configurador` | Alta usuarios (rol `configurador`) |
| Gestión de usuarios por rol | `Usuarios · Admin cuenta` | Alta usuarios (rol `administrador_cuenta`) |
| Sistema | `Sistema` | Health check |

Autenticación Bearer: botón **Authorize** → pegar JWT de `POST /auth/login`.

---

## Arquitectura

```
Cliente (polaria-wms-web / Mateo)
        │
        ▼
  NestJS API (Prisma → Postgres directo)
        │                    │
        │                    └── Validación tenant en código
        │                        (codigoEmpresa, codigoCuenta, idBodega)
        ▼
  Supabase Auth (JWT, signIn, admin API)
```

- **Scope `platform`:** rol `configurador`; sin tenant fijo en sesión.
- **Scope `tenant`:** resto de roles; sesión ligada a empresa/cuenta/bodega.
- **Guards globales por endpoint:** `JwtAuthGuard`, `TenantGuard`, `RolesGuard` (según ruta).
- **Header opcional:** `x-auth-client: wms | mateo` en prelogin/login (correo vs username).

Documentación detallada:

- [docs/TENANT-RLS.md](docs/TENANT-RLS.md) — Multitenancy y RLS
- [docs/MODELO-OPERATIVO.md](docs/MODELO-OPERATIVO.md) — Modelo operativo WMS
- [docs/MATEO-INTEGRATION.md](docs/MATEO-INTEGRATION.md) — SSO + widget embebido + conversaciones
- [src/modules/mateo-widget/README.md](src/modules/mateo-widget/README.md) — REST historial del widget

---

## Roles del sistema

| Rol | Nivel | Scope | Descripción |
|---|---|---|---|
| `configurador` | plataforma | platform | TI / administración global |
| `administrador_cuenta` | cuenta | tenant | Admin comercial de una cuenta |
| `operador_cuenta` | cuenta | tenant | Operador comercial |
| `administrador_bodega` | bodega | tenant | Admin de bodega |
| `jefe_bodega` | bodega | tenant | Jefe operativo de bodega |
| `custodio` | bodega | tenant | Custodia física |
| `operario` | bodega | tenant | Operario de bodega |
| `procesador` | — | tenant | Procesamiento |
| `transportista` | — | tenant | Transporte |

Constantes en `src/shared/constants/roles.ts` y `permissions.ts`.

---

## Endpoints HTTP

Resumen de **todos** los endpoints implementados. Base URL: `http://localhost:3000`.

### Sistema

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| `GET` | `/` | No | — | Health check básico (mensaje de bienvenida) |

---

### Autenticación (`/auth`)

| Método | Ruta | Auth | Guards | Descripción |
|---|---|---|---|---|
| `POST` | `/auth/prelogin` | No | — | Valida identidad y contexto antes del login |
| `POST` | `/auth/login` | No | — | Login con Supabase Auth; devuelve JWT + contexto |
| `POST` | `/auth/mateo-handoff` | Bearer | Jwt + Tenant | Genera código SSO de un solo uso (60s) |
| `POST` | `/auth/mateo-exchange` | No | — | Canjea código SSO por tokens Supabase |
| `GET` | `/auth/me` | Bearer | Jwt + Tenant | Perfil y contexto de sesión |
| `POST` | `/auth/logout` | Bearer | Jwt | Cierra sesión global en Supabase |

#### `POST /auth/prelogin`

**Headers opcionales:** `x-auth-client: wms | mateo`

**Body:**
```json
{
  "identificador": "usuario o correo@empresa.com",
  "codigoEmpresa": "EMP001"
}
```

**Response 200:**
```json
{
  "ok": true,
  "requiresPassword": true,
  "flow": "platform | tenant",
  "userPreview": {
    "idUsuario": "uuid",
    "nombre": "Nombre Apellido",
    "username": "usuario",
    "idRol": "configurador",
    "nombreRol": "Configurador (TI)",
    "codigoEmpresa": null,
    "codigoCuenta": null
  }
}
```

**Errores:** `400`, `403`, `404`, `422`

---

#### `POST /auth/login`

**Headers opcionales:** `x-auth-client: wms | mateo`

**Body:**
```json
{
  "identificador": "usuario o correo@empresa.com",
  "codigoEmpresa": "EMP001",
  "password": "contraseña"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "v1...",
  "expiresIn": 3600,
  "tokenType": "bearer",
  "context": {
    "idUsuario": "uuid",
    "idRol": "administrador_cuenta",
    "codigoEmpresa": "EMP001",
    "codigoCuenta": "CTA001",
    "scope": "tenant"
  }
}
```

**Errores:** `400`, `401`, `403`, `404`, `422`

---

#### `POST /auth/mateo-handoff`

**Auth:** Bearer JWT

**Response 200:**
```json
{
  "code": "eyJ...",
  "expiresIn": 60
}
```

**Errores:** `401`, `404`

---

#### `POST /auth/mateo-exchange`

**Body:**
```json
{
  "code": "eyJ..."
}
```

**Response 200:** tokens Supabase + perfil de usuario.

**Errores:** `401`, `404`

---

#### `GET /auth/me`

**Auth:** Bearer JWT

**Response 200:** perfil completo (`idUsuario`, `correo`, `idRol`, `nivelRol`, `codigoEmpresa`, `codigoCuenta`, `scope`, `idBodegas[]`, etc.)

**Errores:** `401`, `404`

---

#### `POST /auth/logout`

**Auth:** Bearer JWT

**Response:** `204 No Content`

**Errores:** `401`

> Contrato detallado: [src/modules/auth/API.md](src/modules/auth/API.md)

---

### Configurador — usuarios (`/configurador/usuarios`)

| Método | Ruta | Auth | Rol requerido | Scope |
|---|---|---|---|---|
| `POST` | `/configurador/usuarios` | Bearer | `configurador` | plataforma |

Crea usuario operativo: credenciales en Supabase Auth + fila en `usuario` (+ `asignacion_bodega` si aplica).

**Guards:** `JwtAuthGuard`, `TenantGuard`, `RolesGuard`

**Body:**
```json
{
  "username": "operario.b1",
  "nombre": "Operario Bodega",
  "idRol": "operario",
  "codigoEmpresa": "EMP001",
  "codigoCuenta": "CTA001",
  "idBodega": "550e8400-e29b-41d4-a716-446655440000",
  "correo": "operario@empresa.com",
  "password": "secreto123"
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `username` | Sí | Único |
| `nombre` | Sí | |
| `idRol` | Sí | No `configurador`; no roles plataforma |
| `codigoEmpresa` | Condicional | Obligatorio para roles cuenta/bodega |
| `codigoCuenta` | Condicional | Obligatorio para roles cuenta/bodega |
| `idBodega` | Condicional | Obligatorio para roles bodega |
| `correo` | Sí | Único |
| `password` | Sí | Mín. 6 caracteres |

**Response 201:**
```json
{
  "idUsuario": "uuid",
  "username": "operario.b1",
  "nombre": "Operario Bodega",
  "idRol": "operario",
  "codigoCuenta": "CTA001",
  "correo": "operario@empresa.com"
}
```

**Errores:** `400`, `403`, `404`, `409`

> Documentación: [src/modules/configurator/README.md](src/modules/configurator/README.md)

---

### Administración — usuarios (`/administracion/usuarios`)

| Método | Ruta | Auth | Rol requerido | Scope |
|---|---|---|---|---|
| `POST` | `/administracion/usuarios` | Bearer | `administrador_cuenta` | cuenta (tenant del JWT) |

Crea usuarios de nivel **cuenta** o **bodega** dentro del tenant activo del administrador. `codigoEmpresa` y `codigoCuenta` se toman del contexto JWT, **no** del body.

**Guards:** `JwtAuthGuard`, `TenantGuard`, `RolesGuard`

**Body:**
```json
{
  "username": "operario.b1",
  "nombre": "Operario Bodega",
  "idRol": "operario",
  "idBodega": "550e8400-e29b-41d4-a716-446655440000",
  "correo": "operario@empresa.com",
  "password": "secreto123"
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `username` | Sí | Único |
| `nombre` | Sí | |
| `idRol` | Sí | Solo roles cuenta/bodega; no `configurador` |
| `idBodega` | Condicional | Obligatorio para roles bodega; debe pertenecer al tenant |
| `correo` | Sí | Único |
| `password` | Sí | Mín. 6 caracteres |

**Roles permitidos:** `administrador_cuenta`, `operador_cuenta`, `administrador_bodega`, `jefe_bodega`, `custodio`, `operario`

**Response 201:** igual estructura que configurador.

**Errores:** `400`, `403`, `404`, `409`

---

## Módulos

| Módulo | Ruta base | Estado | Descripción |
|---|---|---|---|
| `auth` | `/auth` | **Implementado** | Login, sesión, SSO Mateo, widget-token |
| `mateo-widget` | `/mateo/conversaciones` | **Implementado** | Historial chat embebido |
| `configurator` | `/configurador`, `/administracion` | **Implementado** | Alta de usuarios por rol |
| `accounts` | — | Placeholder | Contabilidad y cuentas |
| `audit` | — | Placeholder | Auditoría (estructura domain/application/infrastructure) |
| `companies` | — | Placeholder | Empresas / tenants |
| `files` | — | Placeholder | Archivos adjuntos |
| `health` | — | Placeholder | Health checks avanzados |
| `inventory` | — | Placeholder | Stock e inventario |
| `notifications` | — | Placeholder | Notificaciones |
| `processing` | — | Placeholder | Picking, packing, OT |
| `purchases` | — | Placeholder | Compras |
| `sales` | — | Placeholder | Ventas |
| `settings` | — | Placeholder | Configuración |
| `transport` | — | Placeholder | Transporte y envíos |
| `users` | — | Placeholder | Gestión de usuarios (UI admin) |
| `warehouses` | — | Placeholder | Bodegas, zonas, ubicaciones |

Módulos registrados en `AppModule`: `AuthModule`, `ConfiguratorModule`.

---

## Base de datos (Prisma)

- **Schema:** `prisma/schema.prisma`
- **Cliente generado:** `src/generated/prisma/`
- **Config:** `prisma.config.ts`

### Enums principales

`WmsRol`, `RolNivel`, `TipoMovimiento`, `EstadoOrdenCompra`, `EstadoOrdenVenta`, `EstadoOrdenTrabajo`, `EstadoViajeTransporte`, `BodegaTipo`, `TipoAlerta`, `EstadoTarea`, y más.

### Modelos (40 tablas)

| Dominio | Modelos |
|---|---|
| **Identidad y tenant** | `Rol`, `Empresa`, `Cuenta`, `Bodega`, `Usuario`, `AsignacionBodega`, `SolicitudAltaBodega` |
| **Catálogo** | `Producto`, `Proveedor`, `Cliente`, `Comprador`, `Planta`, `Camion` |
| **Ubicaciones** | `TipoUbicacion`, `Zona`, `Ubicacion`, `Lote`, `WarehouseState` |
| **Compras** | `SolicitudCompra`, `SolicitudCompraLinea`, `OrdenCompra`, `OrdenCompraLinea`, `RecepcionCompra`, `RecepcionCompraLinea` |
| **Inventario** | `MovimientoInventario`, `Contador`, `RegistroMerma` |
| **Ventas** | `OrdenVenta`, `OrdenVentaLinea` |
| **Operaciones** | `OrdenTrabajo`, `OrdenTrabajoLinea`, `SolicitudProcesamiento` |
| **Transporte** | `ViajeTransporte`, `GuiaEnvio`, `EvidenciaTransporte` |
| **Sistema** | `AuditoriaOperacion`, `AlertaOperativa`, `TareaCola`, `TareaCuenta`, `SolicitudIntegracion` |

---

## Infraestructura transversal (`core`)

| Carpeta | Contenido |
|---|---|
| `auth/` | `SupabaseAuthService`, `AuthCoreModule` |
| `config/` | `AppConfigModule`, validación de env |
| `database/` | `PrismaService`, `DatabaseModule`, utilidades tenant-scope |
| `decorators/` | `@TenantCtx()` |
| `filters/` | `GlobalExceptionFilter` |
| `guards/` | `JwtAuthGuard`, `TenantGuard`, `RolesGuard`, `SensitiveWriteGuard` |
| `interceptors/` | `RequireTenantContextInterceptor` |
| `swagger/` | Configuración OpenAPI y tags por rol |
| `tenant/` | `TenantService`, `TenantContext`, resolución de sesión |

---

## Pruebas

```bash
npm run test          # Unitarios (src/**/*.spec.ts)
npm run test:e2e      # E2E (test/*.e2e-spec.ts)
npm run test:cov      # Cobertura
```

### Suites e2e

| Archivo | Cobertura |
|---|---|
| `test/app.e2e-spec.ts` | `GET /` |
| `test/auth.e2e-spec.ts` | Endpoints `/auth/*` |
| `test/configurador-usuarios.e2e-spec.ts` | `POST /configurador/usuarios` |
| `test/administracion-usuarios.e2e-spec.ts` | `POST /administracion/usuarios` |

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):

- Trigger: push/PR a `main`
- Node 20
- `npm ci` → `npm run build` → `npm test` → `npm run test:e2e`

---

## Documentación adicional

| Archivo | Contenido |
|---|---|
| [src/README.md](src/README.md) | Punto de entrada al código fuente |
| [src/modules/README.md](src/modules/README.md) | Índice de módulos de negocio |
| [src/core/README.md](src/core/README.md) | Infraestructura transversal |
| [src/shared/README.md](src/shared/README.md) | Constantes, decoradores, utils |
| [test/README.md](test/README.md) | Guía de tests e2e |
| [docs/TENANT-RLS.md](docs/TENANT-RLS.md) | Multitenancy |
| [docs/MODELO-OPERATIVO.md](docs/MODELO-OPERATIVO.md) | Modelo operativo |
| [docs/MATEO-INTEGRATION.md](docs/MATEO-INTEGRATION.md) | Integración Mateo |

Cada subcarpeta incluye su propio `README.md` con la responsabilidad del dominio.

---

## Árbol completo del proyecto

Incluye carpetas vacías (marcadas con `# vacía`). Excluye artefactos generados (`node_modules/`, `dist/`, `coverage/`, `.git/`).

```
polaria-wms-api/                  # Raíz del monorepo API
├── .env                          # Variables locales (no commitear)
├── .env.example                  # Plantilla de entorno
├── .github/
│   ├── README.md
│   └── workflows/
│       ├── ci.yml
│       └── README.md
├── .gitignore
├── .prettierrc
├── .swcrc                        # Configuración compilador SWC
├── docs/
│   ├── MATEO-INTEGRATION.md
│   ├── MODELO-OPERATIVO.md
│   └── TENANT-RLS.md
├── eslint.config.mjs
├── nest-cli.json
├── package.json
├── package-lock.json
├── prisma/
│   └── schema.prisma
├── prisma.config.ts
├── README.md
├── tsconfig.json
├── tsconfig.build.json
├── tsconfig.prisma-client.json
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.controller.spec.ts
│   ├── app.service.ts
│   ├── README.md
│   ├── core/
│   │   ├── README.md
│   │   ├── auth/
│   │   │   ├── README.md
│   │   │   ├── auth-core.module.ts
│   │   │   ├── supabase-auth.service.ts
│   │   │   └── supabase-auth.guard.ts
│   │   ├── config/
│   │   │   ├── README.md
│   │   │   ├── config.module.ts
│   │   │   └── env.config.ts
│   │   ├── database/
│   │   │   ├── README.md
│   │   │   ├── database.module.ts
│   │   │   ├── prisma.service.ts
│   │   │   ├── tenant-scoped.repository.ts
│   │   │   ├── tenant-scope.util.ts
│   │   │   └── tenant-scope.util.spec.ts
│   │   ├── decorators/
│   │   │   └── tenant-context.decorator.ts
│   │   ├── filters/
│   │   │   ├── README.md
│   │   │   └── global-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── README.md
│   │   │   ├── guards.module.ts
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── tenant.guard.ts
│   │   │   ├── tenant.guard.spec.ts
│   │   │   ├── roles.guard.ts
│   │   │   ├── roles.decorator.ts
│   │   │   ├── require-tenant.decorator.ts
│   │   │   ├── sensitive-write.guard.ts
│   │   │   └── sensitive-write.guard.spec.ts
│   │   ├── interceptors/
│   │   │   ├── README.md
│   │   │   └── require-tenant-context.interceptor.ts
│   │   ├── swagger/
│   │   │   ├── setup-swagger.ts
│   │   │   └── swagger.constants.ts
│   │   └── tenant/
│   │       ├── tenant.module.ts
│   │       ├── tenant.service.ts
│   │       ├── tenant.constants.ts
│   │       └── tenant-context.interface.ts
│   ├── generated/
│   │   └── prisma/               # Cliente Prisma generado (no editar)
│   │       ├── client.ts
│   │       ├── enums.ts
│   │       ├── models.ts
│   │       ├── browser.ts
│   │       ├── commonInputTypes.ts
│   │       ├── internal/
│   │       │   ├── class.ts
│   │       │   ├── prismaNamespace.ts
│   │       │   └── prismaNamespaceBrowser.ts
│   │       └── models/
│   │           ├── AlertaOperativa.ts
│   │           ├── AsignacionBodega.ts
│   │           ├── AuditoriaOperacion.ts
│   │           ├── Bodega.ts
│   │           ├── Camion.ts
│   │           ├── Cliente.ts
│   │           ├── Comprador.ts
│   │           ├── Contador.ts
│   │           ├── Cuenta.ts
│   │           ├── Empresa.ts
│   │           ├── EvidenciaTransporte.ts
│   │           ├── GuiaEnvio.ts
│   │           ├── Lote.ts
│   │           ├── MovimientoInventario.ts
│   │           ├── OrdenCompra.ts
│   │           ├── OrdenCompraLinea.ts
│   │           ├── OrdenTrabajo.ts
│   │           ├── OrdenTrabajoLinea.ts
│   │           ├── OrdenVenta.ts
│   │           ├── OrdenVentaLinea.ts
│   │           ├── Planta.ts
│   │           ├── Producto.ts
│   │           ├── Proveedor.ts
│   │           ├── RecepcionCompra.ts
│   │           ├── RecepcionCompraLinea.ts
│   │           ├── RegistroMerma.ts
│   │           ├── Rol.ts
│   │           ├── SolicitudAltaBodega.ts
│   │           ├── SolicitudCompra.ts
│   │           ├── SolicitudCompraLinea.ts
│   │           ├── SolicitudIntegracion.ts
│   │           ├── SolicitudProcesamiento.ts
│   │           ├── TareaCola.ts
│   │           ├── TareaCuenta.ts
│   │           ├── TipoUbicacion.ts
│   │           ├── Ubicacion.ts
│   │           ├── Usuario.ts
│   │           ├── ViajeTransporte.ts
│   │           ├── WarehouseState.ts
│   │           └── Zona.ts
│   ├── modules/
│   │   ├── README.md
│   │   ├── accounts/             # placeholder
│   │   │   └── README.md
│   │   ├── audit/                # placeholder (clean architecture)
│   │   │   ├── README.md
│   │   │   ├── application/
│   │   │   │   └── README.md     # vacía
│   │   │   ├── domain/
│   │   │   │   └── README.md     # vacía
│   │   │   └── infrastructure/
│   │   │       └── README.md     # vacía
│   │   ├── auth/                 # implementado
│   │   │   ├── README.md
│   │   │   ├── API.md
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.service.spec.ts
│   │   │   ├── mateo-handoff.service.ts
│   │   │   ├── mateo-handoff.service.spec.ts
│   │   │   ├── dto/
│   │   │   │   ├── auth-response.dto.ts
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── prelogin.dto.ts
│   │   │   │   ├── mateo-exchange.dto.ts
│   │   │   │   └── mateo-response.dto.ts
│   │   │   ├── infrastructure/
│   │   │   │   └── usuario.repository.ts
│   │   │   ├── interfaces/
│   │   │   │   └── auth.interfaces.ts
│   │   │   └── services/         # vacía
│   │   ├── companies/            # placeholder
│   │   │   └── README.md
│   │   ├── configurator/         # implementado
│   │   │   ├── README.md
│   │   │   ├── configurator.module.ts
│   │   │   ├── controllers/
│   │   │   │   ├── configurador-usuarios.controller.ts
│   │   │   │   └── administracion-usuarios.controller.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-usuario.dto.ts
│   │   │   │   ├── create-usuario-response.dto.ts
│   │   │   │   └── create-administracion-usuario.dto.ts
│   │   │   ├── infrastructure/
│   │   │   │   └── configurador-usuario.repository.ts
│   │   │   ├── interfaces/
│   │   │   │   └── usuarios.interfaces.ts
│   │   │   └── services/
│   │   │       ├── configurador-usuarios.service.ts
│   │   │       ├── configurador-usuarios.service.spec.ts
│   │   │       └── administracion-usuarios.service.ts
│   │   ├── files/                # placeholder
│   │   │   └── README.md
│   │   ├── health/               # placeholder
│   │   │   └── README.md
│   │   ├── inventory/            # placeholder
│   │   │   └── README.md
│   │   ├── notifications/        # placeholder
│   │   │   └── README.md
│   │   ├── processing/           # placeholder
│   │   │   └── README.md
│   │   ├── purchases/            # placeholder
│   │   │   └── README.md
│   │   ├── sales/                # placeholder
│   │   │   └── README.md
│   │   ├── settings/             # placeholder
│   │   │   └── README.md
│   │   ├── transport/            # placeholder
│   │   │   └── README.md
│   │   ├── users/                # placeholder
│   │   │   └── README.md
│   │   └── warehouses/           # placeholder
│   │       └── README.md
│   └── shared/
│       ├── README.md
│       ├── constants/
│       │   ├── README.md
│       │   ├── auth.constants.ts
│       │   ├── auth-client.constants.ts
│       │   ├── permissions.ts
│       │   └── roles.ts
│       ├── decorators/
│       │   ├── README.md
│       │   ├── auth-client.decorator.ts
│       │   └── current-user.decorator.ts
│       ├── dtos/
│       │   └── README.md         # vacía
│       ├── interfaces/
│       │   ├── README.md
│       │   ├── base.interface.ts
│       │   └── user.interface.ts
│       └── utils/
│           ├── README.md
│           └── email.util.ts
└── test/
    ├── README.md
    ├── jest-e2e.json
    ├── app.e2e-spec.ts
    ├── auth.e2e-spec.ts
    ├── configurador-usuarios.e2e-spec.ts
    └── administracion-usuarios.e2e-spec.ts
```

---

## Licencia

UNLICENSED — uso privado [PolariaTech](https://github.com/PolariaTech).
