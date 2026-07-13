-- Permite movimientos de inventario vinculados a solicitudes de procesamiento
-- (merma al cerrar, consumo/transferencia en iniciar y post-cierre).

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
      'manual'
    )
  );
