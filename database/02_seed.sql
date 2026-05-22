-- ============================================================
-- POSManual - DevSys Honduras
-- Seed: Roles, Usuarios iniciales y Grupos del catálogo
-- ============================================================

-- ============================================================
-- 1. ROLES con permisos granulares
-- ============================================================
INSERT INTO roles (nombre, descripcion, permisos) VALUES
(
    'ADMINISTRADOR',
    'Acceso total al sistema. Configura usuarios, parámetros y tiene visibilidad de todos los módulos.',
    '{
        "pos":          ["leer","crear","editar","eliminar","anular"],
        "articulos":    ["leer","crear","editar","eliminar","importar","exportar"],
        "grupos":       ["leer","crear","editar","eliminar"],
        "inventario":   ["leer","crear","editar","eliminar"],
        "turnos":       ["leer","crear","cerrar","ver_todos"],
        "reportes":     ["leer","exportar"],
        "usuarios":     ["leer","crear","editar","eliminar"],
        "proveedores":  ["leer","crear","editar","eliminar"],
        "cuentas":      ["leer","crear","editar","eliminar"],
        "bancos":       ["leer","crear","editar","eliminar"]
    }'
),
(
    'SUPERVISOR',
    'Acceso a reportes, gestión de inventario y autorización de anulaciones.',
    '{
        "pos":          ["leer","crear","anular"],
        "articulos":    ["leer","crear","editar","importar","exportar"],
        "grupos":       ["leer","crear","editar"],
        "inventario":   ["leer","crear","editar"],
        "turnos":       ["leer","cerrar","ver_todos"],
        "reportes":     ["leer","exportar"],
        "usuarios":     ["leer"],
        "proveedores":  ["leer","crear","editar"],
        "cuentas":      ["leer","crear","editar"],
        "bancos":       ["leer"]
    }'
),
(
    'CAJERO',
    'Acceso restringido al Punto de Venta y su propio corte de caja.',
    '{
        "pos":          ["leer","crear"],
        "articulos":    ["leer"],
        "grupos":       ["leer"],
        "inventario":   [],
        "turnos":       ["leer","crear","cerrar_propio"],
        "reportes":     ["leer_propio"],
        "usuarios":     [],
        "proveedores":  [],
        "cuentas":      [],
        "bancos":       []
    }'
);

-- ============================================================
-- 2. USUARIOS
-- Contraseñas en bcrypt (rounds=12)
-- Admin:   Admin2024!
-- Cajeros: Cajero2024! (misma clave inicial, deben cambiarla)
-- ============================================================

-- Función helper para obtener rol_id
-- (Se usa DO block para compatibilidad con versiones de PG)
DO $$
DECLARE
    id_admin  SMALLINT;
    id_cajero SMALLINT;
BEGIN
    SELECT id INTO id_admin  FROM roles WHERE nombre = 'ADMINISTRADOR';
    SELECT id INTO id_cajero FROM roles WHERE nombre = 'CAJERO';

    -- ── ADMINISTRADOR ──────────────────────────────────────
    INSERT INTO usuarios (rol_id, nombre_completo, username, email, password_hash) VALUES
    (
        id_admin,
        'Administrador del Sistema',
        'admin',
        'admin@buenosaireshonduras.hn',
        -- Hash bcrypt de: Admin2024!
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TdxMQi1xYdM5JJe1v1Xk2mE5JxKi'
    );

    -- ── CAJEROS (6 usuarios) ────────────────────────────────
    INSERT INTO usuarios (rol_id, nombre_completo, username, email, password_hash) VALUES
    (
        id_cajero,
        'María Pérez García',
        'cajero01',
        'cajero01@buenosaireshonduras.hn',
        -- Hash bcrypt de: Cajero2024!
        '$2b$12$N9qAB8SymyGF3kXtJRk1pOp5LqJkM3i5Y7xXa1n2ZkE7aK9vDlsMa'
    ),
    (
        id_cajero,
        'Carlos Hernández López',
        'cajero02',
        'cajero02@buenosaireshonduras.hn',
        '$2b$12$N9qAB8SymyGF3kXtJRk1pOp5LqJkM3i5Y7xXa1n2ZkE7aK9vDlsMa'
    ),
    (
        id_cajero,
        'Ana Martínez Rivera',
        'cajero03',
        'cajero03@buenosaireshonduras.hn',
        '$2b$12$N9qAB8SymyGF3kXtJRk1pOp5LqJkM3i5Y7xXa1n2ZkE7aK9vDlsMa'
    ),
    (
        id_cajero,
        'José Rodríguez Mejía',
        'cajero04',
        'cajero04@buenosaireshonduras.hn',
        '$2b$12$N9qAB8SymyGF3kXtJRk1pOp5LqJkM3i5Y7xXa1n2ZkE7aK9vDlsMa'
    ),
    (
        id_cajero,
        'Luisa Castro Reyes',
        'cajero05',
        'cajero05@buenosaireshonduras.hn',
        '$2b$12$N9qAB8SymyGF3kXtJRk1pOp5LqJkM3i5Y7xXa1n2ZkE7aK9vDlsMa'
    ),
    (
        id_cajero,
        'Roberto Flores Aguilar',
        'cajero06',
        'cajero06@buenosaireshonduras.hn',
        '$2b$12$N9qAB8SymyGF3kXtJRk1pOp5LqJkM3i5Y7xXa1n2ZkE7aK9vDlsMa'
    );

    RAISE NOTICE '✅ Usuarios insertados correctamente.';
    RAISE NOTICE '   Admin:    admin / Admin2024!';
    RAISE NOTICE '   Cajeros:  cajero01–cajero06 / Cajero2024!';
END;
$$;

-- ============================================================
-- 3. GRUPOS — Mapeados desde IDs numéricos del Excel
-- (IDs 1–22, 50 detectados en articulo.xlsx)
-- ============================================================
INSERT INTO grupos (codigo_origen, nombre) VALUES
( 1,  'Insumos Generales'),
( 2,  'Panadería y Repostería'),
( 3,  'Bebidas y Licores'),
( 4,  'Bebidas Gaseosas y Refrescos'),
( 5,  'Snacks y Golosinas'),
( 6,  'Abarrotes y Despensa'),
( 7,  'Frituras y Botanas'),
( 8,  'Artículos Desechables'),
( 9,  'Limpieza y Hogar'),
(10,  'Cuidado Personal y Farmacia'),
(11,  'Lácteos y Refrigerados'),
(12,  'Carnes y Embutidos'),
(13,  'Verduras y Frutas'),
(14,  'Cocina y Preparados'),
(15,  'Congelados'),
(16,  'Cigarrillos y Tabacos'),
(17,  'Confitería'),
(21,  'Combustibles y Lubricantes'),
(22,  'Misceláneos'),
(50,  'Servicios y Otros');

-- ============================================================
-- 4. BANCO INICIAL (cuenta de caja registradora)
-- ============================================================
INSERT INTO bancos (nombre, numero_cuenta, saldo_inicial) VALUES
('Caja Principal Buenos Aires', 'CAJA-001', 0.00),
('Banco Atlántida',             'AT-0001-XXXX', 0.00),
('BAC Honduras',                'BAC-0001-XXXX', 0.00);

RAISE NOTICE '✅ Seed completado exitosamente.';
RAISE NOTICE '   Roles: 3 | Usuarios: 7 | Grupos: 20 | Bancos: 3';
