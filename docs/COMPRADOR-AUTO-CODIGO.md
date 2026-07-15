# Comprador — auto-código para inserts del bot

## Problema

- **Manual (UI admin):** `createCompradorAdmin` en web genera `codigo` de 5 caracteres con `generateCodigoCuentaFromNombre(nombre)` antes del insert.
- **Bot (compañero/n8n):** inserta directo en tabla `comprador` sin `codigo` → la UI se rompe.

## Solución (BD)

Migración `docs/migrations/050_comprador_auto_codigo.sql`:

1. Función `generate_codigo_cuenta_from_nombre(text)` — misma lógica que el front.
2. Trigger `trg_comprador_ensure_codigo` **BEFORE INSERT OR UPDATE**:
   - Si `codigo` viene vacío/null → genera automáticamente.
   - Si `codigo` ya viene (manual) → solo normaliza (uppercase, alfanumérico); **no lo regenera**.
3. Backfill de filas existentes con `codigo` vacío.

## Aplicado en dev

- Proyecto: `polaria-wms-dev`
- Migraciones: `050_comprador_auto_codigo`, `050_comprador_auto_codigo_fix`

## Verificación

```sql
-- Debe devolver 3Q12U (igual que el front)
SELECT generate_codigo_cuenta_from_nombre('Edgar Escobar');

-- Simular bot
INSERT INTO comprador (codigo_cuenta, codigo, nombre, esta_activo)
VALUES ('TU_CUENTA', '', 'Nombre desde bot', true)
RETURNING codigo, nombre;
```
