-- Flujo procesamiento (frio): operario asignado + vínculo tarea ↔ solicitud

ALTER TABLE solicitud_procesamiento
  ADD COLUMN IF NOT EXISTS id_operario uuid REFERENCES usuario(id_usuario);

ALTER TABLE tarea_cola
  ADD COLUMN IF NOT EXISTS id_solicitud_procesamiento uuid
    REFERENCES solicitud_procesamiento(id_solicitud_procesamiento);

CREATE INDEX IF NOT EXISTS idx_tarea_cola_solicitud_procesamiento
  ON tarea_cola (id_solicitud_procesamiento)
  WHERE id_solicitud_procesamiento IS NOT NULL;
