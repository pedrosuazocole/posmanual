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
