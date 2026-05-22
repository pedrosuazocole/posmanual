-- ============================================================
-- POSManual - DevSys Honduras
-- Queries para los 4 Reportes Principales
-- ============================================================

-- ============================================================
-- REPORTE 1: MASTER DE VENTAS
-- Parámetros: $1=fecha_inicio, $2=fecha_fin, $3=cajero_id (NULL=todos)
-- ============================================================
SELECT
    v.numero_factura                            AS "Factura #",
    TO_CHAR(v.creado_en, 'DD/MM/YYYY HH24:MI') AS "Fecha y Hora",
    u.nombre_completo                           AS "Cajero",
    v.cliente_nombre                            AS "Cliente",
    v.cliente_rtn                               AS "RTN Cliente",
    v.estado                                    AS "Estado",
    v.subtotal                                  AS "Sub Total",
    v.descuento_total                           AS "Descuentos",
    v.importe_exento                            AS "Exento",
    v.importe_gravado_15                        AS "Gravado 15%",
    v.isv_15                                    AS "ISV 15%",
    v.importe_gravado_18                        AS "Gravado 18%",
    v.isv_18                                    AS "ISV 18%",
    v.total                                     AS "Total",
    v.metodo_pago                               AS "Forma Pago",
    v.monto_recibido                            AS "Recibido",
    v.cambio                                    AS "Cambio"
FROM ventas v
JOIN usuarios u ON u.id = v.cajero_id
WHERE v.creado_en BETWEEN $1 AND $2
  AND ($3::UUID IS NULL OR v.cajero_id = $3)
ORDER BY v.creado_en DESC;

-- TOTALES del Master de Ventas
SELECT
    COUNT(*)                                            AS "Total Facturas",
    COUNT(*) FILTER (WHERE estado = 'COMPLETADA')       AS "Completadas",
    COUNT(*) FILTER (WHERE estado = 'ANULADA')          AS "Anuladas",
    SUM(total) FILTER (WHERE estado = 'COMPLETADA')     AS "Ventas Totales L.",
    SUM(isv_15 + isv_18) FILTER (WHERE estado = 'COMPLETADA') AS "ISV Total L.",
    SUM(descuento_total) FILTER (WHERE estado = 'COMPLETADA')  AS "Descuentos L."
FROM ventas
WHERE creado_en BETWEEN $1 AND $2
  AND ($3::UUID IS NULL OR cajero_id = $3);


-- ============================================================
-- REPORTE 2: CORTE DE CAJA (Shift Report)
-- Parámetro: $1=turno_id
-- ============================================================
SELECT
    -- Encabezado del turno
    t.id                                            AS "Turno #",
    u.nombre_completo                               AS "Cajero",
    TO_CHAR(t.abierto_en,  'DD/MM/YYYY HH24:MI')   AS "Apertura",
    TO_CHAR(t.cerrado_en,  'DD/MM/YYYY HH24:MI')   AS "Cierre",
    t.estado                                        AS "Estado",
    t.monto_inicial                                 AS "Fondo Inicial L.",

    -- Conteos
    COUNT(v.id) FILTER (WHERE v.estado='COMPLETADA') AS "# Ventas",
    COUNT(v.id) FILTER (WHERE v.estado='ANULADA')    AS "# Anulaciones",

    -- Montos
    COALESCE(SUM(v.total)
        FILTER (WHERE v.estado='COMPLETADA'), 0)     AS "Total Ventas L.",
    COALESCE(SUM(v.isv_15 + v.isv_18)
        FILTER (WHERE v.estado='COMPLETADA'), 0)     AS "ISV Recaudado L.",
    COALESCE(SUM(v.descuento_total)
        FILTER (WHERE v.estado='COMPLETADA'), 0)     AS "Descuentos L.",

    -- Por método de pago
    COALESCE(SUM(v.total)
        FILTER (WHERE v.estado='COMPLETADA'
            AND v.metodo_pago='EFECTIVO'), 0)        AS "Efectivo L.",
    COALESCE(SUM(v.total)
        FILTER (WHERE v.estado='COMPLETADA'
            AND v.metodo_pago IN ('TARJETA_CREDITO','TARJETA_DEBITO')), 0)
                                                     AS "Tarjetas L.",
    COALESCE(SUM(v.total)
        FILTER (WHERE v.estado='COMPLETADA'
            AND v.metodo_pago='TRANSFERENCIA'), 0)   AS "Transferencias L.",

    -- Cuadre de caja
    t.monto_final_declarado                         AS "Declarado por Cajero L.",
    t.monto_final_sistema                           AS "Sistema L.",
    t.diferencia                                    AS "Diferencia L.",
    t.observaciones                                 AS "Observaciones"
FROM turnos t
JOIN usuarios u ON u.id = t.usuario_id
LEFT JOIN ventas v ON v.turno_id = t.id
WHERE t.id = $1
GROUP BY t.id, u.nombre_completo;

-- Detalle por hora (distribución de ventas en el turno)
SELECT
    DATE_PART('hour', v.creado_en)              AS "Hora",
    COUNT(*)                                     AS "Facturas",
    SUM(v.total)                                 AS "Total L."
FROM ventas v
WHERE v.turno_id = $1 AND v.estado = 'COMPLETADA'
GROUP BY DATE_PART('hour', v.creado_en)
ORDER BY 1;


-- ============================================================
-- REPORTE 3: VENTAS POR GRUPO
-- Parámetros: $1=fecha_inicio, $2=fecha_fin
-- ============================================================
SELECT
    COALESCE(g.nombre, 'Sin Grupo')         AS "Grupo",
    COUNT(DISTINCT v.id)                    AS "# Facturas",
    SUM(dv.cantidad)                        AS "Unidades Vendidas",
    MIN(dv.precio_unitario)                 AS "Precio Mín L.",
    MAX(dv.precio_unitario)                 AS "Precio Máx L.",
    ROUND(AVG(dv.precio_unitario), 2)       AS "Precio Prom L.",
    SUM(dv.subtotal)                        AS "Total Ventas L.",
    SUM(dv.subtotal * dv.impuesto_pct/100)  AS "ISV Estimado L.",
    ROUND(
        SUM(dv.subtotal) * 100.0 /
        NULLIF(SUM(SUM(dv.subtotal)) OVER (), 0)
    , 2)                                    AS "% Participación"
FROM detalle_ventas dv
JOIN ventas v    ON v.id = dv.venta_id AND v.estado = 'COMPLETADA'
               AND v.creado_en BETWEEN $1 AND $2
JOIN articulos a ON a.id = dv.articulo_id
LEFT JOIN grupos g ON g.id = a.grupo_id
GROUP BY g.nombre
ORDER BY SUM(dv.subtotal) DESC;


-- ============================================================
-- REPORTE 4: VENTAS POR ARTÍCULO
-- Parámetros: $1=fecha_inicio, $2=fecha_fin, $3=grupo_id (NULL=todos)
-- ============================================================
SELECT
    a.codigo                                AS "Código",
    a.nombre                                AS "Artículo",
    COALESCE(g.nombre, 'Sin Grupo')         AS "Grupo",
    COUNT(DISTINCT v.id)                    AS "# Ventas",
    SUM(dv.cantidad)                        AS "Cantidad Total",
    ROUND(AVG(dv.precio_unitario), 2)       AS "Precio Prom L.",
    SUM(dv.descuento_unit * dv.cantidad)    AS "Descuentos L.",
    SUM(dv.subtotal)                        AS "Total Ventas L.",
    -- Rentabilidad estimada
    ROUND(
        (SUM(dv.subtotal) - SUM(a.precio_costo * dv.cantidad))
        * 100.0 / NULLIF(SUM(dv.subtotal), 0)
    , 2)                                    AS "% Margen"
FROM detalle_ventas dv
JOIN ventas v    ON v.id = dv.venta_id AND v.estado = 'COMPLETADA'
               AND v.creado_en BETWEEN $1 AND $2
JOIN articulos a ON a.id = dv.articulo_id
LEFT JOIN grupos g ON g.id = a.grupo_id
WHERE ($3::INT IS NULL OR a.grupo_id = $3)
GROUP BY a.codigo, a.nombre, g.nombre
ORDER BY SUM(dv.subtotal) DESC;
