/**
 * POSManual - DevSys Honduras
 * Controlador + Rutas: Gestión de Usuarios
 * Archivo: server/src/controllers/usuarios.controller.js
 *          server/src/routes/usuarios.routes.js
 *
 * Endpoints:
 *  GET  /usuarios              → listar (Admin)
 *  GET  /usuarios/:id          → detalle
 *  POST /usuarios              → crear (Admin)
 *  PUT  /usuarios/:id          → editar datos / activar-desactivar (Admin)
 *  POST /usuarios/:id/reset-password → reset a contraseña temporal (Admin)
 *
 * Registra ultimo_acceso automáticamente en auth.controller al login.
 */

/* ═══════════════════════════════════════════════════════
   RUTAS
   Archivo: server/src/routes/usuarios.routes.js
═══════════════════════════════════════════════════════ */
const router = require('express').Router();
const auth   = require('../middlewares/auth');
const roles  = require('../middlewares/roles');
const ctrl   = require('../controllers/usuarios.controller');

// Solo ADMINISTRADOR puede gestionar usuarios
router.get('/',    auth, roles(['ADMINISTRADOR']),       ctrl.listar);
router.get('/:id', auth, roles(['ADMINISTRADOR']),       ctrl.obtener);
router.post('/',   auth, roles(['ADMINISTRADOR']),       ctrl.crear);
router.put('/:id', auth, roles(['ADMINISTRADOR']),       ctrl.actualizar);
router.post('/:id/reset-password', auth, roles(['ADMINISTRADOR']), ctrl.resetPassword);

module.exports = router;


/* ═══════════════════════════════════════════════════════
   CONTROLADOR
   Archivo: server/src/controllers/usuarios.controller.js
═══════════════════════════════════════════════════════ */
const { pool } = require('../db');
const bcrypt   = require('bcrypt');
const crypto   = require('crypto');
const { z }    = require('zod');

// Esquema de validación
const UsuarioSchema = z.object({
  nombre_completo: z.string().min(3).max(150),
  username:        z.string().min(3).max(50).regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guión bajo'),
  email:           z.string().email().optional().nullable(),
  password:        z.string().min(8).optional(),
  rol:             z.enum(['ADMINISTRADOR','SUPERVISOR','CAJERO']),
  activo:          z.boolean().optional().default(true),
});

/* ── GET /usuarios ─────────────────────────────────── */
exports.listar = async (req, res) => {
  const { q, rol, activo } = req.query;
  const params = [];
  const wheres = [];

  if (q) {
    wheres.push(`(u.nombre_completo ILIKE $${params.push('%'+q+'%')} OR u.username ILIKE $${params.push('%'+q+'%')})`);
  }
  if (rol)    wheres.push(`r.nombre = $${params.push(rol)}`);
  if (activo === 'true')  wheres.push('u.activo = TRUE');
  if (activo === 'false') wheres.push('u.activo = FALSE');

  const where = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre_completo, u.username, u.email, u.activo,
              u.creado_en, u.actualizado_en, u.ultimo_acceso,
              r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       ${where}
       ORDER BY
         CASE r.nombre WHEN 'ADMINISTRADOR' THEN 1 WHEN 'SUPERVISOR' THEN 2 ELSE 3 END,
         u.nombre_completo`,
      params
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error al listar usuarios' });
  }
};

/* ── GET /usuarios/:id ─────────────────────────────── */
exports.obtener = async (req, res) => {
  try {
    const { rows: [u] } = await pool.query(
      `SELECT u.id, u.nombre_completo, u.username, u.email, u.activo,
              u.creado_en, u.ultimo_acceso, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=$1`,
      [req.params.id]
    );
    if (!u) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json(u);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener usuario' });
  }
};

/* ── POST /usuarios ────────────────────────────────── */
exports.crear = async (req, res) => {
  const parsed = UsuarioSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message:'Datos inválidos', errors: parsed.error.flatten() });
  }
  if (!parsed.data.password) {
    return res.status(400).json({ message:'La contraseña es obligatoria al crear un usuario' });
  }

  const { nombre_completo, username, email, password, rol } = parsed.data;
  try {
    // Verificar username único
    const { rows: [exist] } = await pool.query(
      'SELECT id FROM usuarios WHERE username=$1', [username]
    );
    if (exist) return res.status(409).json({ message: `El usuario "${username}" ya existe` });

    // Obtener rol_id
    const { rows: [rolRow] } = await pool.query('SELECT id FROM roles WHERE nombre=$1', [rol]);
    if (!rolRow) return res.status(400).json({ message: 'Rol inválido' });

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows: [u] } = await pool.query(
      `INSERT INTO usuarios (rol_id, nombre_completo, username, email, password_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre_completo, username, email, activo, creado_en`,
      [rolRow.id, nombre_completo.trim(), username, email || null, passwordHash]
    );
    return res.status(201).json({ ...u, rol });
  } catch (err) {
    console.error('[usuarios.crear]', err.message);
    return res.status(500).json({ message: 'Error al crear usuario' });
  }
};

/* ── PUT /usuarios/:id ─────────────────────────────── */
exports.actualizar = async (req, res) => {
  const id   = req.params.id;
  const body = req.body;

  // No permitir que el admin se desactive a sí mismo
  if (body.activo === false && id === req.user.id) {
    return res.status(400).json({ message: 'No podés desactivar tu propio usuario' });
  }

  try {
    const updates = [];
    const params  = [];

    if (body.nombre_completo) { params.push(body.nombre_completo.trim()); updates.push(`nombre_completo=$${params.length}`); }
    if (body.email !== undefined) { params.push(body.email || null); updates.push(`email=$${params.length}`); }
    if (body.activo !== undefined) { params.push(body.activo); updates.push(`activo=$${params.length}`); }

    // Cambiar rol
    if (body.rol) {
      const { rows: [r] } = await pool.query('SELECT id FROM roles WHERE nombre=$1', [body.rol]);
      if (!r) return res.status(400).json({ message: 'Rol inválido' });
      params.push(r.id); updates.push(`rol_id=$${params.length}`);
    }

    // Cambiar contraseña (si se envía)
    if (body.password) {
      if (body.password.length < 8) return res.status(400).json({ message:'Mínimo 8 caracteres' });
      const hash = await bcrypt.hash(body.password, 12);
      params.push(hash); updates.push(`password_hash=$${params.length}`);
    }

    if (!updates.length) return res.status(400).json({ message: 'Nada que actualizar' });

    params.push(id);
    const { rows: [u] } = await pool.query(
      `UPDATE usuarios SET ${updates.join(',')},actualizado_en=NOW() WHERE id=$${params.length} RETURNING id, nombre_completo, username, email, activo`,
      params
    );
    if (!u) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Recuperar rol actualizado
    const { rows: [rolRow] } = await pool.query(
      'SELECT r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=$1', [id]
    );
    return res.json({ ...u, rol: rolRow?.rol });
  } catch (err) {
    console.error('[usuarios.actualizar]', err.message);
    return res.status(500).json({ message: 'Error al actualizar usuario' });
  }
};

/* ── POST /usuarios/:id/reset-password ─────────────── */
exports.resetPassword = async (req, res) => {
  const { rows: [u] } = await pool.query(
    'SELECT id, username, nombre_completo FROM usuarios WHERE id=$1 AND activo=TRUE',
    [req.params.id]
  );
  if (!u) return res.status(404).json({ message: 'Usuario no encontrado o inactivo' });

  // No permitir resetear la contraseña del propio admin en sesión por esta vía
  if (u.id === req.user.id) {
    return res.status(400).json({ message: 'Usá "Cambiar contraseña" para modificar tu propia clave' });
  }

  // Generar contraseña temporal: "Reset" + 6 dígitos aleatorios
  const temporal = 'Reset' + crypto.randomInt(100000, 999999).toString();
  const hash     = await bcrypt.hash(temporal, 12);

  await pool.query(
    'UPDATE usuarios SET password_hash=$1, actualizado_en=NOW() WHERE id=$2',
    [hash, u.id]
  );

  console.log(`[reset-password] "${u.username}" → contraseña temporal generada por ${req.user.username}`);

  return res.json({
    message:           `Contraseña de "${u.username}" reseteada correctamente`,
    password_temporal: temporal,
    // En producción enviar por email en vez de devolver en la respuesta
    // y eliminar este campo de la respuesta.
  });
};

/* ─────────────────────────────────────────────────────────────
   PARCHE en auth.controller.js
   Agregar al final de exports.login, después de generar el token:

   await pool.query(
     'UPDATE usuarios SET ultimo_acceso=NOW() WHERE id=$1',
     [usuario.id]
   );

   Esto registra la fecha/hora de cada login para mostrarla en la tabla.
───────────────────────────────────────────────────────────── */
