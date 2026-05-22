-- ============================================================
-- POSManual - DevSys Honduras
-- Esquema de Base de Datos PostgreSQL v1.0
-- Empresa: Inversiones Buenos Aires S.A.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TIPOS ENUMERADOS
-- ============================================================
CREATE TYPE rol_tipo        AS ENUM ('ADMINISTRADOR', 'SUPERVISOR', 'CAJERO');
CREATE TYPE turno_estado    AS ENUM ('ABIERTO', 'CERRADO');
CREATE TYPE venta_estado    AS ENUM ('COMPLETADA', 'ANULADA', 'PENDIENTE');
CREATE TYPE mov_tipo        AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO');
CREATE TYPE pago_metodo     AS ENUM ('EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'TRANSFERENCIA', 'CREDITO');
CREATE TYPE cuenta_tipo     AS ENUM ('COBRAR', 'PAGAR');
CREATE TYPE cuenta_estado   AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO', 'VENCIDO');
CREATE TYPE tx_tipo         AS ENUM ('DEPOSITO', 'RETIRO', 'TRANSFERENCIA', 'PAGO_PROVEEDOR', 'COBRO_CLIENTE');

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE roles (
    id          SMALLINT    PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    nombre      rol_tipo    NOT NULL UNIQUE,
    descripcion TEXT,
    -- Permisos granulares en JSONB: { "modulo": ["leer","crear","editar","eliminar"] }
    permisos    JSONB       NOT NULL DEFAULT '{}',
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USUARIOS
-- ============================================================
CREATE TABLE usuarios (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    rol_id          SMALLINT    NOT NULL REFERENCES roles(id),
    nombre_completo VARCHAR(150) NOT NULL,
    username        VARCHAR(50) NOT NULL UNIQUE,
    email           VARCHAR(120) UNIQUE,
    password_hash   TEXT        NOT NULL,
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_rol      ON usuarios(rol_id);

-- ============================================================
-- GRUPOS / CATEGORÍAS
-- Importados desde columna "grupo" del Excel (IDs numéricos)
-- Se asigna nombre descriptivo durante la importación
-- ============================================================
CREATE TABLE grupos (
    id          SERIAL      PRIMARY KEY,
    -- codigo_origen: ID numérico del sistema legado (1,2,3...50)
    codigo_origen INT        UNIQUE,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo      BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ARTÍCULOS
-- Mapeado desde articulo.xlsx (2000 registros)
-- ============================================================
CREATE TABLE articulos (
    id              SERIAL       PRIMARY KEY,
    grupo_id        INT          REFERENCES grupos(id) ON DELETE SET NULL,
    -- codigo: campo "codigo" del Excel (puede ser barcode o interno)
    codigo          VARCHAR(100) NOT NULL UNIQUE,
    nombre          VARCHAR(200) NOT NULL,
    nombre_corto    VARCHAR(100),
    referencia      VARCHAR(100),
    marca           VARCHAR(100),
    unidad_medida   VARCHAR(30)  NOT NULL DEFAULT 'UNIDAD',
    precio_costo    NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- precio1 = precio venta principal
    precio_venta    NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- precio2 = precio especial/mayoreo
    precio_especial NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- impuesto1 del Excel: 0, 15 o 18
    impuesto_pct    NUMERIC(5,2)  NOT NULL DEFAULT 15.00,
    stock_actual    NUMERIC(12,3) NOT NULL DEFAULT 0,
    stock_minimo    NUMERIC(12,3) NOT NULL DEFAULT 0,
    stock_maximo    NUMERIC(12,3) NOT NULL DEFAULT 0,
    -- CRÍTICO: usaexist=1→TRUE (controla stock), usaexist=2→FALSE (servicios/combos)
    no_usar_existencia BOOLEAN   NOT NULL DEFAULT FALSE,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_articulos_codigo   ON articulos(codigo);
CREATE INDEX idx_articulos_grupo    ON articulos(grupo_id);
CREATE INDEX idx_articulos_nombre   ON articulos USING gin(to_tsvector('spanish', nombre));

-- ============================================================
-- TURNOS / CORTES DE CAJA
-- ============================================================
CREATE TABLE turnos (
    id              SERIAL      PRIMARY KEY,
    usuario_id      UUID        NOT NULL REFERENCES usuarios(id),
    estado          turno_estado NOT NULL DEFAULT 'ABIERTO',
    -- Monto con el que abre caja
    monto_inicial   NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Calculado al cerrar
    monto_final_declarado  NUMERIC(12,2),
    monto_final_sistema    NUMERIC(12,2),
    diferencia             NUMERIC(12,2) GENERATED ALWAYS AS
                           (monto_final_declarado - monto_final_sistema) STORED,
    total_ventas    NUMERIC(12,2),
    total_anuladas  NUMERIC(12,2),
    observaciones   TEXT,
    abierto_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_en      TIMESTAMPTZ,
    -- Supervisor que autoriza el cierre
    cerrado_por     UUID        REFERENCES usuarios(id)
);
CREATE INDEX idx_turnos_usuario ON turnos(usuario_id);
CREATE INDEX idx_turnos_estado  ON turnos(estado);

-- ============================================================
-- VENTAS (Facturas Proforma)
-- Basado en ticket Inversiones Buenos Aires S.A.
-- ============================================================
CREATE TABLE ventas (
    id              SERIAL       PRIMARY KEY,
    turno_id        INT          NOT NULL REFERENCES turnos(id),
    cajero_id       UUID         NOT NULL REFERENCES usuarios(id),
    -- Número de factura secuencial por turno
    numero_factura  VARCHAR(30)  NOT NULL UNIQUE,
    -- Datos del cliente (Consumidor Final por defecto)
    cliente_nombre  VARCHAR(150) NOT NULL DEFAULT 'CONSUMIDOR FINAL',
    cliente_rtn     VARCHAR(20)  NOT NULL DEFAULT '0000000',
    estado          venta_estado NOT NULL DEFAULT 'COMPLETADA',
    -- Referencia al supervisor que autorizó anulación
    anulado_por     UUID         REFERENCES usuarios(id),
    motivo_anulacion TEXT,
    -- Montos según ticket Buenos Aires
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    descuento_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    importe_exento  NUMERIC(12,2) NOT NULL DEFAULT 0,
    importe_gravado_15 NUMERIC(12,2) NOT NULL DEFAULT 0,
    importe_gravado_18 NUMERIC(12,2) NOT NULL DEFAULT 0,
    isv_15          NUMERIC(12,2) NOT NULL DEFAULT 0,
    isv_18          NUMERIC(12,2) NOT NULL DEFAULT 0,
    total           NUMERIC(12,2) NOT NULL DEFAULT 0,
    metodo_pago     pago_metodo  NOT NULL DEFAULT 'EFECTIVO',
    monto_recibido  NUMERIC(12,2),
    cambio          NUMERIC(12,2) GENERATED ALWAYS AS
                    (COALESCE(monto_recibido, 0) - total) STORED,
    observaciones   TEXT,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ventas_turno    ON ventas(turno_id);
CREATE INDEX idx_ventas_cajero   ON ventas(cajero_id);
CREATE INDEX idx_ventas_estado   ON ventas(estado);
CREATE INDEX idx_ventas_fecha    ON ventas(creado_en);
CREATE INDEX idx_ventas_factura  ON ventas(numero_factura);

-- ============================================================
-- DETALLE DE VENTAS
-- ============================================================
CREATE TABLE detalle_ventas (
    id              SERIAL       PRIMARY KEY,
    venta_id        INT          NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    articulo_id     INT          NOT NULL REFERENCES articulos(id),
    -- Snapshot del precio al momento de venta (no debe cambiar con ediciones)
    cantidad        NUMERIC(12,3) NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    descuento_unit  NUMERIC(12,2) NOT NULL DEFAULT 0,
    impuesto_pct    NUMERIC(5,2)  NOT NULL DEFAULT 15,
    -- precio_unitario - descuento_unit
    precio_neto     NUMERIC(12,2) GENERATED ALWAYS AS
                    (precio_unitario - descuento_unit) STORED,
    subtotal        NUMERIC(12,2) GENERATED ALWAYS AS
                    ((precio_unitario - descuento_unit) * cantidad) STORED
);
CREATE INDEX idx_detalle_venta    ON detalle_ventas(venta_id);
CREATE INDEX idx_detalle_articulo ON detalle_ventas(articulo_id);

-- ============================================================
-- INVENTARIO — MOVIMIENTOS
-- ============================================================
CREATE TABLE movimientos_inventario (
    id              SERIAL       PRIMARY KEY,
    articulo_id     INT          NOT NULL REFERENCES articulos(id),
    tipo            mov_tipo     NOT NULL,
    cantidad        NUMERIC(12,3) NOT NULL,
    costo_unitario  NUMERIC(12,2),
    -- Stock antes y después del movimiento (auditoría)
    stock_anterior  NUMERIC(12,3) NOT NULL,
    stock_nuevo     NUMERIC(12,3) NOT NULL,
    -- Referencia cruzada: puede venir de una venta, orden de compra, etc.
    referencia_tipo VARCHAR(30),  -- 'VENTA', 'COMPRA', 'AJUSTE_MANUAL'
    referencia_id   INT,
    proveedor_id    INT,          -- FK se agrega abajo
    usuario_id      UUID         NOT NULL REFERENCES usuarios(id),
    observaciones   TEXT,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_movinv_articulo ON movimientos_inventario(articulo_id);
CREATE INDEX idx_movinv_fecha    ON movimientos_inventario(creado_en);

-- ============================================================
-- PROVEEDORES
-- ============================================================
CREATE TABLE proveedores (
    id          SERIAL       PRIMARY KEY,
    nombre      VARCHAR(200) NOT NULL,
    rtn         VARCHAR(20)  UNIQUE,
    contacto    VARCHAR(150),
    telefono    VARCHAR(20),
    email       VARCHAR(120),
    direccion   TEXT,
    activo      BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- FK diferida para evitar dependencia circular
ALTER TABLE movimientos_inventario
    ADD CONSTRAINT fk_movinv_proveedor
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id);

-- ============================================================
-- CUENTAS POR COBRAR / PAGAR
-- ============================================================
CREATE TABLE cuentas (
    id              SERIAL       PRIMARY KEY,
    tipo            cuenta_tipo  NOT NULL,
    -- Tercero: cliente (cobrar) o proveedor (pagar)
    tercero_nombre  VARCHAR(200) NOT NULL,
    tercero_rtn     VARCHAR(20),
    proveedor_id    INT          REFERENCES proveedores(id),
    descripcion     TEXT,
    monto_total     NUMERIC(12,2) NOT NULL,
    monto_pagado    NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo           NUMERIC(12,2) GENERATED ALWAYS AS
                    (monto_total - monto_pagado) STORED,
    estado          cuenta_estado NOT NULL DEFAULT 'PENDIENTE',
    fecha_emision   DATE         NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    -- Referencia a venta (si es C×C) o a compra
    referencia_venta_id INT      REFERENCES ventas(id),
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cuentas_tipo   ON cuentas(tipo);
CREATE INDEX idx_cuentas_estado ON cuentas(estado);

CREATE TABLE pagos_cuentas (
    id          SERIAL       PRIMARY KEY,
    cuenta_id   INT          NOT NULL REFERENCES cuentas(id),
    monto       NUMERIC(12,2) NOT NULL,
    metodo_pago pago_metodo  NOT NULL DEFAULT 'EFECTIVO',
    usuario_id  UUID         NOT NULL REFERENCES usuarios(id),
    observaciones TEXT,
    pagado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BANCOS
-- ============================================================
CREATE TABLE bancos (
    id          SERIAL       PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    numero_cuenta VARCHAR(30),
    saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
    activo      BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE transacciones_bancarias (
    id          SERIAL       PRIMARY KEY,
    banco_id    INT          NOT NULL REFERENCES bancos(id),
    tipo        tx_tipo      NOT NULL,
    monto       NUMERIC(12,2) NOT NULL,
    descripcion TEXT,
    referencia  VARCHAR(100),
    usuario_id  UUID         NOT NULL REFERENCES usuarios(id),
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VISTAS DE SOPORTE PARA REPORTES
-- ============================================================

-- Vista: Resumen de ventas por turno (base del corte de caja)
CREATE VIEW v_resumen_turno AS
SELECT
    t.id            AS turno_id,
    u.nombre_completo AS cajero,
    t.abierto_en,
    t.cerrado_en,
    t.estado,
    t.monto_inicial,
    COUNT(v.id)     FILTER (WHERE v.estado = 'COMPLETADA') AS total_transacciones,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'COMPLETADA'), 0) AS ventas_efectivas,
    COALESCE(SUM(v.total) FILTER (WHERE v.estado = 'ANULADA'), 0)    AS ventas_anuladas,
    COUNT(v.id)     FILTER (WHERE v.estado = 'ANULADA')              AS cant_anuladas
FROM turnos t
JOIN usuarios u ON u.id = t.usuario_id
LEFT JOIN ventas v ON v.turno_id = t.id
GROUP BY t.id, u.nombre_completo;

-- Vista: Ventas por grupo (para reporte gerencial)
CREATE VIEW v_ventas_por_grupo AS
SELECT
    g.nombre            AS grupo,
    DATE(v.creado_en)   AS fecha,
    COUNT(DISTINCT v.id) AS num_facturas,
    SUM(dv.cantidad)    AS unidades_vendidas,
    SUM(dv.subtotal)    AS total_ventas,
    SUM(dv.subtotal * dv.impuesto_pct / 100) AS isv_generado
FROM detalle_ventas dv
JOIN ventas v     ON v.id = dv.venta_id  AND v.estado = 'COMPLETADA'
JOIN articulos a  ON a.id = dv.articulo_id
LEFT JOIN grupos g ON g.id = a.grupo_id
GROUP BY g.nombre, DATE(v.creado_en);

-- Vista: Ventas por artículo (ranking de productos)
CREATE VIEW v_ventas_por_articulo AS
SELECT
    a.codigo,
    a.nombre,
    g.nombre            AS grupo,
    SUM(dv.cantidad)    AS unidades_vendidas,
    ROUND(AVG(dv.precio_unitario), 2) AS precio_promedio,
    SUM(dv.subtotal)    AS total_ventas,
    COUNT(DISTINCT v.id) AS veces_facturado
FROM detalle_ventas dv
JOIN ventas v    ON v.id = dv.venta_id AND v.estado = 'COMPLETADA'
JOIN articulos a ON a.id = dv.articulo_id
LEFT JOIN grupos g ON g.id = a.grupo_id
GROUP BY a.codigo, a.nombre, g.nombre;
