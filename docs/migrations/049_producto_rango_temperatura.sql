-- POL-94: rango de temperatura por producto para validación en recepción
ALTER TABLE producto
  ADD COLUMN IF NOT EXISTS rango_temperatura_min NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS rango_temperatura_max NUMERIC(8, 2);

COMMENT ON COLUMN producto.rango_temperatura_min IS 'Temperatura mínima permitida en recepción (°C)';
COMMENT ON COLUMN producto.rango_temperatura_max IS 'Temperatura máxima permitida en recepción (°C); default operativo 5°C si null (frio)';
