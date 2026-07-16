-- Espejo de polaria-wms-db/migrations/051_widget_mateo_conversaciones.sql
-- Aplicar desde polaria-wms-db (fuente de verdad del esquema). Este archivo
-- documenta el contrato esperado por Prisma en el API.

CREATE TABLE IF NOT EXISTS widget_conversacion (
    id_conversacion uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario      uuid NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    codigo_cuenta   varchar(32) REFERENCES cuenta (codigo_cuenta),
    titulo          varchar(255),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_widget_conversacion_usuario_updated
    ON widget_conversacion (id_usuario, updated_at DESC);

CREATE TABLE IF NOT EXISTS widget_mensaje (
    id_mensaje      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_conversacion uuid NOT NULL REFERENCES widget_conversacion (id_conversacion) ON DELETE CASCADE,
    rol             varchar(10) NOT NULL,
    tipo            varchar(10) NOT NULL DEFAULT 'text',
    contenido       text NOT NULL,
    es_error        boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_widget_mensaje_rol CHECK (rol IN ('user', 'ai')),
    CONSTRAINT chk_widget_mensaje_tipo CHECK (tipo IN ('text', 'image'))
);

CREATE INDEX IF NOT EXISTS idx_widget_mensaje_conversacion_created
    ON widget_mensaje (id_conversacion, created_at ASC);
