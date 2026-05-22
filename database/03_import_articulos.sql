-- ============================================================
-- POSManual - DevSys Honduras
-- Script de importación: articulo.xlsx → tabla articulos
-- 
-- LÓGICA:
--   usaexist = 1 → no_usar_existencia = FALSE (controla stock)
--   usaexist = 2 → no_usar_existencia = TRUE  (servicio/combo)
--   impuesto1: 15 → ISV 15%, 18 → ISV 18%, 0 → Exento
--   precio1   → precio_venta
--   precio2   → precio_especial (mayoreo)
-- ============================================================

-- Este script es generado por el endpoint POST /api/v1/articulos/importar
-- Se ejecuta dentro de una transacción atómica:

BEGIN;

-- PASO 1: Crear grupos faltantes automáticamente
-- (El importador compara columna "grupo" con grupos.codigo_origen)
INSERT INTO grupos (codigo_origen, nombre)
SELECT DISTINCT
    a.grupo_origen::INT,
    'Grupo ' || a.grupo_origen  -- Nombre provisional hasta que admin lo renombre
FROM (VALUES
    -- Aquí el backend Node.js inyecta los grupos únicos del archivo
    -- usando ON CONFLICT DO NOTHING para grupos ya existentes
    (NULL::TEXT)  -- placeholder
) AS a(grupo_origen)
WHERE a.grupo_origen IS NOT NULL
ON CONFLICT (codigo_origen) DO NOTHING;

-- PASO 2: Insertar/actualizar artículos (UPSERT por codigo)
-- El backend genera este INSERT dinámicamente desde el Excel parseado
/*
INSERT INTO articulos (
    grupo_id, codigo, nombre, nombre_corto, referencia, marca,
    precio_costo, precio_venta, precio_especial, impuesto_pct,
    stock_actual, stock_minimo, stock_maximo,
    no_usar_existencia, activo
)
SELECT
    g.id,
    a.codigo,
    a.nombre,
    NULLIF(TRIM(a.nombrecorto), ''),
    NULLIF(TRIM(a.referencia), ''),
    NULLIF(TRIM(a.marca), ''),
    a.costo,
    a.precio1,
    a.precio2,
    CASE a.impuesto1 WHEN 15 THEN 15 WHEN 18 THEN 18 ELSE 0 END,
    a.existencia,
    a.minimo,
    a.maximo,
    -- usaexist=2 → es servicio/combo sin stock
    CASE WHEN a.usaexist = 2 THEN TRUE ELSE FALSE END,
    CASE WHEN a.inactiva = 0 THEN TRUE ELSE FALSE END
FROM staging_articulos a
LEFT JOIN grupos g ON g.codigo_origen = a.grupo::INT
ON CONFLICT (codigo) DO UPDATE SET
    nombre         = EXCLUDED.nombre,
    nombre_corto   = EXCLUDED.nombre_corto,
    precio_costo   = EXCLUDED.precio_costo,
    precio_venta   = EXCLUDED.precio_venta,
    impuesto_pct   = EXCLUDED.impuesto_pct,
    no_usar_existencia = EXCLUDED.no_usar_existencia,
    actualizado_en = NOW();
*/

COMMIT;
