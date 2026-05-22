/**
 * POSManual - DevSys Honduras
 * Controlador: Autenticación
 * Archivo: server/src/controllers/auth.controller.js
 */
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { pool } = require('../db');

/** POST /api/v1/auth/login */
exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son obligatorios' });
  }
  try {
    const { rows: [usuario] } = await pool.query(
      `SELECT u.*, r.nombre AS rol, r.permisos
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.username = $1 AND u.activo = TRUE`,
      [username.trim().toLowerCase()]
    );
    if (!usuario) {
      await bcrypt.hash('dummy', 10);
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) return res.status(401).json({ message: 'Contraseña incorrecta' });

    const payload = {
      id:       usuario.id,
      username: usuario.username,
      rol:      usuario.rol,
      permisos: usuario.permisos,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    return res.json({
      token,
      user: {
        id:              usuario.id,
        username:        usuario.username,
        nombre_completo: usuario.nombre_completo,
        rol:             usuario.rol,
        permisos:        usuario.permisos,
      },
    });

  } catch (err) {
    console.error('[auth.login]', err.message);
    return res.status(500).json({ message: 'Error interno al autenticar' });
  }
};

/** GET /api/v1/auth/me — valida token y devuelve perfil actualizado */
exports.me = async (req, res) => {
  try {
    const { rows: [u] } = await pool.query(
      `SELECT u.id, u.username, u.nombre_completo, r.nombre AS rol, r.permisos
       FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=$1 AND u.activo=TRUE`,
      [req.user.id]
    );
    if (!u) return res.status(401).json({ message: 'Usuario no encontrado' });
    return res.json(u);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener perfil' });
  }
};

/** POST /api/v1/auth/cambiar-password */
exports.cambiarPassword = async (req, res) => {
  const { password_actual, password_nuevo } = req.body;
  if (!password_actual || !password_nuevo) {
    return res.status(400).json({ message: 'Ambas contraseñas son obligatorias' });
  }
  if (password_nuevo.length < 8) {
    return res.status(400).json({ message: 'La contraseña nueva debe tener al menos 8 caracteres' });
  }
  try {
    const { rows: [u] } = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id=$1', [req.user.id]
    );
    const ok = await bcrypt.compare(password_actual, u.password_hash);
    if (!ok) return res.status(401).json({ message: 'La contraseña actual es incorrecta' });

    const nuevoHash = await bcrypt.hash(password_nuevo, 12);
    await pool.query(
      'UPDATE usuarios SET password_hash=$1, actualizado_en=NOW() WHERE id=$2',
      [nuevoHash, req.user.id]
    );
    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al cambiar contraseña' });
  }
};
