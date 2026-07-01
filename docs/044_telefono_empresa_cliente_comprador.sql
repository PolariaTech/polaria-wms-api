-- Teléfono de contacto en empresa, cliente y comprador
ALTER TABLE empresa
    ADD COLUMN IF NOT EXISTS telefono varchar(32);

ALTER TABLE cliente
    ADD COLUMN IF NOT EXISTS telefono varchar(32);

ALTER TABLE comprador
    ADD COLUMN IF NOT EXISTS telefono varchar(32);

COMMENT ON COLUMN empresa.telefono IS 'Teléfono de contacto de la empresa (formato internacional E.164).';
COMMENT ON COLUMN cliente.telefono IS 'Teléfono de contacto del cliente (formato internacional E.164).';
COMMENT ON COLUMN comprador.telefono IS 'Teléfono de contacto del comprador (formato internacional E.164).';
