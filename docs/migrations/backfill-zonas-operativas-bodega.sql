-- Backfill zonas operativas (ingreso, salida, procesamiento) para bodegas internas
-- que solo tenían tipo INGRESO/ALMACEN sin ubicaciones de recepción o picking.
-- Idempotente: no duplica si ya existen ubicaciones del tipo.

DO $$
DECLARE
  b RECORD;
  v_tipo_ingreso uuid;
  v_tipo_salida uuid;
  v_tipo_procesamiento uuid;
  v_zona_ingreso uuid;
  v_zona_salida uuid;
  v_zona_procesamiento uuid;
  v_idx int;
  v_codigo text;
BEGIN
  FOR b IN
    SELECT id_bodega, codigo_cuenta
    FROM bodega
    WHERE tipo = 'interna' AND esta_activa = true
  LOOP
    -- Tipo INGRESO (puede existir sin ubicaciones)
    INSERT INTO tipo_ubicacion (
      codigo_cuenta, id_bodega, codigo, nombre,
      es_picking, es_recepcion, es_almacenamiento
    )
    VALUES (b.codigo_cuenta, b.id_bodega, 'INGRESO', 'Ingreso', false, true, false)
    ON CONFLICT (id_bodega, codigo) DO NOTHING;

    INSERT INTO tipo_ubicacion (
      codigo_cuenta, id_bodega, codigo, nombre,
      es_picking, es_recepcion, es_almacenamiento
    )
    VALUES (b.codigo_cuenta, b.id_bodega, 'SALIDA', 'Salida', true, false, false)
    ON CONFLICT (id_bodega, codigo) DO NOTHING;

    INSERT INTO tipo_ubicacion (
      codigo_cuenta, id_bodega, codigo, nombre,
      es_picking, es_recepcion, es_almacenamiento
    )
    VALUES (b.codigo_cuenta, b.id_bodega, 'PROCESAMIENTO', 'Procesamiento', false, false, false)
    ON CONFLICT (id_bodega, codigo) DO NOTHING;

    SELECT id_tipo_ubicacion INTO v_tipo_ingreso
    FROM tipo_ubicacion WHERE id_bodega = b.id_bodega AND codigo = 'INGRESO';

    SELECT id_tipo_ubicacion INTO v_tipo_salida
    FROM tipo_ubicacion WHERE id_bodega = b.id_bodega AND codigo = 'SALIDA';

    SELECT id_tipo_ubicacion INTO v_tipo_procesamiento
    FROM tipo_ubicacion WHERE id_bodega = b.id_bodega AND codigo = 'PROCESAMIENTO';

    INSERT INTO zona (codigo_cuenta, id_bodega, codigo, nombre)
    VALUES (b.codigo_cuenta, b.id_bodega, 'INGRESO', 'Zona de ingreso')
    ON CONFLICT (id_bodega, codigo) DO NOTHING;

    INSERT INTO zona (codigo_cuenta, id_bodega, codigo, nombre)
    VALUES (b.codigo_cuenta, b.id_bodega, 'SALIDA', 'Zona de salida')
    ON CONFLICT (id_bodega, codigo) DO NOTHING;

    INSERT INTO zona (codigo_cuenta, id_bodega, codigo, nombre)
    VALUES (b.codigo_cuenta, b.id_bodega, 'PROCESAMIENTO', 'Procesamiento')
    ON CONFLICT (id_bodega, codigo) DO NOTHING;

    SELECT id_zona INTO v_zona_ingreso
    FROM zona WHERE id_bodega = b.id_bodega AND codigo = 'INGRESO';

    SELECT id_zona INTO v_zona_salida
    FROM zona WHERE id_bodega = b.id_bodega AND codigo = 'SALIDA';

    SELECT id_zona INTO v_zona_procesamiento
    FROM zona WHERE id_bodega = b.id_bodega AND codigo = 'PROCESAMIENTO';

    IF NOT EXISTS (
      SELECT 1 FROM ubicacion u
      JOIN tipo_ubicacion t ON t.id_tipo_ubicacion = u.id_tipo_ubicacion
      WHERE u.id_bodega = b.id_bodega AND t.es_recepcion = true
    ) THEN
      FOR v_idx IN 1..8 LOOP
        v_codigo := 'ING-' || lpad(v_idx::text, 2, '0');
        INSERT INTO ubicacion (
          codigo_cuenta, id_bodega, id_zona, id_tipo_ubicacion, codigo, estado_slot
        )
        VALUES (
          b.codigo_cuenta, b.id_bodega, v_zona_ingreso, v_tipo_ingreso, v_codigo, 'libre'
        )
        ON CONFLICT (id_bodega, codigo) DO NOTHING;
      END LOOP;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM ubicacion u
      JOIN tipo_ubicacion t ON t.id_tipo_ubicacion = u.id_tipo_ubicacion
      WHERE u.id_bodega = b.id_bodega AND t.es_picking = true
    ) THEN
      FOR v_idx IN 1..8 LOOP
        v_codigo := 'SAL-' || lpad(v_idx::text, 2, '0');
        INSERT INTO ubicacion (
          codigo_cuenta, id_bodega, id_zona, id_tipo_ubicacion, codigo, estado_slot
        )
        VALUES (
          b.codigo_cuenta, b.id_bodega, v_zona_salida, v_tipo_salida, v_codigo, 'libre'
        )
        ON CONFLICT (id_bodega, codigo) DO NOTHING;
      END LOOP;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM ubicacion u
      JOIN tipo_ubicacion t ON t.id_tipo_ubicacion = u.id_tipo_ubicacion
      WHERE u.id_bodega = b.id_bodega AND t.codigo = 'PROCESAMIENTO'
    ) THEN
      FOR v_idx IN 1..4 LOOP
        v_codigo := 'PROC-' || lpad(v_idx::text, 2, '0');
        INSERT INTO ubicacion (
          codigo_cuenta, id_bodega, id_zona, id_tipo_ubicacion, codigo, estado_slot
        )
        VALUES (
          b.codigo_cuenta, b.id_bodega, v_zona_procesamiento, v_tipo_procesamiento, v_codigo, 'libre'
        )
        ON CONFLICT (id_bodega, codigo) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;
