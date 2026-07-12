-- Vínculo orden de trabajo ↔ orden de venta (emisión OV)
ALTER TABLE orden_trabajo
    ADD COLUMN IF NOT EXISTS id_orden_venta uuid REFERENCES orden_venta (id_orden_venta) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orden_trabajo_orden_venta
    ON orden_trabajo (id_orden_venta)
    WHERE id_orden_venta IS NOT NULL;

COMMENT ON COLUMN orden_trabajo.id_orden_venta IS 'OV que originó la tarea de despacho/traslado.';
