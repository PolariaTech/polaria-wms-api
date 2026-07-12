-- Presencia operativa de operarios en bodega (heartbeat)
CREATE TABLE IF NOT EXISTS sesion_operativa (
    id_sesion     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario    uuid NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    codigo_cuenta varchar(32) NOT NULL REFERENCES cuenta (codigo_cuenta),
    id_bodega     uuid NOT NULL REFERENCES bodega (id_bodega) ON DELETE CASCADE,
    ultimo_ping   timestamptz NOT NULL,
    expira_en     timestamptz NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_sesion_operativa_usuario_bodega UNIQUE (id_usuario, codigo_cuenta, id_bodega)
);

CREATE INDEX IF NOT EXISTS idx_sesion_operativa_bodega_expira
    ON sesion_operativa (codigo_cuenta, id_bodega, expira_en);

COMMENT ON TABLE sesion_operativa IS 'Heartbeat de presencia operativa: operario disponible mientras expira_en > now().';
COMMENT ON COLUMN sesion_operativa.ultimo_ping IS 'Último POST /operaciones/presencia/ping recibido.';
COMMENT ON COLUMN sesion_operativa.expira_en IS 'Ventana de disponibilidad (típicamente ultimo_ping + 2 minutos).';
