-- ================================================================
-- POSManual - DevSys Honduras
-- Migración: agregar columna ultimo_acceso a usuarios
-- Archivo: server/src/db/migrations/002_ultimo_acceso.sql
-- Ejecutar: psql -d posmanual -f 002_ultimo_acceso.sql
-- ================================================================

-- Columna para registrar el último login de cada usuario
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;

-- Índice para ordenar por último acceso en reportes de actividad
CREATE INDEX IF NOT EXISTS idx_usuarios_ultimo_acceso
  ON usuarios (ultimo_acceso DESC NULLS LAST);

-- Comentario descriptivo
COMMENT ON COLUMN usuarios.ultimo_acceso
  IS 'Fecha y hora del último login exitoso. Actualizado por auth.controller.login';
