# Linear Issues Export — Team POLARIA

**Export Date:** 2026-06-22  
**Team:** POLARIA  
**Total Issues:** 45 (POL-1 through POL-45)  
**Source:** Linear MCP (`get_issue` with `includeRelations: true`)

---

## Table of Contents

### Polaria App - Construir aplicación web v2.0

- [POL-1: Base backend modular NestJS para Polaria web v2.0](#pol-1)
- [POL-2: Configurar multi-tenant y RLS base en Supabase](#pol-2)
- [POL-3: Desarrollar módulo de autenticación para Polaria web v2.0](#pol-3)
- [POL-4: Desarrollar módulo de configuración operativa](#pol-4)
- [POL-5: Desarrollar módulo de ingreso de mercancía](#pol-5)
- [POL-6: Implementar mapa de bodega con bloqueo en tiempo real](#pol-6)
- [POL-7: Desarrollar módulo de procesamiento](#pol-7)
- [POL-8: Desarrollar módulo de ventas](#pol-8)
- [POL-9: Desarrollar módulo de transporte](#pol-9)
- [POL-10: Desarrollar reportería operativa de Polaria web v2.0](#pol-10)
- [POL-11: Integrar Cloudinary para evidencias del flujo operativo](#pol-11)
- [POL-12: Validar flujo E2E desde ingreso hasta cierre de transporte](#pol-12)
- [POL-13: Probar concurrencia y no duplicidad para roles WMS](#pol-13)
- [POL-31: Base frontend Next.js y shell multi-rol (dashboard + configurador)](#pol-31)
- [POL-32: Integrar n8n para pedidos a proveedor](#pol-32)
- [POL-33: Esquema BD operativo V2 (bodegas, catálogos, órdenes, warehouse_state)](#pol-33)
- [POL-34: Desarrollar módulo de compras (SOL y OC)](#pol-34)
- [POL-35: Implementar frontend Next.js v2.0 multi-rol (dashboard y módulos operativos)](#pol-35)
- [POL-36: Diseñar e implementar migración de datos v1.0 → v2.0 con reconciliación](#pol-36)
- [POL-37: Construir onboarding de configurador (empresa → tenant → bodega → admin cuenta)](#pol-37)
- [POL-38: Integrar inventario de bodega externa Fridem en modo solo lectura](#pol-38)
- [POL-39: Automatizar calidad v2.0: CI/CD + pruebas E2E + pruebas de concurrencia](#pol-39)
- [POL-40: Completar modelo operativo DB v2.0: bodegas, inventario, órdenes y RLS](#pol-40)
- [POL-41: Construir frontend operativo por roles y módulos v2.0](#pol-41)
- [POL-42: Implementar cola operativa, órdenes de trabajo y trazabilidad de movimientos](#pol-42)
- [POL-43: Integrar bodega externa Fridem en modo solo lectura](#pol-43)
- [POL-44: Implementar catálogos, SOL/OC y compras antes de ingreso](#pol-44)
- [POL-45: Integrar Bodega Externa Fridem (inventario en solo lectura)](#pol-45)

### Mateo Support - Desplegar v1.2.0 en producción

- [POL-21: Conectar manual de usuario al flujo de consulta de Mateo Support](#pol-21)
- [POL-22: Consultar el manual antes de crear cada ticket](#pol-22)
- [POL-23: Habilitar recepción de imágenes por WhatsApp en Mateo Support](#pol-23)
- [POL-24: Activar Error Handler de Mateo Support en producción](#pol-24)
- [POL-25: Validar creación autónoma de tickets en Linear](#pol-25)
- [POL-26: Desplegar Mateo Support v1.2.0 y verificar estabilidad](#pol-26)

### Mateo - Desplegar consultas deterministas en Supabase

- [POL-14: Configurar nodo IA con personalidad humanizada en Mateo](#pol-14)
- [POL-15: Construir tool determinista n8n a Supabase para consultas](#pol-15)
- [POL-16: Conectar vistas de inventario para Mateo compras y ventas](#pol-16)
- [POL-17: Conectar vistas TCI de kardex compras ventas y facturación](#pol-17)
- [POL-18: Crear suite de pruebas de precisión sin alucinaciones](#pol-18)
- [POL-19: Optimizar latencia de consultas IA y Supabase](#pol-19)
- [POL-20: Validar despliegue final de Mateo determinista en pruebas](#pol-20)
- [POL-27: Construir Casos de Uso Mateo TCI (KPI1, KPI2 y KPI3)](#pol-27)
- [POL-28: Construir Casos de Uso Mateo Polaria — Compras y Ventas (KPI1, KPI2 y KPI3)](#pol-28)
- [POL-29: Mapeo e Integración de Vistas de Ventas y Compras - Revisar Flujo IA/Tool](#pol-29)
- [POL-30: Mapeo e Integración de la Vista de Kardex y Facturación - Revisar Flujo IA/Tool](#pol-30)

---

## Issues by Project

# Polaria App - Construir aplicación web v2.0

_28 issue(s)_

## POL-1: Base backend modular NestJS para Polaria web v2.0 {#pol-1}

| Field | Value |
|-------|-------|
| **ID** | POL-1 |
| **Title** | Base backend modular NestJS para Polaria web v2.0 |
| **URL** | [https://linear.app/polaria/issue/POL-1](https://linear.app/polaria/issue/POL-1) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-1-base-backend-modular-nestjs-para-polaria-web-v20` |
| **Created At** | 2026-06-18T21:55:49.105Z |
| **Updated At** | 2026-06-22T12:25:15.310Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Medium

Descripción (What)
Construir la base del backend modular en NestJS para soportar la aplicación web v2.0 de operación de bodega fría, dejando preparada la estructura técnica para autenticación, configuración, ingreso, mapa, procesamiento, ventas, transporte y reportería.

Justificación de Negocio (Why)
Esta base es necesaria para habilitar la nueva arquitectura SaaS multi-tenant y reemplazar la lógica monolítica de la v1.0.

Referencias

* Repo: `polaria-wms-api`
* Doc: secciones 3 (Stack), 4 (Arquitectura)

---

✅ COMPLETADO: El backend NestJS está construido con estructura modular (Prisma, Supabase Admin SDK, Swagger, ValidationPipe, GlobalExceptionFilter, SupabaseAuthGuard). El módulo de auth está operativo con endpoints `/auth/prelogin`, `/auth/login`, `/auth/me`, `/auth/logout` y handoff SSO Mateo.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

- [POL-31](https://linear.app/polaria/issue/POL-31) — Base frontend Next.js y shell multi-rol (dashboard + configurador)

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-2: Configurar multi-tenant y RLS base en Supabase {#pol-2}

| Field | Value |
|-------|-------|
| **ID** | POL-2 |
| **Title** | Configurar multi-tenant y RLS base en Supabase |
| **URL** | [https://linear.app/polaria/issue/POL-2](https://linear.app/polaria/issue/POL-2) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-2-configurar-multi-tenant-y-rls-base-en-supabase` |
| **Created At** | 2026-06-18T21:55:49.239Z |
| **Updated At** | 2026-06-22T12:25:57.414Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Urgent

Descripción (What)
Configurar la base multi-tenant y las políticas iniciales de Row Level Security en Supabase para aislar la operación por cuenta y habilitar seguridad por diseño en la aplicación web v2.0.

Justificación de Negocio (Why)
El aislamiento por tenant y el control de acceso son indispensables para operar la plataforma SaaS de forma segura y evitar accesos cruzados entre empresas/cuentas.

Alcance técnico

**Schema (HECHO ✅ en polaria-wms-db):**

* Migraciones 001–014: extensiones, enums (`wms_rol`, `rol_nivel`), tablas `rol`, `empresa`, `cuenta`, `usuario`.
* Prisma schema en `polaria-wms-api` refleja el modelo completo.

**Pendiente ⏳:**

* Escribir políticas RLS en Supabase para todas las tablas: filtrar por `codigo_cuenta` (tenant) y por `id_bodega` donde aplique.
* Política del configurador: `codigo_cuenta IS NULL` ve empresas/tenants; otros solo ven su tenant.
* Políticas de escritura sensible (inventario, contadores TV): solo vía NestJS + service role.
* Migración 015+ para RLS en `polaria-wms-db`.

Referencias

* Repo: `polaria-wms-db`, `polaria-wms-api`
* Doc: secciones 1.1, 4 (Seguridad de datos), 7 (Modelo de datos)

### Relations

**Blocks:**

- [POL-33](https://linear.app/polaria/issue/POL-33) — Esquema BD operativo V2 (bodegas, catálogos, órdenes, warehouse_state)

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-3: Desarrollar módulo de autenticación para Polaria web v2.0 {#pol-3}

| Field | Value |
|-------|-------|
| **ID** | POL-3 |
| **Title** | Desarrollar módulo de autenticación para Polaria web v2.0 |
| **URL** | [https://linear.app/polaria/issue/POL-3](https://linear.app/polaria/issue/POL-3) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-3-desarrollar-modulo-de-autenticacion-para-polaria-web-v20` |
| **Created At** | 2026-06-18T21:55:49.368Z |
| **Updated At** | 2026-06-22T12:25:33.758Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Desarrollar el módulo de autenticación para la aplicación web v2.0, contemplando el acceso seguro de usuarios dentro de la arquitectura SaaS multi-tenant.

Flujo V2.0:

1. Ingresar `codigoEmpresa` (solo usuarios tenant; el configurador no lo necesita).
2. Ingresar correo/usuario.
3. Solicitar contraseña (Supabase Auth).

Referencias

* Repos: `polaria-wms-api`, `polaria-wms-web`
* Doc: secciones 1.1 (Auth V2.0), 6.2 (Autenticación y Bootstrap)

---

**Estado actual:**

✅ Backend (`polaria-wms-api`): COMPLETO

* `POST /auth/prelogin` — valida empresa y usuario
* `POST /auth/login` — autentica con Supabase Auth
* `GET /auth/me` — perfil de sesión
* `POST /auth/logout` — invalida sesión
* Handoff SSO Mateo (`mateo-handoff` / `mateo-exchange`)
* SupabaseAuthGuard, CurrentUser decorator

⏳ Frontend (`polaria-wms-web`): EN PROGRESO

* Componentes listos: `LoginFlow`, `LoginStepUser`, `LoginStepPassword`, `LoginStepSuccess`
* `AuthGuard`, `PlatformScopeGuard`, `AuthProvider`, `auth.store.ts`
* Pendiente: integrar `auth.service.ts` del frontend con los endpoints del backend y validar el flujo completo E2E (prelogin → login → bootstrap de sesión).

### Relations

**Blocks:**

- [POL-31](https://linear.app/polaria/issue/POL-31) — Base frontend Next.js y shell multi-rol (dashboard + configurador)

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-4: Desarrollar módulo de configuración operativa {#pol-4}

| Field | Value |
|-------|-------|
| **ID** | POL-4 |
| **Title** | Desarrollar módulo de configuración operativa |
| **URL** | [https://linear.app/polaria/issue/POL-4](https://linear.app/polaria/issue/POL-4) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-4-desarrollar-modulo-de-configuracion-operativa` |
| **Created At** | 2026-06-18T21:55:49.493Z |
| **Updated At** | 2026-06-22T12:32:33.543Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Módulo de configuración/onboarding según doc V2.0:

**Fase A — Configurador (plataforma):** crear empresa, asignar admin cuenta, crear tenant, crear bodegas con slots.
**Fase B — Admin cuenta (tenant):** usuarios, catálogos (productos, clientes, proveedores, compradores), camiones, plantas, asignación equipo bodega.

Incluye wizard propuesto: Empresa → Tenant → Bodegas → Admin → Catálogo mínimo.

Justificación de Negocio (Why)
Sin onboarding no hay datos para operar SOL/OC/ingreso/mapa. Este módulo es el DESBLOQUEADOR de todos los demás módulos operativos (ingreso, mapa, procesamiento, ventas, transporte).

Alcance técnico por repo

**polaria-wms-api (backend):** Crear módulo `configuracion` con:

* CRUD empresas (`/empresas`)
* CRUD tenants/cuentas (`/cuentas`)
* CRUD bodegas (`/bodegas`)
* CRUD usuarios y asignación de roles (`/usuarios`)
* CRUD catálogos: productos, clientes, proveedores, compradores, camiones, plantas
* Permisos por rol (configurador ve todo; admin cuenta ve solo su tenant)

**polaria-wms-web (frontend):** Panel configurador + panel admin cuenta (ya tiene estructura en `src/modules/configurator/`).

Referencias

* Repos: `polaria-wms-api`, `polaria-wms-web`, `polaria-wms-db`
* Doc: secciones 6.1, 6.11

### Relations

**Blocks:**

- [POL-34](https://linear.app/polaria/issue/POL-34) — Desarrollar módulo de compras (SOL y OC)
- [POL-32](https://linear.app/polaria/issue/POL-32) — Integrar n8n para pedidos a proveedor

**Blocked By:**

- [POL-33](https://linear.app/polaria/issue/POL-33) — Esquema BD operativo V2 (bodegas, catálogos, órdenes, warehouse_state)

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-5: Desarrollar módulo de ingreso de mercancía {#pol-5}

| Field | Value |
|-------|-------|
| **ID** | POL-5 |
| **Title** | Desarrollar módulo de ingreso de mercancía |
| **URL** | [https://linear.app/polaria/issue/POL-5](https://linear.app/polaria/issue/POL-5) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-5-desarrollar-modulo-de-ingreso-de-mercancia` |
| **Created At** | 2026-06-18T21:55:49.654Z |
| **Updated At** | 2026-06-22T12:24:25.125Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Implementar el módulo de ingreso de mercancía: recepción contra OC (conciliación ciega), validación de temperatura, asignación de slot en zona de ingreso, trazabilidad (producto, cliente, kg, fecha) y cierre de recepción.

Justificación de Negocio (Why)
El ingreso es crítico para no detener la operación física. Depende de compras (SOL/OC) y del esquema BD operativo.

Actores: custodio
Repos: `polaria-wms-api`, `polaria-wms-web`
Doc: sección 6.4

Bloqueado por: POL-34 (compras), POL-33 (esquema BD)

### Relations

**Blocks:**

- [POL-12](https://linear.app/polaria/issue/POL-12) — Validar flujo E2E desde ingreso hasta cierre de transporte
- [POL-10](https://linear.app/polaria/issue/POL-10) — Desarrollar reportería operativa de Polaria web v2.0

**Blocked By:**

- [POL-33](https://linear.app/polaria/issue/POL-33) — Esquema BD operativo V2 (bodegas, catálogos, órdenes, warehouse_state)
- [POL-34](https://linear.app/polaria/issue/POL-34) — Desarrollar módulo de compras (SOL y OC)

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-6: Implementar mapa de bodega con bloqueo en tiempo real {#pol-6}

| Field | Value |
|-------|-------|
| **ID** | POL-6 |
| **Title** | Implementar mapa de bodega con bloqueo en tiempo real |
| **URL** | [https://linear.app/polaria/issue/POL-6](https://linear.app/polaria/issue/POL-6) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-6-implementar-mapa-de-bodega-con-bloqueo-en-tiempo-real` |
| **Created At** | 2026-06-18T21:55:49.780Z |
| **Updated At** | 2026-06-22T12:32:27.436Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Implementar mapa de bodega con `warehouse_state`, locking en tiempo real, estados de slot (libre/ocupado/reservado/en_proceso), FEFO, cola operativa y órdenes de trabajo (a_bodega, a_salida, revisar, procesamiento, despacho). Lectura vía Supabase Realtime; escrituras vía NestJS.

Justificación de Negocio (Why)
Principal problema de V1: concurrencia y duplicidad en inventario. La cola operativa y OT son parte del mismo módulo según doc 6.5.

Alcance adicional (consolidado de POL-42)

* Historial de movimientos auditable (origen, destino, usuario, timestamp)
* Sincronización 3NF ↔ proyección `warehouse_state` jsonb
* Tareas visibles por rol y bodega asignada

Actores: operario, custodio, jefe_bodega
Repos: los 3
Doc: secciones 2, 4, 6.5, 7

Bloqueado por: POL-33 (warehouse_state + slots)

### Relations

**Blocks:**

- [POL-7](https://linear.app/polaria/issue/POL-7) — Desarrollar módulo de procesamiento
- [POL-13](https://linear.app/polaria/issue/POL-13) — Probar concurrencia y no duplicidad para roles WMS
- [POL-12](https://linear.app/polaria/issue/POL-12) — Validar flujo E2E desde ingreso hasta cierre de transporte
- [POL-10](https://linear.app/polaria/issue/POL-10) — Desarrollar reportería operativa de Polaria web v2.0

**Blocked By:**

- [POL-33](https://linear.app/polaria/issue/POL-33) — Esquema BD operativo V2 (bodegas, catálogos, órdenes, warehouse_state)

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-7: Desarrollar módulo de procesamiento {#pol-7}

| Field | Value |
|-------|-------|
| **ID** | POL-7 |
| **Title** | Desarrollar módulo de procesamiento |
| **URL** | [https://linear.app/polaria/issue/POL-7](https://linear.app/polaria/issue/POL-7) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-7-desarrollar-modulo-de-procesamiento` |
| **Created At** | 2026-06-18T21:55:49.913Z |
| **Updated At** | 2026-06-22T12:28:29.807Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Desarrollar el módulo de procesamiento dentro del flujo operativo de la aplicación web v2.0 para bodega fría.

Justificación de Negocio (Why)
El procesamiento hace parte del flujo operativo base que debe quedar funcional para validar la nueva plataforma de extremo a extremo.

Especificación del Caso de Uso (Where / When)
Actor Principal: Operadores de bodega
Ubicación: Módulo de procesamiento
Frecuencia: Uso operativo recurrente durante la operación diaria

Flujo Principal (How)

1. Definir las acciones de procesamiento requeridas en la operación.
2. Implementar la captura y gestión de datos del proceso.
3. Integrar el módulo con inventario y estados operativos.
4. Validar su continuidad dentro del flujo completo.

Flujos Alternativos o Reglas de Negocio
El procesamiento debe mantener trazabilidad y consistencia con el resto del flujo operativo.

Restricciones
Debe ejecutarse dentro del alcance del mes y en la arquitectura SaaS definida.

### Relations

**Blocks:**

- [POL-12](https://linear.app/polaria/issue/POL-12) — Validar flujo E2E desde ingreso hasta cierre de transporte
- [POL-10](https://linear.app/polaria/issue/POL-10) — Desarrollar reportería operativa de Polaria web v2.0

**Blocked By:**

- [POL-6](https://linear.app/polaria/issue/POL-6) — Implementar mapa de bodega con bloqueo en tiempo real

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-8: Desarrollar módulo de ventas {#pol-8}

| Field | Value |
|-------|-------|
| **ID** | POL-8 |
| **Title** | Desarrollar módulo de ventas |
| **URL** | [https://linear.app/polaria/issue/POL-8](https://linear.app/polaria/issue/POL-8) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-8-desarrollar-modulo-de-ventas` |
| **Created At** | 2026-06-18T21:55:50.051Z |
| **Updated At** | 2026-06-22T12:24:34.411Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Medium

Descripción (What)
Desarrollar el módulo de ventas como parte de la aplicación web v2.0 para operación de bodega fría.

Justificación de Negocio (Why)
El módulo de ventas es parte del alcance funcional comprometido y permite completar el ciclo operativo esperado dentro de la nueva plataforma.

Especificación del Caso de Uso (Where / When)
Actor Principal: Usuarios operativos y administrativos relacionados con ventas
Ubicación: Módulo de ventas de Polaria web v2.0
Frecuencia: Uso recurrente según la operación comercial

Flujo Principal (How)

1. Definir el flujo funcional de ventas requerido para la operación.
2. Implementar el registro y consulta de la información correspondiente.
3. Integrar el módulo con inventario, tenant y reglas operativas.
4. Validar su comportamiento dentro del flujo general.

Flujos Alternativos o Reglas de Negocio
El módulo debe respetar separación por cuenta y consistencia con los movimientos de inventario.

Restricciones
Debe implementarse dentro del alcance funcional del mes.

### Relations

**Blocks:**

- [POL-9](https://linear.app/polaria/issue/POL-9) — Desarrollar módulo de transporte
- [POL-12](https://linear.app/polaria/issue/POL-12) — Validar flujo E2E desde ingreso hasta cierre de transporte
- [POL-10](https://linear.app/polaria/issue/POL-10) — Desarrollar reportería operativa de Polaria web v2.0

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-9: Desarrollar módulo de transporte {#pol-9}

| Field | Value |
|-------|-------|
| **ID** | POL-9 |
| **Title** | Desarrollar módulo de transporte |
| **URL** | [https://linear.app/polaria/issue/POL-9](https://linear.app/polaria/issue/POL-9) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-9-desarrollar-modulo-de-transporte` |
| **Created At** | 2026-06-18T21:55:50.191Z |
| **Updated At** | 2026-06-22T12:24:28.694Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Medium

Descripción (What)
Desarrollar el módulo de transporte dentro de la aplicación web v2.0 para soportar el cierre del flujo operativo base.

Justificación de Negocio (Why)
El transporte es el cierre del flujo operativo definido y su disponibilidad es clave para validar el proceso completo de extremo a extremo.

Especificación del Caso de Uso (Where / When)
Actor Principal: Operadores y usuarios responsables del cierre logístico
Ubicación: Módulo de transporte
Frecuencia: Uso según cierres operativos de despacho o movimiento

Flujo Principal (How)

1. Definir el flujo de transporte dentro de la nueva plataforma.
2. Implementar el registro de datos y estados asociados.
3. Integrar el módulo con los pasos previos del flujo operativo.
4. Validar que permita cerrar el proceso completo sin romper trazabilidad.

Flujos Alternativos o Reglas de Negocio
El módulo debe conectarse correctamente con ingreso, procesamiento y evidencias del flujo.

Restricciones
Debe desarrollarse en el tiempo definido para el mes y bajo la arquitectura objetivo.

### Relations

**Blocks:**

- [POL-12](https://linear.app/polaria/issue/POL-12) — Validar flujo E2E desde ingreso hasta cierre de transporte
- [POL-10](https://linear.app/polaria/issue/POL-10) — Desarrollar reportería operativa de Polaria web v2.0

**Blocked By:**

- [POL-11](https://linear.app/polaria/issue/POL-11) — Integrar Cloudinary para evidencias del flujo operativo
- [POL-8](https://linear.app/polaria/issue/POL-8) — Desarrollar módulo de ventas

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-10: Desarrollar reportería operativa de Polaria web v2.0 {#pol-10}

| Field | Value |
|-------|-------|
| **ID** | POL-10 |
| **Title** | Desarrollar reportería operativa de Polaria web v2.0 |
| **URL** | [https://linear.app/polaria/issue/POL-10](https://linear.app/polaria/issue/POL-10) |
| **Status** | Backlog |
| **Priority** | Low |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-10-desarrollar-reporteria-operativa-de-polaria-web-v20` |
| **Created At** | 2026-06-18T21:55:50.319Z |
| **Updated At** | 2026-06-22T12:26:33.105Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Low

Descripción (What)
Desarrollar la reportería operativa de la aplicación web v2.0 como parte del alcance funcional definido para este mes.

Justificación de Negocio (Why)
La reportería permite visibilidad sobre la operación y forma parte del conjunto de módulos comprometidos para la nueva versión.

Alcance técnico

| Módulo | Datos incluidos |
| -- | -- |
| Proveedores | OC por proveedor, kg recibidos, estado por período |
| Compradores | OV por comprador, kg despachados, historial de viajes |
| Transporte | Viajes completados, incidencias, evidencias |
| Bodega interna | Inventario vivo por slot, merma acumulada, rotación |
| Bodega externa | Inventario Fridem en solo lectura |

* Exportación PDF: `html2canvas + jsPDF`
* Exportación Excel: `xlsx`
* KPIs en tiempo real: % ocupación de bodega, % merma, on-time delivery, rotación

⚠️ DEPENDE DE: POL-5 (ingreso/OC), POL-6 (mapa), POL-7 (procesamiento), POL-8 (ventas), POL-9 (transporte)

Referencias

* Repos: `polaria-wms-api`, `polaria-wms-web`
* Doc: sección 6.10 (Reportería)

### Relations

**Blocks:**

_None_

**Blocked By:**

- [POL-9](https://linear.app/polaria/issue/POL-9) — Desarrollar módulo de transporte
- [POL-7](https://linear.app/polaria/issue/POL-7) — Desarrollar módulo de procesamiento
- [POL-6](https://linear.app/polaria/issue/POL-6) — Implementar mapa de bodega con bloqueo en tiempo real
- [POL-8](https://linear.app/polaria/issue/POL-8) — Desarrollar módulo de ventas
- [POL-5](https://linear.app/polaria/issue/POL-5) — Desarrollar módulo de ingreso de mercancía

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-11: Integrar Cloudinary para evidencias del flujo operativo {#pol-11}

| Field | Value |
|-------|-------|
| **ID** | POL-11 |
| **Title** | Integrar Cloudinary para evidencias del flujo operativo |
| **URL** | [https://linear.app/polaria/issue/POL-11](https://linear.app/polaria/issue/POL-11) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-11-integrar-cloudinary-para-evidencias-del-flujo-operativo` |
| **Created At** | 2026-06-18T21:55:57.765Z |
| **Updated At** | 2026-06-22T12:23:33.569Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Medium

Descripción (What)
Integrar Cloudinary para subir y persistir evidencias fotográficas y firmas del flujo de transporte, según la doc V2.0 (`POST /api/evidencia-transporte` en Next.js).

Justificación de Negocio (Why)
La evidencia es obligatoria en el cierre de viajes TV y forma parte del flujo E2E de salidas.

Especificación del Caso de Uso (Where / When)
Actor Principal: Transportista / operador de bodega
Ubicación: Route Handler en `polaria-wms-web` + persistencia de URL en backend/BD
Frecuencia: Cada entrega con evidencia en un viaje

Flujo Principal (How)

1. Implementar `POST /api/evidencia-transporte` (FormData → Cloudinary signed upload).
2. Validar tipo MIME y tamaño máximo.
3. Guardar URL segura asociada al viaje/línea de entrega.
4. Probar desde el módulo de transporte.

Nota: n8n es para pedidos a proveedor (`POST /api/pedido-proveedor`), no para Cloudinary. Ver issue separado.

Referencias

* Doc: https://flujos-nine.vercel.app/documentacion/bodega-frio-documentacion-v20 (secciones 6.8 y 8)
* Repo: `polaria-wms-web`

### Relations

**Blocks:**

- [POL-9](https://linear.app/polaria/issue/POL-9) — Desarrollar módulo de transporte
- [POL-12](https://linear.app/polaria/issue/POL-12) — Validar flujo E2E desde ingreso hasta cierre de transporte

**Blocked By:**

_None_

**Related To:**

- [POL-32](https://linear.app/polaria/issue/POL-32) — Integrar n8n para pedidos a proveedor

**Duplicate Of:**

_None_

### Attachments

- **Documentación V2.0 Bodega de Frío** — Empresa vs tenant, arquitectura lectura/escritura, modelo dual 3NF+jsonb, stack frio vs Dev Hub, flujos V2, Supabase, API, despliegue. — [https://flujos-nine.vercel.app/documentacion/bodega-frio-documentacion-v20](https://flujos-nine.vercel.app/documentacion/bodega-frio-documentacion-v20)

---


## POL-12: Validar flujo E2E desde ingreso hasta cierre de transporte {#pol-12}

| Field | Value |
|-------|-------|
| **ID** | POL-12 |
| **Title** | Validar flujo E2E desde ingreso hasta cierre de transporte |
| **URL** | [https://linear.app/polaria/issue/POL-12](https://linear.app/polaria/issue/POL-12) |
| **Status** | Backlog |
| **Priority** | Low |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-12-validar-flujo-e2e-desde-ingreso-hasta-cierre-de-transporte` |
| **Created At** | 2026-06-18T21:55:58.380Z |
| **Updated At** | 2026-06-22T12:32:32.211Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Low

Descripción (What)
Validar un flujo operativo completo de extremo a extremo desde el ingreso de mercancía hasta el cierre de transporte, incluyendo persistencia de evidencias.

Justificación de Negocio (Why)
La épica exige demostrar que la nueva plataforma puede ejecutar el flujo base completo antes de cerrar el mes y avanzar con confianza hacia la migración operativa.

Especificación del Caso de Uso (Where / When)

**Flujo E2E a validar:**

1. Ingreso de mercancía contra OC (POL-5)
2. Asignación de slot en mapa (POL-6)
3. Solicitud de procesamiento (POL-7)
4. Generación de OV y despacho (POL-8)
5. Creación de viaje TV, evidencia fotográfica Cloudinary (POL-9, POL-11)
6. Cierre de viaje y actualización de OV

⚠️ BLOQUEADO POR: POL-3, POL-4, POL-5, POL-6, POL-7, POL-8, POL-9, POL-11

Referencias

* Doc: secciones 6.4 – 6.8

### Relations

**Blocks:**

_None_

**Blocked By:**

- [POL-5](https://linear.app/polaria/issue/POL-5) — Desarrollar módulo de ingreso de mercancía
- [POL-11](https://linear.app/polaria/issue/POL-11) — Integrar Cloudinary para evidencias del flujo operativo
- [POL-8](https://linear.app/polaria/issue/POL-8) — Desarrollar módulo de ventas
- [POL-9](https://linear.app/polaria/issue/POL-9) — Desarrollar módulo de transporte
- [POL-6](https://linear.app/polaria/issue/POL-6) — Implementar mapa de bodega con bloqueo en tiempo real
- [POL-7](https://linear.app/polaria/issue/POL-7) — Desarrollar módulo de procesamiento

**Related To:**

- [POL-13](https://linear.app/polaria/issue/POL-13) — Probar concurrencia y no duplicidad para roles WMS

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-13: Probar concurrencia y no duplicidad para roles WMS {#pol-13}

| Field | Value |
|-------|-------|
| **ID** | POL-13 |
| **Title** | Probar concurrencia y no duplicidad para roles WMS |
| **URL** | [https://linear.app/polaria/issue/POL-13](https://linear.app/polaria/issue/POL-13) |
| **Status** | Backlog |
| **Priority** | Low |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-13-probar-concurrencia-y-no-duplicidad-para-roles-wms` |
| **Created At** | 2026-06-18T21:55:58.474Z |
| **Updated At** | 2026-06-22T12:28:30.968Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Low

Descripción (What)
Validar la operación simultánea de los roles definidos en el WMS sin bloqueos críticos ni duplicidad de registros en el mapa de inventario.

Justificación de Negocio (Why)
La principal promesa de valor de la v2.0 es corregir los problemas de concurrencia e inventario duplicado presentes en la versión actual.

Escenarios a probar:

1. Dos operarios intentan asignar el mismo slot simultáneamente → locking debe rechazar el segundo.
2. Custodio cierra recepción mientras operario mueve caja del mismo lote → sin datos corruptos.
3. Dos cierres de viaje de transporte concurrentes → contadores TV sin colisión.
4. Multi-rol en la misma bodega: custodio, operario y jefe activos simultáneamente.

⚠️ BLOQUEADO POR: POL-6 (mapa con locking)

Referencias

* Doc: sección 4.1 (Locking), 4 (Modelo dual)

### Relations

**Blocks:**

_None_

**Blocked By:**

- [POL-6](https://linear.app/polaria/issue/POL-6) — Implementar mapa de bodega con bloqueo en tiempo real

**Related To:**

- [POL-12](https://linear.app/polaria/issue/POL-12) — Validar flujo E2E desde ingreso hasta cierre de transporte

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-31: Base frontend Next.js y shell multi-rol (dashboard + configurador) {#pol-31}

| Field | Value |
|-------|-------|
| **ID** | POL-31 |
| **Title** | Base frontend Next.js y shell multi-rol (dashboard + configurador) |
| **URL** | [https://linear.app/polaria/issue/POL-31](https://linear.app/polaria/issue/POL-31) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-31-base-frontend-nextjs-y-shell-multi-rol-dashboard` |
| **Created At** | 2026-06-22T12:21:45.708Z |
| **Updated At** | 2026-06-22T12:32:34.846Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Revisión técnica doc V2.0

Prioridad: High

Descripción (What)
Completar base de `polaria-wms-web`: rutas por rol, dashboard dinámico multi-rol con cola operativa, panel configurador, guards por scope (platform/tenant/bodega), suscripción Realtime a `warehouse_state`, clientes API por dominio y vistas base para configuración, ingreso, mapa, procesamiento, ventas, transporte y reportería.

Justificación de Negocio (Why)
POL-1 cubre solo backend. Sin frontend alineado a roles no hay validación operativa E2E.

Criterios (consolidado de POL-35/POL-41)

1. Navegación y guardas por contexto empresa/tenant/bodega.
2. Cada rol ve solo acciones de su scope.
3. Servicios tipados hacia NestJS.
4. Login V2.0 funcional en UI.
5. Pruebas mínimas de guards y rutas críticas.

Repos: `polaria-wms-web`

### Relations

**Blocks:**

_None_

**Blocked By:**

- [POL-3](https://linear.app/polaria/issue/POL-3) — Desarrollar módulo de autenticación para Polaria web v2.0

**Related To:**

- [POL-1](https://linear.app/polaria/issue/POL-1) — Base backend modular NestJS para Polaria web v2.0

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-32: Integrar n8n para pedidos a proveedor {#pol-32}

| Field | Value |
|-------|-------|
| **ID** | POL-32 |
| **Title** | Integrar n8n para pedidos a proveedor |
| **URL** | [https://linear.app/polaria/issue/POL-32](https://linear.app/polaria/issue/POL-32) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-32-integrar-n8n-para-pedidos-a-proveedor` |
| **Created At** | 2026-06-22T12:21:47.766Z |
| **Updated At** | 2026-06-22T12:21:48.897Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Revisión técnica doc V2.0

Prioridad: Medium

Descripción (What)
Implementar `POST /api/pedido-proveedor` en Next.js como proxy al webhook n8n (`PEDIDO_PROVEEDOR_WEBHOOK_URL`) para notificar pedidos consolidados al proveedor.

Justificación de Negocio (Why)
Integración definida en doc sección 8 y 9.2. Es independiente de Cloudinary (POL-11).

Flujo

1. Frontend envía pedido consolidado.
2. Route Handler valida y reenvía a n8n.
3. Asociar respuesta/estado a la OC si aplica.

Repos: `polaria-wms-web`
Variables: `PEDIDO_PROVEEDOR_WEBHOOK_URL`, `PEDIDO_PROVEEDOR_DOCUMENT_ID`

### Relations

**Blocks:**

_None_

**Blocked By:**

- [POL-4](https://linear.app/polaria/issue/POL-4) — Desarrollar módulo de configuración operativa

**Related To:**

- [POL-11](https://linear.app/polaria/issue/POL-11) — Integrar Cloudinary para evidencias del flujo operativo

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-33: Esquema BD operativo V2 (bodegas, catálogos, órdenes, warehouse_state) {#pol-33}

| Field | Value |
|-------|-------|
| **ID** | POL-33 |
| **Title** | Esquema BD operativo V2 (bodegas, catálogos, órdenes, warehouse_state) |
| **URL** | [https://linear.app/polaria/issue/POL-33](https://linear.app/polaria/issue/POL-33) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-33-esquema-bd-operativo-v2-bodegas-catalogos-ordenes` |
| **Created At** | 2026-06-22T12:21:51.777Z |
| **Updated At** | 2026-06-22T12:32:30.169Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Revisión técnica doc V2.0

Prioridad: High

Descripción (What)
Extender `polaria-wms-db` más allá de fase 1 con modelo operativo 3NF completo: bodega, asignacion_bodega, producto, proveedor, comprador, camion, planta, solicitud_compra, orden_compra, orden_venta, slot, caja, warehouse_state (jsonb), system_counters, audit_log, procesamiento, transporte (TV, evidencias) y RLS por `codigo_cuenta` e `id_bodega`.

Justificación de Negocio (Why)
Sin este esquema no se pueden implementar ingreso, mapa, compras, ventas ni transporte.

Criterios de aceptación (consolidado de POL-40)

1. Tablas operativas con FK, índices y checks mínimos.
2. Ningún recurso operativo sin `codigo_cuenta` (salvo configurador).
3. RLS impide lectura cruzada entre tenants.
4. Scripts de validación multi-tenant.
5. API alineado con schema/migraciones.

Repos: `polaria-wms-db`, `polaria-wms-api`
Doc: secciones 4, 6, 7

Complementa POL-2 (RLS fase 1 ya iniciada).

### Relations

**Blocks:**

- [POL-4](https://linear.app/polaria/issue/POL-4) — Desarrollar módulo de configuración operativa
- [POL-6](https://linear.app/polaria/issue/POL-6) — Implementar mapa de bodega con bloqueo en tiempo real
- [POL-5](https://linear.app/polaria/issue/POL-5) — Desarrollar módulo de ingreso de mercancía

**Blocked By:**

- [POL-2](https://linear.app/polaria/issue/POL-2) — Configurar multi-tenant y RLS base en Supabase

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-34: Desarrollar módulo de compras (SOL y OC) {#pol-34}

| Field | Value |
|-------|-------|
| **ID** | POL-34 |
| **Title** | Desarrollar módulo de compras (SOL y OC) |
| **URL** | [https://linear.app/polaria/issue/POL-34](https://linear.app/polaria/issue/POL-34) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-34-desarrollar-modulo-de-compras-sol-y-oc` |
| **Created At** | 2026-06-22T12:21:53.487Z |
| **Updated At** | 2026-06-22T12:32:25.946Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Revisión técnica doc V2.0

Prioridad: High

Descripción (What)
Implementar SOL y OC con estados Pendiente → En tránsito → Recibida → Cerrada, proveedores, líneas, bodega destino. Incluye catálogos previos necesarios para ingreso (productos, proveedores por tenant).

Justificación de Negocio (Why)
POL-5 (ingreso) depende de OC y catálogos. Doc 6.3–6.4.

Criterios (consolidado de POL-44)

1. Admin/operador cuenta crea catálogo mínimo y OC.
2. OC asociada a tenant y bodega destino.
3. POL-5 puede consumir OC sin duplicar datos.
4. Importación xlsx contemplada o feature-flag.

Repos: los 3
Doc: secciones 6.3, 6.4, 6.11

### Relations

**Blocks:**

- [POL-5](https://linear.app/polaria/issue/POL-5) — Desarrollar módulo de ingreso de mercancía

**Blocked By:**

- [POL-4](https://linear.app/polaria/issue/POL-4) — Desarrollar módulo de configuración operativa

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-35: Implementar frontend Next.js v2.0 multi-rol (dashboard y módulos operativos) {#pol-35}

| Field | Value |
|-------|-------|
| **ID** | POL-35 |
| **Title** | Implementar frontend Next.js v2.0 multi-rol (dashboard y módulos operativos) |
| **URL** | [https://linear.app/polaria/issue/POL-35](https://linear.app/polaria/issue/POL-35) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-35-implementar-frontend-nextjs-v20-multi-rol-dashboard-y` |
| **Created At** | 2026-06-22T12:22:09.068Z |
| **Updated At** | 2026-06-22T12:32:34.895Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Revisión técnica backlog v2.0

Prioridad: High

Descripción (What)
Construir el frontend de Polaria App v2.0 en Next.js App Router para los roles definidos (configurador, administrador_cuenta, operador_cuenta y roles de bodega), incluyendo vistas y flujos para ingreso, mapa, procesamiento, ventas, transporte y reportería.

Justificación de Negocio (Why)
El backlog actual está centrado en backend/integraciones. Sin un frente web alineado al modelo de roles, no se puede validar adopción operativa ni ejecutar el flujo real de punta a punta.

Criterios de aceptación (DoD)

1. Existe navegación por rol y guardas de acceso por contexto (empresa/tenant/bodega).
2. Se implementan pantallas mínimas operativas para los módulos comprometidos en la épica.
3. Las llamadas consumen contratos API versionados y tipados.
4. El flujo de login v2.0 (codigoEmpresa + usuario + password para usuarios tenant; login plataforma para configurador) funciona en UI.
5. Se documenta mapa de rutas y estados de carga/error por módulo.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-36: Diseñar e implementar migración de datos v1.0 → v2.0 con reconciliación {#pol-36}

| Field | Value |
|-------|-------|
| **ID** | POL-36 |
| **Title** | Diseñar e implementar migración de datos v1.0 → v2.0 con reconciliación |
| **URL** | [https://linear.app/polaria/issue/POL-36](https://linear.app/polaria/issue/POL-36) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-36-disenar-e-implementar-migracion-de-datos-v10-v20-con` |
| **Created At** | 2026-06-22T12:22:10.366Z |
| **Updated At** | 2026-06-22T12:22:10.366Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Revisión técnica backlog v2.0

Prioridad: High

Descripción (What)
Definir e implementar la estrategia de migración de datos desde el modelo actual hacia el modelo v2.0 multi-tenant, incluyendo validación de integridad y reconciliación de inventario/órdenes.

Justificación de Negocio (Why)
La épica incluye migración desde base monolítica. Sin plan de migración y reconciliación, el go-live de v2.0 tiene alto riesgo de pérdida o inconsistencia de datos.

Criterios de aceptación (DoD)

1. Existe documento técnico de mapeo entidad-origen a entidad-destino.
2. Scripts/versionado de migración ejecutables por entorno.
3. Reporte de reconciliación con conteos y diferencias por dominio crítico.
4. Estrategia de rollback y plan de contingencia definidos.
5. Prueba de migración en entorno de staging con evidencia.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-37: Construir onboarding de configurador (empresa → tenant → bodega → admin cuenta) {#pol-37}

| Field | Value |
|-------|-------|
| **ID** | POL-37 |
| **Title** | Construir onboarding de configurador (empresa → tenant → bodega → admin cuenta) |
| **URL** | [https://linear.app/polaria/issue/POL-37](https://linear.app/polaria/issue/POL-37) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-37-construir-onboarding-de-configurador-empresa-tenant-bodega` |
| **Created At** | 2026-06-22T12:22:11.353Z |
| **Updated At** | 2026-06-22T12:32:33.609Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Revisión técnica backlog v2.0

Prioridad: High

Descripción (What)
Implementar el flujo de configuración inicial en plataforma para el rol configurador: crear empresa, crear tenant, crear bodega(s) y asignar el primer administrador de cuenta.

Justificación de Negocio (Why)
La documentación v2.0 define que toda operación depende de este bootstrap. Sin este flujo, los módulos operativos no tienen contexto válido de tenant y bodega.

Criterios de aceptación (DoD)

1. Flujo guiado con validaciones de unicidad para codigoEmpresa y codeCuenta.
2. Se registra relación empresa→tenant→bodega en modelo de datos.
3. El administrador de cuenta queda creado y habilitado para login tenant.
4. Checklist de cierre del onboarding ejecutable desde UI o endpoint.
5. Auditoría mínima de quién creó cada recurso crítico.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-38: Integrar inventario de bodega externa Fridem en modo solo lectura {#pol-38}

| Field | Value |
|-------|-------|
| **ID** | POL-38 |
| **Title** | Integrar inventario de bodega externa Fridem en modo solo lectura |
| **URL** | [https://linear.app/polaria/issue/POL-38](https://linear.app/polaria/issue/POL-38) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-38-integrar-inventario-de-bodega-externa-fridem-en-modo-solo` |
| **Created At** | 2026-06-22T12:22:12.450Z |
| **Updated At** | 2026-06-22T12:32:37.587Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Documentación V2.0 (sección 9.1)

Prioridad: Medium

Descripción (What)
Conectar la bodega externa Fridem en modo solo lectura desde la aplicación v2.0, para que los usuarios autorizados vean inventario Fridem sin poder modificarlo.

Justificación de Negocio (Why)
La doc contempla bodega interna y externa. Sin Fridem, la visión operativa queda incompleta para clientes que consultan inventario externo integrado.

Alcance técnico

* Instancia Supabase secundaria (proyecto Fridem separado)
* Cliente en `polaria-wms-web`: `fridemClient`, `fridemInventory` (slots/filas)
* Variables: `NEXT_PUBLIC_FRIDEM_*`
* Vista dashboard: inventario Fridem solo lectura, separado de `warehouse_state` interno
* RLS Fridem debe permitir lectura desde el app ID configurado
* Fallback claro si credenciales no están configuradas

Criterios de aceptación

1. Cliente de integración separado del datasource principal.
2. Lectura sin permisos de escritura.
3. Errores/timeouts no afectan operación principal.
4. Visibilidad por rol y tenant donde aplique.
5. Reportería distingue bodega interna vs externa.

Repos: `polaria-wms-web` (y route handler/proxy si aplica)
Doc: sección 9.1, 6.2, 13

Nota: issues POL-43 y POL-45 consolidados aquí.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-39: Automatizar calidad v2.0: CI/CD + pruebas E2E + pruebas de concurrencia {#pol-39}

| Field | Value |
|-------|-------|
| **ID** | POL-39 |
| **Title** | Automatizar calidad v2.0: CI/CD + pruebas E2E + pruebas de concurrencia |
| **URL** | [https://linear.app/polaria/issue/POL-39](https://linear.app/polaria/issue/POL-39) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-39-automatizar-calidad-v20-cicd-pruebas-e2e-pruebas-de` |
| **Created At** | 2026-06-22T12:22:14.690Z |
| **Updated At** | 2026-06-22T12:32:32.254Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Revisión técnica backlog v2.0

Prioridad: High

Descripción (What)
Configurar pipeline de calidad para v2.0 con validaciones automáticas (lint, typecheck, tests), pruebas E2E del flujo operativo y suite de concurrencia para mapa/inventario.

Justificación de Negocio (Why)
Los issues POL-12 y POL-13 exigen validaciones repetibles; sin automatización, las pruebas quedan manuales, poco confiables y difíciles de sostener antes del go-live.

Criterios de aceptación (DoD)

1. Pipeline en CI para lint, typecheck y pruebas unitarias.
2. Suite E2E mínima del flujo ingreso→procesamiento/ventas→transporte.
3. Escenarios de concurrencia reproducibles para no duplicidad en mapa.
4. Reporte automático de resultados y umbrales de fallo.
5. Documentación para ejecutar local y en CI.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-40: Completar modelo operativo DB v2.0: bodegas, inventario, órdenes y RLS {#pol-40}

| Field | Value |
|-------|-------|
| **ID** | POL-40 |
| **Title** | Completar modelo operativo DB v2.0: bodegas, inventario, órdenes y RLS |
| **URL** | [https://linear.app/polaria/issue/POL-40](https://linear.app/polaria/issue/POL-40) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-40-completar-modelo-operativo-db-v20-bodegas-inventario-ordenes` |
| **Created At** | 2026-06-22T12:22:50.077Z |
| **Updated At** | 2026-06-22T12:32:30.211Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Origen: revisión de documentación v2.0 y repos `polaria-wms-db`, `polaria-wms-api`, `polaria-wms-web`.

Problema
El proyecto ya tiene issues macro para módulos funcionales, pero la base de datos actual solo cubre fase inicial: roles, empresa, cuenta y usuario. Antes de construir ingreso, mapa, procesamiento, ventas, transporte y reportería se necesita completar el modelo operativo de dominio.

Repos impactados

* `polaria-wms-db`: migraciones SQL y scripts de validación.
* `polaria-wms-api`: Prisma/schema o contratos de persistencia alineados.

Alcance

* Crear migraciones para bodega, asignación de bodega por usuario/rol, productos, proveedores, clientes/compradores, camiones, plantas.
* Modelar SOL, OC, OV y líneas, con FK a `codigo_cuenta` y bodega.
* Modelar slots, cajas/lotes, `warehouse_state` jsonb, historial de movimientos y estados operativos.
* Modelar procesamiento: solicitud, insumos, resultados, merma/remanente y balance de masa.
* Modelar transporte: viaje TV, líneas de entrega, incidencias, evidencia/firma/ubicación cuando aplique.
* Definir RLS granular por `codigo_cuenta` y, para bodega, por `id_bodega`/asignación.
* Agregar seeds y scripts de validación para escenarios multi-tenant.

Criterios de aceptación

* Las tablas operativas principales existen con FK, índices y checks mínimos.
* Ningún recurso operativo queda sin `codigo_cuenta`, salvo usuarios de plataforma/configurador.
* RLS impide lectura cruzada entre tenants.
* Hay script de validación que prueba configurador, admin de cuenta y usuario operativo.
* El API puede generar/consumir tipos o schema alineado a estas migraciones.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-41: Construir frontend operativo por roles y módulos v2.0 {#pol-41}

| Field | Value |
|-------|-------|
| **ID** | POL-41 |
| **Title** | Construir frontend operativo por roles y módulos v2.0 |
| **URL** | [https://linear.app/polaria/issue/POL-41](https://linear.app/polaria/issue/POL-41) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-41-construir-frontend-operativo-por-roles-y-modulos-v20` |
| **Created At** | 2026-06-22T12:22:50.918Z |
| **Updated At** | 2026-06-22T12:32:28.854Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Origen: revisión de documentación v2.0 y repo `polaria-wms-web`.

Problema
`polaria-wms-web` ya tiene login, guards y panel configurador básico, pero el resto de módulos WMS aparecen como estructura/README pendiente. Las issues actuales hablan de módulos, pero no separan explícitamente la implementación frontend por rol y ruta.

Repo impactado

* `polaria-wms-web`

Alcance

* Completar shell operativo y dashboards según rol: configurador, administrador de cuenta, operador de cuenta, roles de bodega y transportista.
* Implementar rutas/vistas base para configuración, ingreso, mapa, procesamiento, ventas, transporte y reportería.
* Crear clientes API por dominio y manejo consistente de errores/autorización.
* Implementar hooks de estado/realtime para `warehouse_state` por bodega.
* Aplicar permisos de UI por rol y scope (`platform`, `tenant`, `bodega`).
* Alinear navegación con flujo v2.0: empresa -> tenant -> bodegas -> admin -> catálogo mínimo -> operación.

Criterios de aceptación

* Cada rol entra a una vista permitida y no ve acciones fuera de su scope.
* Las vistas principales existen aunque algunas acciones queden conectadas a endpoints posteriores.
* Los módulos consumen servicios tipados y no llaman al API con strings dispersos.
* Hay pruebas mínimas para guards, rutas principales y servicios críticos.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-42: Implementar cola operativa, órdenes de trabajo y trazabilidad de movimientos {#pol-42}

| Field | Value |
|-------|-------|
| **ID** | POL-42 |
| **Title** | Implementar cola operativa, órdenes de trabajo y trazabilidad de movimientos |
| **URL** | [https://linear.app/polaria/issue/POL-42](https://linear.app/polaria/issue/POL-42) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-42-implementar-cola-operativa-ordenes-de-trabajo-y-trazabilidad` |
| **Created At** | 2026-06-22T12:22:52.295Z |
| **Updated At** | 2026-06-22T12:32:27.518Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Origen: documentación v2.0 secciones 6.5, 7 y modelo `warehouse_state`.

Problema
Entre ingreso, mapa, procesamiento, ventas y transporte falta una capa explícita de órdenes de trabajo, tareas, estados de slot e historial de movimientos. Sin esto, los módulos pueden funcionar de forma aislada pero no garantizan trazabilidad ni consistencia.

Repos impactados

* `polaria-wms-db`
* `polaria-wms-api`
* `polaria-wms-web`

Alcance

* Definir estados de slot: libre, ocupado, reservado, en_proceso.
* Crear modelo/servicios de órdenes de trabajo: a_bodega, a_salida, revisar, procesamiento, despacho.
* Registrar movimiento de cajas/lotes con origen, destino, usuario, rol, timestamp y tenant/bodega.
* Sincronizar entidades 3NF con la proyección `warehouse_state` jsonb.
* Exponer cola operativa por rol para custodio, operario, jefe, procesador y transportista.

Criterios de aceptación

* Cada movimiento crítico deja historial auditable.
* El mapa puede derivar su estado desde `warehouse_state` sin perder relación con tablas normalizadas.
* Los cambios concurrentes se preparan para locking y validaciones de POL-6/POL-13.
* Las tareas visibles dependen del rol y bodega asignada.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-43: Integrar bodega externa Fridem en modo solo lectura {#pol-43}

| Field | Value |
|-------|-------|
| **ID** | POL-43 |
| **Title** | Integrar bodega externa Fridem en modo solo lectura |
| **URL** | [https://linear.app/polaria/issue/POL-43](https://linear.app/polaria/issue/POL-43) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-43-integrar-bodega-externa-fridem-en-modo-solo-lectura` |
| **Created At** | 2026-06-22T12:22:53.385Z |
| **Updated At** | 2026-06-22T12:32:37.640Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Origen: documentación v2.0 sección 9.1.

Problema
La v2.0 declara soporte multi-bodega incluyendo bodega externa Fridem con inventario de solo lectura. No hay issue explícita para esta integración y no debe mezclarse con el mapa de bodega interna.

Repos impactados

* `polaria-wms-web`
* `polaria-wms-api` o route handlers si se decide proxy server-side
* Configuración de Supabase secundaria según arquitectura final

Alcance

* Definir cliente/configuración para Supabase Fridem o endpoint proxy seguro.
* Consultar inventario/slots externos en modo solo lectura.
* Mostrar estado externo separado del inventario interno editable.
* Alinear permisos por tenant/rol para quién puede consultar Fridem.
* Documentar variables de entorno y fallback si la integración no está configurada.

Criterios de aceptación

* Usuarios autorizados pueden consultar inventario Fridem sin poder modificarlo.
* No se mezcla `warehouse_state` interno con datos externos.
* La reportería distingue bodega interna vs externa.
* La ausencia de credenciales Fridem falla de forma clara y controlada.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-44: Implementar catálogos, SOL/OC y compras antes de ingreso {#pol-44}

| Field | Value |
|-------|-------|
| **ID** | POL-44 |
| **Title** | Implementar catálogos, SOL/OC y compras antes de ingreso |
| **URL** | [https://linear.app/polaria/issue/POL-44](https://linear.app/polaria/issue/POL-44) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-44-implementar-catalogos-soloc-y-compras-antes-de-ingreso` |
| **Created At** | 2026-06-22T12:22:54.359Z |
| **Updated At** | 2026-06-22T12:32:26.017Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Origen: documentación v2.0 secciones 6.1, 6.3, 6.4 y 6.11.

Problema
El flujo de ingreso depende de catálogos, proveedores, productos, bodega destino y órdenes de compra. POL-5 cubre ingreso, pero falta una tarea explícita para preparar los datos comerciales previos.

Repos impactados

* `polaria-wms-db`
* `polaria-wms-api`
* `polaria-wms-web`

Alcance

* CRUD/importación de productos/catálogo por `codigo_cuenta`.
* CRUD de proveedores, clientes/compradores, camiones y plantas por tenant.
* Crear y consultar SOL/OC con líneas, estado, fecha esperada y bodega destino.
* Validar estados de OC: pendiente, en tránsito, recibida, cerrada.
* Preparar contrato para que ingreso pueda validar contra OC o registrar ingreso libre controlado.

Criterios de aceptación

* Un administrador/operador de cuenta puede crear catálogo mínimo y OC.
* Las OC quedan asociadas a tenant y bodega destino.
* POL-5 puede consumir OC/catálogo sin duplicar datos.
* La importación xlsx queda contemplada o al menos bloqueada por feature flag si no entra en el primer corte.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-45: Integrar Bodega Externa Fridem (inventario en solo lectura) {#pol-45}

| Field | Value |
|-------|-------|
| **ID** | POL-45 |
| **Title** | Integrar Bodega Externa Fridem (inventario en solo lectura) |
| **URL** | [https://linear.app/polaria/issue/POL-45](https://linear.app/polaria/issue/POL-45) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Polaria App - Construir aplicación web v2.0 |
| **Team** | POLARIA |
| **Created By** | LUIS DANIEL CANTILLO OSPINO |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-45-integrar-bodega-externa-fridem-inventario-en-solo-lectura` |
| **Created At** | 2026-06-22T12:26:30.728Z |
| **Updated At** | 2026-06-22T12:32:36.298Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Documentación V2.0 (sección 9.1)

Prioridad: Medium

Descripción (What)
Conectar la bodega externa Fridem en modo solo lectura desde la aplicación v2.0, para que los usuarios con acceso puedan ver el inventario de Fridem sin escribir en él.

Justificación de Negocio (Why)
Fridem es una bodega externa cuyo inventario el cliente necesita consultar integrado dentro del mismo dashboard, sin operar directamente sobre él.

Alcance técnico

* Instancia Supabase secundaria (proyecto separado de Fridem)
* `lib/fridemClient.ts`: `ensureFridemAuth()` — inicializa el cliente Supabase secundario
* `lib/fridemInventory.ts`: `fetchFridemSlots()`, `fetchFridemInventoryRows()`
* Variables de entorno en `polaria-wms-web`:
  * `NEXT_PUBLIC_FRIDEM_API_KEY`
  * `NEXT_PUBLIC_FRIDEM_AUTH_DOMAIN`
  * `NEXT_PUBLIC_FRIDEM_PROJECT_ID`
  * `NEXT_PUBLIC_FRIDEM_DATABASE_URL`
* Vista en el dashboard: inventario Fridem en modo solo lectura (sin edición ni movimientos)
* RLS en Fridem debe permitir lectura desde el app ID configurado

Flujo Principal

1. Al cargar el dashboard, si la bodega activa es externa → consultar inventario Fridem.
2. Mostrar slots/filas de inventario en modo lectura.
3. No exponer credenciales Fridem en servidor (usar `NEXT_PUBLIC_*` solo si son pública o manejar vía route handler).

Referencias

* Repo: `polaria-wms-web`
* Doc: sección 9.1 (Fridem), 6.2 (Bootstrap), 13 (Troubleshooting Fridem vacía)

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


# Mateo Support - Desplegar v1.2.0 en producción

_6 issue(s)_

## POL-21: Conectar manual de usuario al flujo de consulta de Mateo Support {#pol-21}

| Field | Value |
|-------|-------|
| **ID** | POL-21 |
| **Title** | Conectar manual de usuario al flujo de consulta de Mateo Support |
| **URL** | [https://linear.app/polaria/issue/POL-21](https://linear.app/polaria/issue/POL-21) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo Support - Desplegar v1.2.0 en producción |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-21-conectar-manual-de-usuario-al-flujo-de-consulta-de-mateo` |
| **Created At** | 2026-06-18T21:56:05.084Z |
| **Updated At** | 2026-06-18T22:05:49.151Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Integrar el manual de usuario al sistema de consulta de Mateo Support como base para responder dudas antes de registrar tickets.

Justificación de Negocio (Why)
El manual es necesario para reducir intervención manual y permitir que Mateo Support responda con contexto antes de abrir un issue.

Especificación del Caso de Uso (Where / When)
Actor Principal: Usuarios finales y equipo de soporte
Ubicación: Flujo de consulta de Mateo Support
Frecuencia: Uso recurrente en conversaciones de soporte

Flujo Principal (How)

1. Identificar la fuente del manual de usuario.
2. Conectar el manual al mecanismo de consulta de Mateo.
3. Validar que la información pueda recuperarse dentro del flujo conversacional.
4. Probar respuestas basadas en documentación real.

Flujos Alternativos o Reglas de Negocio
La consulta debe priorizar la documentación disponible antes de derivar a creación de tickets.

Restricciones
El alcance se limita al manual de un único aplicativo durante este mes.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-22: Consultar el manual antes de crear cada ticket {#pol-22}

| Field | Value |
|-------|-------|
| **ID** | POL-22 |
| **Title** | Consultar el manual antes de crear cada ticket |
| **URL** | [https://linear.app/polaria/issue/POL-22](https://linear.app/polaria/issue/POL-22) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo Support - Desplegar v1.2.0 en producción |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-22-consultar-el-manual-antes-de-crear-cada-ticket` |
| **Created At** | 2026-06-18T21:56:05.183Z |
| **Updated At** | 2026-06-18T22:05:49.225Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Configurar el flujo principal de Mateo Support para consultar el manual del aplicativo antes de registrar tickets en Linear.

Justificación de Negocio (Why)
Esto permite filtrar consultas resolubles por documentación y evita carga operativa innecesaria al equipo de soporte.

Especificación del Caso de Uso (Where / When)
Actor Principal: Usuarios que escriben por WhatsApp y flujo de Mateo Support
Ubicación: Flujo principal de Mateo Support en n8n
Frecuencia: Uso en cada conversación que derive en soporte

Flujo Principal (How)

1. Recibir la consulta inicial del usuario.
2. Consultar el manual del aplicativo como primer paso.
3. Determinar si la respuesta documental resuelve la necesidad.
4. Crear ticket en Linear solo cuando la consulta no se resuelva por documentación.

Flujos Alternativos o Reglas de Negocio
Si la documentación no cubre el caso o el problema es incidente real, el flujo debe continuar a registro de ticket.

Restricciones
Debe integrarse al flujo actual de Mateo Support sin salir del alcance del mes.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-23: Habilitar recepción de imágenes por WhatsApp en Mateo Support {#pol-23}

| Field | Value |
|-------|-------|
| **ID** | POL-23 |
| **Title** | Habilitar recepción de imágenes por WhatsApp en Mateo Support |
| **URL** | [https://linear.app/polaria/issue/POL-23](https://linear.app/polaria/issue/POL-23) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo Support - Desplegar v1.2.0 en producción |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-23-habilitar-recepcion-de-imagenes-por-whatsapp-en-mateo` |
| **Created At** | 2026-06-18T21:56:05.284Z |
| **Updated At** | 2026-06-18T22:05:49.293Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Implementar la capacidad de recibir y procesar imágenes enviadas por WhatsApp dentro del flujo de soporte de Mateo Support.

Justificación de Negocio (Why)
Las imágenes son parte del contexto real de soporte y permiten registrar tickets más completos sin intervención manual del equipo.

Especificación del Caso de Uso (Where / When)
Actor Principal: Usuarios finales que reportan incidentes
Ubicación: Canal de WhatsApp de Mateo Support
Frecuencia: Uso cuando el usuario envía evidencia visual del problema

Flujo Principal (How)

1. Recibir imágenes desde WhatsApp.
2. Incorporar la imagen al flujo de análisis o registro.
3. Asociar la evidencia visual al contexto del caso.
4. Validar que la información pueda usarse en la creación del ticket.

Flujos Alternativos o Reglas de Negocio
La imagen debe complementar el caso sin interrumpir el flujo conversacional ni el registro del ticket.

Restricciones
Debe operar dentro del flujo actual de WhatsApp y del alcance funcional de este mes.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-24: Activar Error Handler de Mateo Support en producción {#pol-24}

| Field | Value |
|-------|-------|
| **ID** | POL-24 |
| **Title** | Activar Error Handler de Mateo Support en producción |
| **URL** | [https://linear.app/polaria/issue/POL-24](https://linear.app/polaria/issue/POL-24) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo Support - Desplegar v1.2.0 en producción |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-24-activar-error-handler-de-mateo-support-en-produccion` |
| **Created At** | 2026-06-18T21:56:05.386Z |
| **Updated At** | 2026-06-18T22:05:49.390Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Poner en operación el Error Handler dentro del flujo principal de Mateo Support en producción.

Justificación de Negocio (Why)
El manejo controlado de errores es necesario para operar en producción sin caídas silenciosas ni pérdida de casos de soporte.

Especificación del Caso de Uso (Where / When)
Actor Principal: Flujo técnico de Mateo Support y equipo de soporte
Ubicación: Error Handler del flujo en producción
Frecuencia: Activación cuando se presenten errores en el proceso

Flujo Principal (How)

1. Revisar el comportamiento esperado ante fallos del flujo.
2. Configurar o activar el Error Handler en producción.
3. Validar la captura correcta de errores y desvíos.
4. Confirmar que el flujo mantenga trazabilidad del incidente técnico.

Flujos Alternativos o Reglas de Negocio
El manejo de errores debe evitar pérdida del caso y facilitar diagnóstico posterior.

Restricciones
Debe activarse sobre el flujo productivo existente sin ampliar el alcance fuera del mes.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-25: Validar creación autónoma de tickets en Linear {#pol-25}

| Field | Value |
|-------|-------|
| **ID** | POL-25 |
| **Title** | Validar creación autónoma de tickets en Linear |
| **URL** | [https://linear.app/polaria/issue/POL-25](https://linear.app/polaria/issue/POL-25) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo Support - Desplegar v1.2.0 en producción |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-25-validar-creacion-autonoma-de-tickets-en-linear` |
| **Created At** | 2026-06-18T21:56:05.480Z |
| **Updated At** | 2026-06-22T13:18:35.386Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Medium

Descripción (What)
Probar y validar que Mateo Support cree tickets completos en Linear sin intervención manual del equipo de soporte.

Justificación de Negocio (Why)
La creación autónoma de tickets es el resultado central esperado para reducir carga operativa y ordenar el registro de soporte.

Especificación del Caso de Uso (Where / When)
Actor Principal: Usuarios finales y equipo de soporte
Ubicación: Integración de Mateo Support con Linear
Frecuencia: Uso en cada caso de soporte que requiera registro

Flujo Principal (How)

1. Simular conversaciones reales de soporte.
2. Verificar recolección de contexto, imágenes y consulta documental.
3. Ejecutar la creación automática del ticket en Linear.
4. Revisar que el ticket quede completo y usable sin corrección manual.

Flujos Alternativos o Reglas de Negocio
Si la información no es suficiente para abrir un ticket correcto, el flujo debe identificar el faltante antes de registrar el caso.

Restricciones
La validación depende de que ya estén activos WhatsApp, manual y lógica de registro.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-26: Desplegar Mateo Support v1.2.0 y verificar estabilidad {#pol-26}

| Field | Value |
|-------|-------|
| **ID** | POL-26 |
| **Title** | Desplegar Mateo Support v1.2.0 y verificar estabilidad |
| **URL** | [https://linear.app/polaria/issue/POL-26](https://linear.app/polaria/issue/POL-26) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo Support - Desplegar v1.2.0 en producción |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-26-desplegar-mateo-support-v120-y-verificar-estabilidad` |
| **Created At** | 2026-06-18T21:56:05.572Z |
| **Updated At** | 2026-06-18T22:05:49.493Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Desplegar Mateo Support v1.2.0 en producción y confirmar operación estable de WhatsApp, consulta de manual y registro de tickets.

Justificación de Negocio (Why)
Mateo Support lleva demasiado tiempo en pruebas y pasar a producción es necesario para adoptar la metodología operativa definida sin trabajo manual adicional.

Especificación del Caso de Uso (Where / When)
Actor Principal: Equipo de soporte y usuarios finales
Ubicación: Entorno de producción de Mateo Support
Frecuencia: Hito de despliegue previsto para este mes

Flujo Principal (How)

1. Confirmar que los módulos necesarios estén validados en testing.
2. Ejecutar el despliegue de Mateo Support v1.2.0 a producción.
3. Verificar operación de WhatsApp, consulta documental y creación de tickets.
4. Confirmar estabilidad inicial posterior al release.

Flujos Alternativos o Reglas de Negocio
Si algún módulo crítico no está listo, debe evaluarse reducción de alcance antes del despliegue.

Restricciones
El despliegue depende de la validación previa de los tres módulos comprometidos para la versión.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


# Mateo - Desplegar consultas deterministas en Supabase

_11 issue(s)_

## POL-14: Configurar nodo IA con personalidad humanizada en Mateo {#pol-14}

| Field | Value |
|-------|-------|
| **ID** | POL-14 |
| **Title** | Configurar nodo IA con personalidad humanizada en Mateo |
| **URL** | [https://linear.app/polaria/issue/POL-14](https://linear.app/polaria/issue/POL-14) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-14-configurar-nodo-ia-con-personalidad-humanizada-en-mateo` |
| **Created At** | 2026-06-18T21:55:58.572Z |
| **Updated At** | 2026-06-18T22:05:48.650Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | 2026-06-19T13:03:04.038Z |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Medium

Descripción (What)
Configurar el nodo de IA en n8n para gobernar la personalidad humanizada, la ortografía basada en texto y el uso moderado de emojis en Mateo.

Justificación de Negocio (Why)
La experiencia conversacional humanizada y consistente es parte del diferencial del producto y afecta la percepción directa del usuario final en WhatsApp.

Especificación del Caso de Uso (Where / When)
Actor Principal: Usuarios que interactúan con Mateo
Ubicación: Nodo IA de Mateo en n8n
Frecuencia: Uso permanente en cada interacción del asistente

Flujo Principal (How)

1. Definir las reglas de personalidad y tono para Mateo.
2. Configurar el nodo de IA con dichas reglas.
3. Validar ortografía, estilo y consistencia en respuestas de prueba.
4. Ajustar el comportamiento conversacional según los criterios definidos.

Flujos Alternativos o Reglas de Negocio
La personalidad debe mantenerse controlada y no debe inducir respuestas ambiguas o artificiales.

Restricciones
Debe implementarse sobre n8n y dentro del alcance definido para este mes.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-15: Construir tool determinista n8n a Supabase para consultas {#pol-15}

| Field | Value |
|-------|-------|
| **ID** | POL-15 |
| **Title** | Construir tool determinista n8n a Supabase para consultas |
| **URL** | [https://linear.app/polaria/issue/POL-15](https://linear.app/polaria/issue/POL-15) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-15-construir-tool-determinista-n8n-a-supabase-para-consultas` |
| **Created At** | 2026-06-18T21:55:58.670Z |
| **Updated At** | 2026-06-18T22:05:48.707Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | 2026-06-19T13:02:53.141Z |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Desarrollar la tool determinista que conecte n8n con Supabase para extraer datos desde vistas estructuradas y soportar respuestas exactas en Mateo.

Justificación de Negocio (Why)
Sin una conexión determinista a las vistas normalizadas, Mateo no puede responder consultas comerciales con precisión confiable.

Especificación del Caso de Uso (Where / When)
Actor Principal: Usuarios que consultan datos por WhatsApp
Ubicación: Integración n8n con Supabase para Mateo
Frecuencia: Uso recurrente en consultas de negocio

Flujo Principal (How)

1. Definir el mecanismo de consulta determinista hacia Supabase.
2. Implementar la conexión desde n8n a las vistas estructuradas.
3. Mapear la respuesta técnica a una salida usable por Mateo.
4. Validar exactitud y estabilidad en pruebas.

Flujos Alternativos o Reglas de Negocio
La consulta debe limitarse a vistas normalizadas y no a interpretaciones abiertas de datos.

Restricciones
El desarrollo debe ceñirse a Supabase y n8n como componentes base.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-16: Conectar vistas de inventario para Mateo compras y ventas {#pol-16}

| Field | Value |
|-------|-------|
| **ID** | POL-16 |
| **Title** | Conectar vistas de inventario para Mateo compras y ventas |
| **URL** | [https://linear.app/polaria/issue/POL-16](https://linear.app/polaria/issue/POL-16) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-16-conectar-vistas-de-inventario-para-mateo-compras-y-ventas` |
| **Created At** | 2026-06-18T21:55:58.759Z |
| **Updated At** | 2026-06-18T22:05:48.763Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | 2026-06-19T13:02:53.000Z |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Mapear y conectar las vistas normalizadas de inventario_compras e inventario_ventas para habilitar consultas deterministas en Mateo compras y Mateo ventas.

Justificación de Negocio (Why)
Estas consultas son parte del alcance funcional esperado para atender necesidades comerciales inmediatas desde WhatsApp.

Especificación del Caso de Uso (Where / When)
Actor Principal: Compradores y usuarios de Mateo compras y ventas
Ubicación: Vistas de inventario conectadas a Mateo
Frecuencia: Consultas recurrentes sobre inventario

Flujo Principal (How)

1. Revisar la estructura de las vistas de inventario requeridas.
2. Mapear los campos necesarios para cada caso de uso.
3. Conectar las vistas a la tool determinista de consulta.
4. Validar respuestas correctas en ambos flujos.

Flujos Alternativos o Reglas de Negocio
Cada Mateo debe consumir únicamente las vistas que le correspondan según su dominio funcional.

Restricciones
El alcance se limita a las vistas normalizadas definidas para compras y ventas.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-17: Conectar vistas TCI de kardex compras ventas y facturación {#pol-17}

| Field | Value |
|-------|-------|
| **ID** | POL-17 |
| **Title** | Conectar vistas TCI de kardex compras ventas y facturación |
| **URL** | [https://linear.app/polaria/issue/POL-17](https://linear.app/polaria/issue/POL-17) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-17-conectar-vistas-tci-de-kardex-compras-ventas-y-facturacion` |
| **Created At** | 2026-06-18T21:55:58.861Z |
| **Updated At** | 2026-06-18T22:05:48.819Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | 2026-06-19T13:02:23.781Z |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: High

Descripción (What)
Mapear y conectar las vistas normalizadas de TCI para kardex, compras, ventas y facturación dentro del alcance de consultas deterministas de Mateo.

Justificación de Negocio (Why)
Estas vistas habilitan el acceso a información clave para ejecutivos y usuarios del cliente sin depender de procesos manuales de consulta.

Especificación del Caso de Uso (Where / When)
Actor Principal: Ejecutivos y usuarios de TCI JBR
Ubicación: Consultas TCI en Mateo
Frecuencia: Consultas recurrentes de información comercial y operativa

Flujo Principal (How)

1. Revisar las vistas de kardex, compras, ventas y facturación.
2. Mapear la información necesaria para cada tipo de consulta.
3. Conectar las vistas al flujo determinista de Mateo.
4. Validar que la respuesta corresponda con la información real de Supabase.

Flujos Alternativos o Reglas de Negocio
Cada consulta debe resolverse contra la vista correspondiente y mantener consistencia en la respuesta generada.

Restricciones
El alcance se limita a las vistas normalizadas previstas para TCI dentro de este mes.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-18: Crear suite de pruebas de precisión sin alucinaciones {#pol-18}

| Field | Value |
|-------|-------|
| **ID** | POL-18 |
| **Title** | Crear suite de pruebas de precisión sin alucinaciones |
| **URL** | [https://linear.app/polaria/issue/POL-18](https://linear.app/polaria/issue/POL-18) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-18-crear-suite-de-pruebas-de-precision-sin-alucinaciones` |
| **Created At** | 2026-06-18T21:55:58.957Z |
| **Updated At** | 2026-06-18T22:05:48.880Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | 2026-06-19T13:02:54.082Z |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Medium

Descripción (What)
Diseñar y ejecutar pruebas de interacción para validar que Mateo entregue información exacta desde Supabase sin registrar alucinaciones críticas.

Justificación de Negocio (Why)
La precisión es un criterio de calidad central para que el producto pueda pasar de pruebas a una operación confiable.

Especificación del Caso de Uso (Where / When)
Actor Principal: Equipo técnico y usuarios de prueba
Ubicación: Entorno de pruebas de Mateo
Frecuencia: Validación durante este mes antes del cierre de la épica

Flujo Principal (How)

1. Definir escenarios de prueba por tipo de consulta.
2. Ejecutar preguntas de validación contra las vistas conectadas.
3. Comparar respuestas generadas contra los datos reales.
4. Registrar hallazgos y ajustar el flujo cuando sea necesario.

Flujos Alternativos o Reglas de Negocio
Las pruebas deben cubrir precisión, consistencia de tono y ausencia de alucinaciones relevantes.

Restricciones
La validación depende de que las vistas y la tool determinista ya estén conectadas.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-19: Optimizar latencia de consultas IA y Supabase {#pol-19}

| Field | Value |
|-------|-------|
| **ID** | POL-19 |
| **Title** | Optimizar latencia de consultas IA y Supabase |
| **URL** | [https://linear.app/polaria/issue/POL-19](https://linear.app/polaria/issue/POL-19) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-19-optimizar-latencia-de-consultas-ia-y-supabase` |
| **Created At** | 2026-06-18T21:55:59.045Z |
| **Updated At** | 2026-06-18T22:05:48.950Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | 2026-06-19T13:02:53.578Z |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Medium

Descripción (What)
Medir y optimizar el tiempo de respuesta de la interacción entre IA, Supabase y usuario final para mantener la latencia objetivo.

Justificación de Negocio (Why)
La velocidad de respuesta afecta directamente la experiencia del usuario en WhatsApp y es uno de los indicadores clave de la épica.

Especificación del Caso de Uso (Where / When)
Actor Principal: Usuarios finales de Mateo
Ubicación: Flujo de consulta IA - Supabase - WhatsApp
Frecuencia: Uso permanente en cada consulta

Flujo Principal (How)

1. Medir la latencia actual de las consultas.
2. Identificar cuellos de botella en n8n, Supabase o generación de respuesta.
3. Aplicar ajustes de optimización sobre los componentes necesarios.
4. Revalidar tiempos de respuesta contra la meta definida.

Flujos Alternativos o Reglas de Negocio
Si la meta no se cumple, deben priorizarse ajustes sobre consultas críticas antes de ampliar el alcance.

Restricciones
El trabajo depende del comportamiento real del flujo completo ya conectado.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-20: Validar despliegue final de Mateo determinista en pruebas {#pol-20}

| Field | Value |
|-------|-------|
| **ID** | POL-20 |
| **Title** | Validar despliegue final de Mateo determinista en pruebas |
| **URL** | [https://linear.app/polaria/issue/POL-20](https://linear.app/polaria/issue/POL-20) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Daniel De Jesus Galvis Zambrano |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-20-validar-despliegue-final-de-mateo-determinista-en-pruebas` |
| **Created At** | 2026-06-18T21:55:59.140Z |
| **Updated At** | 2026-06-18T22:05:49.009Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | 2026-06-19T13:02:53.324Z |

### Description

Stakeholder u Origen: Daniel De Jesus Galvis Zambrano

Prioridad: Medium

Descripción (What)
Realizar la validación final del comportamiento determinista y humanizado de Mateo en entorno de pruebas antes del cierre de la épica.

Justificación de Negocio (Why)
La validación final consolida el avance técnico y permite decidir con criterio si la capacidad está lista para seguir avanzando.

Especificación del Caso de Uso (Where / When)
Actor Principal: Responsable de la épica y equipo técnico
Ubicación: Entorno de pruebas de Mateo
Frecuencia: Validación de cierre durante este mes

Flujo Principal (How)

1. Consolidar las capacidades implementadas de consultas y personalidad.
2. Ejecutar pruebas integrales de punta a punta.
3. Revisar precisión, tono y tiempo de respuesta.
4. Documentar aprobación o ajustes pendientes antes del cierre.

Flujos Alternativos o Reglas de Negocio
La validación debe considerar únicamente el alcance comprometido para este mes.

Restricciones
Depende de la disponibilidad funcional de las vistas, la tool y las pruebas de calidad previas.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-27: Construir Casos de Uso Mateo TCI (KPI1, KPI2 y KPI3) {#pol-27}

| Field | Value |
|-------|-------|
| **ID** | POL-27 |
| **Title** | Construir Casos de Uso Mateo TCI (KPI1, KPI2 y KPI3) |
| **URL** | [https://linear.app/polaria/issue/POL-27](https://linear.app/polaria/issue/POL-27) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Mauricio Jose Manjarres Duque |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-27-construir-casos-de-uso-mateo-tci-kpi1-kpi2-y-kpi3` |
| **Created At** | 2026-06-19T12:34:32.313Z |
| **Updated At** | 2026-06-19T13:00:56.646Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Mauricio Jose Manjarres Duque

Prioridad: Medium

Descripción (What)
Definir y documentar detalladamente los escenarios y flujos de consulta de los usuarios finales ejecutivos de TCI JBR para Mateo. El alcance incluye mapear las preguntas esperadas sobre Kardex, compras, ventas y facturación, y diseñar al menos los casos de uso UC-TCI-01 para consulta del estado actual de Kardex e histórico de movimientos y UC-TCI-02 para reporte de facturación y transacciones comerciales del periodo.

Justificación de Negocio (Why)
Este trabajo permite establecer la base funcional para medir precisión, latencia y cobertura de vistas en Mateo. Sin esta definición, el desarrollo conversacional carece de criterios claros de entrada y validación para respuestas exactas y naturales.

Especificación del Caso de Uso (Where / When)
Actor Principal: Usuarios ejecutivos de TCI JBR
Ubicación: Flujos de consulta por WhatsApp sobre Kardex, compras, ventas y facturación
Frecuencia: Actividad de definición de Sprint 1, requerida al inicio de la fase funcional

Flujo Principal (How)

1. Identificar los escenarios de consulta de los usuarios ejecutivos de TCI JBR.
2. Mapear las preguntas exactas esperadas sobre Kardex, compras, ventas y facturación.
3. Diseñar el caso de uso UC-TCI-01 para estado actual de Kardex e histórico de movimientos.
4. Diseñar el caso de uso UC-TCI-02 para facturación y transacciones comerciales del periodo.
5. Documentar entradas esperadas en WhatsApp y criterios de medición para KPI1, KPI2 y KPI3.
6. Someter el documento a aprobación.

Flujos Alternativos o Reglas de Negocio
El documento debe especificar entradas esperadas en WhatsApp y criterios para medir precisión, latencia y cobertura de vistas. El entregable se considera completo cuando el documento de casos de uso quede aprobado.

Restricciones
Depende de la disponibilidad de información funcional del cliente TCI JBR y de la alineación con los KPIs definidos para Mateo.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-28: Construir Casos de Uso Mateo Polaria — Compras y Ventas (KPI1, KPI2 y KPI3) {#pol-28}

| Field | Value |
|-------|-------|
| **ID** | POL-28 |
| **Title** | Construir Casos de Uso Mateo Polaria — Compras y Ventas (KPI1, KPI2 y KPI3) |
| **URL** | [https://linear.app/polaria/issue/POL-28](https://linear.app/polaria/issue/POL-28) |
| **Status** | Backlog |
| **Priority** | Medium |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Mauricio Jose Manjarres Duque |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-28-construir-casos-de-uso-mateo-polaria-compras-y-ventas-kpi1` |
| **Created At** | 2026-06-19T12:34:32.435Z |
| **Updated At** | 2026-06-19T13:00:50.225Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Mauricio Jose Manjarres Duque

Prioridad: Medium

Descripción (What)
Modelar los casos de uso específicos para compradores y proveedores del cliente de Polaria en las interacciones cotidianas de abastecimiento y ventas por WhatsApp. El alcance incluye definir UC-POL-01 para proveedores consultando requerimientos u órdenes vía inventario_compras y UC-POL-02 para clientes o compradores consultando disponibilidad en inventario_ventas.

Justificación de Negocio (Why)
Este trabajo permite traducir necesidades reales de operación comercial a flujos conversacionales concretos y verificables. Su definición es necesaria para validar respuestas exactas y humanizadas sin alucinaciones en escenarios de compras y ventas.

Especificación del Caso de Uso (Where / When)
Actor Principal: Compradores, proveedores y clientes vinculados a operaciones de Polaria
Ubicación: Flujos de conversación por WhatsApp asociados a inventario_compras e inventario_ventas
Frecuencia: Actividad de definición de Sprint 1, requerida al inicio de la fase funcional

Flujo Principal (How)

1. Identificar las interacciones cotidianas de abastecimiento y ventas por WhatsApp.
2. Definir el caso de uso UC-POL-01 para consultas de proveedores sobre requerimientos u órdenes vía inventario_compras.
3. Definir el caso de uso UC-POL-02 para consultas de clientes o compradores sobre disponibilidad vía inventario_ventas.
4. Documentar historias de usuario y flujos conversacionales asociados.
5. Validar que los flujos permitan respuestas exactas y humanizadas sin alucinaciones.
6. Someter los flujos a aprobación.

Flujos Alternativos o Reglas de Negocio
El entregable debe incluir historias de usuario y flujos conversacionales aprobados. La validación debe centrarse en exactitud de la respuesta y naturalidad del comportamiento conversacional.

Restricciones
Depende de la definición funcional del cliente de Polaria y de la disponibilidad de los flujos comerciales que se van a modelar.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-29: Mapeo e Integración de Vistas de Ventas y Compras - Revisar Flujo IA/Tool {#pol-29}

| Field | Value |
|-------|-------|
| **ID** | POL-29 |
| **Title** | Mapeo e Integración de Vistas de Ventas y Compras - Revisar Flujo IA/Tool |
| **URL** | [https://linear.app/polaria/issue/POL-29](https://linear.app/polaria/issue/POL-29) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Mauricio Jose Manjarres Duque |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-29-mapeo-e-integracion-de-vistas-de-ventas-y-compras-revisar` |
| **Created At** | 2026-06-19T12:34:32.549Z |
| **Updated At** | 2026-06-19T13:00:44.637Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Mauricio Jose Manjarres Duque

Prioridad: High

Descripción (What)
Tomar las vistas normalizadas de compras y ventas en Supabase y conectarlas con el nodo correspondiente en n8n. El trabajo incluye mapear los campos de inventario_compras, mapear los campos de inventario_ventas y ajustar el flujo técnico de n8n para que la tool determinista entregue un JSON limpio a la IA sin improvisación de datos.

Justificación de Negocio (Why)
Este trabajo habilita una parte crítica del flujo técnico que sostiene las respuestas deterministas de Mateo. Sin esta integración, la solución no puede consultar datos de compras y ventas de forma confiable ni garantizar exactitud en las respuestas conversacionales.

Especificación del Caso de Uso (Where / When)
Actor Principal: Equipo técnico encargado de Supabase, n8n y la integración conversacional
Ubicación: Vistas inventario_compras e inventario_ventas en Supabase y flujo técnico en n8n
Frecuencia: Actividad técnica de Sprint 1, requerida antes de validar consultas deterministas sobre compras y ventas

Flujo Principal (How)

1. Revisar la estructura de la vista inventario_compras.
2. Mapear los campos necesarios de inventario_compras.
3. Revisar la estructura de la vista inventario_ventas.
4. Mapear los campos necesarios de inventario_ventas.
5. Conectar ambas vistas al nodo correspondiente en n8n.
6. Ajustar el flujo técnico para que la tool determinista entregue un JSON limpio a la IA.
7. Ejecutar pruebas con parámetros de texto y validar extracción correcta de registros.

Flujos Alternativos o Reglas de Negocio
La integración debe evitar que la IA improvise datos. El criterio de aceptación exige conexión exitosa y capacidad del flujo n8n para extraer registros correctos desde Supabase con parámetros de prueba de texto.

Restricciones
Depende del acceso y consistencia de las vistas normalizadas en Supabase y de la compatibilidad del flujo técnico en n8n con la tool determinista.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---


## POL-30: Mapeo e Integración de la Vista de Kardex y Facturación - Revisar Flujo IA/Tool {#pol-30}

| Field | Value |
|-------|-------|
| **ID** | POL-30 |
| **Title** | Mapeo e Integración de la Vista de Kardex y Facturación - Revisar Flujo IA/Tool |
| **URL** | [https://linear.app/polaria/issue/POL-30](https://linear.app/polaria/issue/POL-30) |
| **Status** | Backlog |
| **Priority** | High |
| **Labels** | Feature |
| **Project** | Mateo - Desplegar consultas deterministas en Supabase |
| **Team** | POLARIA |
| **Created By** | Mauricio Jose Manjarres Duque |
| **Assignee** | _Unassigned_ |
| **Git Branch** | `lucho/pol-30-mapeo-e-integracion-de-la-vista-de-kardex-y-facturacion` |
| **Created At** | 2026-06-19T12:34:32.664Z |
| **Updated At** | 2026-06-19T13:00:08.354Z |
| **Started At** | _Not set_ |
| **Completed At** | _Not set_ |
| **Canceled At** | _Not set_ |
| **Due Date** | _Not set_ |
| **Archived At** | _Not set_ |

### Description

Stakeholder u Origen: Mauricio Jose Manjarres Duque

Prioridad: High

Descripción (What)
Enlazar las vistas de Kardex y Facturación en Supabase hacia la estructura de flujos en n8n para que queden listas para consumo por el modelo conversacional. El trabajo incluye conectar el nodo de base de datos a la vista de Kardex, conectar el nodo de base de datos a la vista de Facturación y revisar compatibilidad y velocidad de la tool determinista frente a estas tablas masivas.

Justificación de Negocio (Why)
Este trabajo completa una parte crítica del ecosistema técnico necesario para consultas deterministas en Mateo. Sin este mapeo, no quedan disponibles dos de las vistas core necesarias para responder con exactitud y evaluar el rendimiento inicial de la base de datos.

Especificación del Caso de Uso (Where / When)
Actor Principal: Equipo técnico encargado de Supabase, n8n y la integración conversacional
Ubicación: Vistas de Kardex y Facturación en Supabase y flujos técnicos en n8n
Frecuencia: Actividad técnica de Sprint 1, requerida antes de la siguiente fase del modelo conversacional

Flujo Principal (How)

1. Revisar la estructura de la vista de Kardex.
2. Conectar el nodo de base de datos a la vista de Kardex.
3. Revisar la estructura de la vista de Facturación.
4. Conectar el nodo de base de datos a la vista de Facturación.
5. Ajustar la integración dentro de la estructura de flujos en n8n.
6. Revisar compatibilidad y velocidad de la tool determinista frente a tablas masivas.
7. Validar que los datos queden listos para consumo por el modelo conversacional.

Flujos Alternativos o Reglas de Negocio
El criterio de aceptación exige mapeo técnico completo de ambas vistas y disponibilidad de los datos en n8n para la siguiente fase. Esta actividad es crítica para evaluar el rendimiento inicial de la base de datos.

Restricciones
Depende del acceso a las vistas core en Supabase, del comportamiento de tablas masivas y de la compatibilidad del flujo técnico en n8n con la tool determinista.

### Relations

**Blocks:**

_None_

**Blocked By:**

_None_

**Related To:**

_None_

**Duplicate Of:**

_None_

### Attachments

_None_

---

