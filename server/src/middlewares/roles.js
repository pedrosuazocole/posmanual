/**
 * POSManual - DevSys Honduras
 * Middleware: Guard de roles
 * Archivo: server/src/middlewares/roles.js
 */
module.exports = function roles(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        message: `Acceso denegado. Se requiere: ${rolesPermitidos.join(', ')}`,
        tuRol: req.user.rol,
      });
    }
    next();
  };
};
