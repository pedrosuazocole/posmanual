/**
 * POSManual - DevSys Honduras
 * Middleware: Verificación JWT
 * Archivo: server/src/middlewares/auth.js
 */
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token de autenticación requerido' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};
