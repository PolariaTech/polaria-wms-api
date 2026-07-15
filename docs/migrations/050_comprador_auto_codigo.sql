-- Auto-generar código de 5 caracteres en comprador cuando el insert no trae código
-- (p. ej. bot/n8n que escribe directo en la tabla). El flujo manual del front
-- ya envía codigo y no se sobrescribe.

CREATE OR REPLACE FUNCTION generate_codigo_cuenta_from_nombre(p_nombre text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
  i int;
  ch text;
  cp int;
  h bigint := 0;
  digits constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
  result text := '';
  n bigint;
BEGIN
  normalized := btrim(p_nombre);
  IF normalized = '' THEN
    RETURN NULL;
  END IF;

  FOR i IN 1..char_length(normalized) LOOP
    ch := substring(normalized FROM i FOR 1);
    cp := ascii(ch);
    h := (h * 36 + cp) & 4294967295;
  END LOOP;

  n := h;
  IF n = 0 THEN
    result := '0';
  ELSE
    WHILE n > 0 LOOP
      result := substr(digits, (n % 36)::int + 1, 1) || result;
      n := n / 36;
    END LOOP;
  END IF;

  result := upper(result);
  IF char_length(result) < 5 THEN
    result := lpad(result, 5, '0');
  END IF;
  RETURN right(result, 5);
END;
$$;

COMMENT ON FUNCTION generate_codigo_cuenta_from_nombre(text) IS
  'Replica generateCodigoCuentaFromNombre del front (hash base36, 5 chars).';

CREATE OR REPLACE FUNCTION comprador_resolve_codigo(
  p_codigo_cuenta text,
  p_nombre text,
  p_codigo_actual text,
  p_id_comprador uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_codigo text;
  base_codigo text;
  candidate text;
  attempt int;
BEGIN
  IF p_nombre IS NULL OR btrim(p_nombre) = '' THEN
    RETURN p_codigo_actual;
  END IF;

  normalized_codigo := upper(regexp_replace(btrim(coalesce(p_codigo_actual, '')), '[^A-Z0-9]', '', 'g'));
  IF char_length(normalized_codigo) > 32 THEN
    normalized_codigo := left(normalized_codigo, 32);
  END IF;

  IF normalized_codigo <> '' THEN
    RETURN normalized_codigo;
  END IF;

  FOR attempt IN 0..35 LOOP
    IF attempt = 0 THEN
      candidate := generate_codigo_cuenta_from_nombre(p_nombre);
    ELSE
      candidate := generate_codigo_cuenta_from_nombre(p_nombre || attempt::text);
    END IF;

    EXIT WHEN candidate IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM comprador c
        WHERE c.codigo_cuenta = p_codigo_cuenta
          AND c.codigo = candidate
          AND (p_id_comprador IS NULL OR c.id_comprador <> p_id_comprador)
      );
  END LOOP;

  IF candidate IS NULL THEN
    RAISE EXCEPTION 'No se pudo generar código único para comprador %', p_nombre;
  END IF;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION comprador_ensure_codigo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.codigo := comprador_resolve_codigo(
    NEW.codigo_cuenta,
    NEW.nombre,
    NEW.codigo,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.id_comprador ELSE NULL END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comprador_ensure_codigo ON comprador;

CREATE TRIGGER trg_comprador_ensure_codigo
  BEFORE INSERT OR UPDATE OF codigo, nombre, codigo_cuenta ON comprador
  FOR EACH ROW
  EXECUTE FUNCTION comprador_ensure_codigo();

-- Backfill: filas sin código (bot u otros inserts directos)
UPDATE comprador c
SET codigo = comprador_resolve_codigo(
  c.codigo_cuenta,
  c.nombre,
  c.codigo,
  c.id_comprador
)
WHERE btrim(coalesce(c.codigo, '')) = '';
