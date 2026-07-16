-- Extiende valores permitidos de tipo_referencia (auditoría).
-- El API de paquete-despacho ya usa 'orden_venta' sin requerir este SQL;
-- incluir viaje_transporte por si se usa en el futuro.

ALTER TABLE movimiento_inventario
  DROP CONSTRAINT IF EXISTS chk_movimiento_tipo_referencia;

ALTER TABLE movimiento_inventario
  ADD CONSTRAINT chk_movimiento_tipo_referencia
  CHECK (
    tipo_referencia IS NULL
    OR tipo_referencia IN (
      'orden_compra',
      'orden_trabajo',
      'orden_venta',
      'solicitud_compra',
      'solicitud_procesamiento',
      'viaje_transporte',
      'manual'
    )
  );
