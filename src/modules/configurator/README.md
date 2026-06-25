# Módulo Configurador

Endpoints de plataforma (scope `platform`) reservados al rol **configurador**.

## POST /configurador/usuarios

Crea un usuario operativo del WMS: credenciales en Supabase Auth (service role) y fila en `usuario` (+ `asignacion_bodega` si aplica).

### Autorización

- Bearer JWT (Supabase)
- `JwtAuthGuard` + `TenantGuard` + `RolesGuard`
- Solo `idRol = configurador`

### Body

| Campo | Tipo | Obligatorio | Notas |
|-------|------|-------------|-------|
| `username` | string | sí | Único en `usuario` |
| `nombre` | string | sí | |
| `idRol` | `wms_rol` | sí | No `configurador` |
| `codigoEmpresa` | string | condicional | Obligatorio salvo roles plataforma (rechazados) |
| `codigoCuenta` | string | condicional | Obligatorio para roles cuenta/bodega |
| `idBodega` | uuid | condicional | Obligatorio para roles de nivel bodega |
| `correo` | string | sí | Único; mínimo formato email |
| `password` | string | sí | Mínimo 6 caracteres |

### Validaciones de negocio

- **Roles cuenta** (`administrador_cuenta`, `operador_cuenta`): `codigoEmpresa` + `codigoCuenta` coherentes (la cuenta pertenece a la empresa). No se admite `idBodega`.
- **Roles bodega** (`administrador_bodega`, `jefe_bodega`, `custodio`, `operario`, etc. con `rol.nivel = bodega`): mismos campos de tenant + `idBodega` obligatorio; la bodega debe pertenecer a `codigoCuenta`.
- **Configurador / plataforma**: rechazado explícitamente (403/400).
- Empresa, cuenta y bodega deben estar activas.

### Respuesta 201

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

### Errores habituales

| Código | Motivo |
|--------|--------|
| 400 | Validación DTO o reglas de tenant |
| 403 | Rol distinto de configurador, o entidad inactiva |
| 404 | Cuenta o bodega inexistente |
| 409 | Username o correo duplicado (WMS o Supabase Auth) |

### Rollback

Si falla el INSERT en Prisma tras crear el usuario en Auth, se elimina el registro Auth con `admin.deleteUser`.
