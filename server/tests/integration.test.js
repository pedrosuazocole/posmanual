/**
 * POSManual - DevSys Honduras
 * Suite de pruebas de integración — Backend
 * Archivo: server/tests/integration.test.js
 *
 * Corre con: npm test
 * Requiere: jest + supertest
 *
 * npm install --save-dev jest supertest
 *
 * Añadir en package.json:
 *   "jest": { "testEnvironment": "node" },
 *   "scripts": { "test": "jest --runInBand --detectOpenHandles" }
 */
const request = require('supertest');
const app     = require('../src/index');
const { pool } = require('../src/db');

let tokenAdmin, tokenCajero, tokenSupervisor;
let turnoId, ventaId, articuloId, cuentaId, bancoId;

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════
const api  = (method, url) => request(app)[method](url);
const auth = (req, token)  => req.set('Authorization', `Bearer ${token}`);
const post = (url, body, token) =>
  auth(api('post', url).send(body).set('Content-Type','application/json'), token);
const get  = (url, token) =>
  auth(api('get', url), token);
const put  = (url, body, token) =>
  auth(api('put', url).send(body).set('Content-Type','application/json'), token);

// ════════════════════════════════════════════════════════════
// SETUP / TEARDOWN
// ════════════════════════════════════════════════════════════
afterAll(async () => {
  await pool.end();
});

// ════════════════════════════════════════════════════════════
// 1. AUTENTICACIÓN
// ════════════════════════════════════════════════════════════
describe('Auth — Login y JWT', () => {

  test('POST /auth/login — admin correcto → devuelve token', async () => {
    const res = await post('/api/v1/auth/login', {
      username: 'admin', password: 'Admin2024!'
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.rol).toBe('ADMINISTRADOR');
    tokenAdmin = res.body.token;
  });

  test('POST /auth/login — cajero01 correcto → devuelve token', async () => {
    const res = await post('/api/v1/auth/login', {
      username: 'cajero01', password: 'Cajero2024!'
    });
    expect(res.status).toBe(200);
    expect(res.body.user.rol).toBe('CAJERO');
    tokenCajero = res.body.token;
  });

  test('POST /auth/login — contraseña incorrecta → 401', async () => {
    const res = await post('/api/v1/auth/login', {
      username: 'admin', password: 'contraseña_mala'
    });
    expect(res.status).toBe(401);
  });

  test('POST /auth/login — usuario inexistente → 401', async () => {
    const res = await post('/api/v1/auth/login', {
      username: 'fantasma', password: '12345678'
    });
    expect(res.status).toBe(401);
  });

  test('GET /auth/me — token válido → devuelve perfil', async () => {
    const res = await get('/api/v1/auth/me', tokenAdmin);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('admin');
  });

  test('GET /auth/me — sin token → 401', async () => {
    const res = await api('get', '/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

});

// ════════════════════════════════════════════════════════════
// 2. USUARIOS
// ════════════════════════════════════════════════════════════
describe('Usuarios — CRUD Admin', () => {

  test('GET /usuarios — admin → lista usuarios', async () => {
    const res = await get('/api/v1/usuarios', tokenAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(7);
  });

  test('GET /usuarios — cajero → 403 (sin permiso)', async () => {
    const res = await get('/api/v1/usuarios', tokenCajero);
    expect(res.status).toBe(403);
  });

  test('POST /usuarios — admin crea nuevo usuario', async () => {
    const res = await post('/api/v1/usuarios', {
      nombre_completo: 'Usuario Test Prueba',
      username:        'test_jest_' + Date.now(),
      password:        'TestPass123!',
      rol:             'CAJERO',
      email:           `test${Date.now()}@test.hn`,
    }, tokenAdmin);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  test('POST /usuarios — username duplicado → 409', async () => {
    const res = await post('/api/v1/usuarios', {
      nombre_completo: 'Duplicado Test',
      username:        'admin',
      password:        'TestPass123!',
      rol:             'CAJERO',
    }, tokenAdmin);
    expect(res.status).toBe(409);
  });

  test('POST /usuarios — contraseña corta → 400', async () => {
    const res = await post('/api/v1/usuarios', {
      nombre_completo: 'Usuario Sin Pass',
      username:        'sinpass_test',
      password:        '123',
      rol:             'CAJERO',
    }, tokenAdmin);
    expect(res.status).toBe(400);
  });

});

// ════════════════════════════════════════════════════════════
// 3. ARTÍCULOS Y GRUPOS
// ════════════════════════════════════════════════════════════
describe('Artículos — CRUD y catálogo', () => {

  test('GET /articulos — cualquier rol → lista artículos', async () => {
    const res = await get('/api/v1/articulos', tokenCajero);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
  });

  test('GET /articulos?q=coca — filtra por nombre', async () => {
    const res = await get('/api/v1/articulos?q=coca', tokenAdmin);
    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      expect(res.body.data[0].nombre.toLowerCase()).toContain('coca');
    }
  });

  test('POST /articulos — admin crea artículo', async () => {
    const codigo = 'TEST-' + Date.now();
    const res = await post('/api/v1/articulos', {
      codigo,
      nombre:       'Artículo de prueba Jest',
      precio_venta: 25.00,
      precio_costo: 18.00,
      impuesto_pct: 15,
      no_usar_existencia: false,
    }, tokenAdmin);
    expect(res.status).toBe(201);
    expect(res.body.codigo).toBe(codigo);
    articuloId = res.body.id;
  });

  test('POST /articulos — cajero → 403', async () => {
    const res = await post('/api/v1/articulos', {
      codigo:       'NOAUTH-001',
      nombre:       'Artículo no autorizado',
      precio_venta: 10,
    }, tokenCajero);
    expect(res.status).toBe(403);
  });

  test('PUT /articulos/:id — actualiza precio', async () => {
    if (!articuloId) return;
    const res = await put(`/api/v1/articulos/${articuloId}`, {
      precio_venta: 30.00,
    }, tokenAdmin);
    expect(res.status).toBe(200);
    expect(+res.body.precio_venta).toBe(30);
  });

  test('GET /articulos/codigo/:codigo — busca por barcode exacto', async () => {
    const res = await get('/api/v1/articulos/codigo/72', tokenAdmin);
    // El artículo 72 es "IMPERIAL CIGARROS" del seed
    expect([200, 404]).toContain(res.status);
  });

  test('GET /grupos — lista grupos activos', async () => {
    const res = await get('/api/v1/grupos', tokenAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

});

// ════════════════════════════════════════════════════════════
// 4. TURNOS
// ════════════════════════════════════════════════════════════
describe('Turnos — apertura y cierre', () => {

  test('GET /turnos/activo — sin turno → 404', async () => {
    // cajero02 no debería tener turno en entorno de prueba
    const loginRes = await post('/api/v1/auth/login', {
      username: 'cajero02', password: 'Cajero2024!'
    });
    const tok = loginRes.body.token;
    const res = await get('/api/v1/turnos/activo', tok);
    expect([200, 404]).toContain(res.status);
  });

  test('POST /turnos/abrir — cajero abre turno', async () => {
    const res = await post('/api/v1/turnos/abrir', {
      monto_inicial: 2000,
    }, tokenCajero);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.estado).toBe('ABIERTO');
    turnoId = res.body.id;
  });

  test('POST /turnos/abrir — doble apertura → 400', async () => {
    const res = await post('/api/v1/turnos/abrir', {
      monto_inicial: 2000,
    }, tokenCajero);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('abierto');
  });

  test('GET /turnos/activo — con turno abierto → devuelve turno', async () => {
    const res = await get('/api/v1/turnos/activo', tokenCajero);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ABIERTO');
  });

  test('GET /turnos — admin ve todos los turnos', async () => {
    const res = await get('/api/v1/turnos', tokenAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

});

// ════════════════════════════════════════════════════════════
// 5. VENTAS (OPERACIÓN ATÓMICA)
// ════════════════════════════════════════════════════════════
describe('Ventas — facturación POS', () => {

  test('POST /ventas — factura con artículo de inventario → 201', async () => {
    if (!turnoId || !articuloId) return;
    const res = await post('/api/v1/ventas', {
      turno_id:       turnoId,
      cliente_nombre: 'CONSUMIDOR FINAL',
      cliente_rtn:    '0000000',
      metodo_pago:    'EFECTIVO',
      monto_recibido: 50,
      total:          30,
      items: [{
        articulo_id:     articuloId,
        descripcion:     'Artículo de prueba Jest',
        cantidad:        1,
        precio_unitario: 30,
        descuento_unit:  0,
        impuesto_pct:    15,
        manual:          false,
      }],
    }, tokenCajero);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('numero_factura');
    expect(+res.body.total).toBeCloseTo(30, 1);
    ventaId = res.body.id;
  });

  test('POST /ventas — artículo manual (sin articulo_id)', async () => {
    if (!turnoId) return;
    const res = await post('/api/v1/ventas', {
      turno_id:       turnoId,
      cliente_nombre: 'CONSUMIDOR FINAL',
      cliente_rtn:    '0000000',
      metodo_pago:    'EFECTIVO',
      monto_recibido: 100,
      total:          72,
      items: [{
        articulo_id:     null,
        descripcion:     'IMPERIAL CIGARROS — Manual',
        cantidad:        1,
        precio_unitario: 72,
        descuento_unit:  0,
        impuesto_pct:    0,
        manual:          true,
      }],
    }, tokenCajero);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('numero_factura');
  });

  test('POST /ventas — turno cerrado → 400', async () => {
    const res = await post('/api/v1/ventas', {
      turno_id: 99999,
      cliente_nombre: 'TEST', cliente_rtn: '0000000',
      metodo_pago: 'EFECTIVO', monto_recibido: 50, total: 50,
      items: [{ articulo_id:null, descripcion:'X', cantidad:1, precio_unitario:50, descuento_unit:0, impuesto_pct:0, manual:true }],
    }, tokenCajero);
    expect(res.status).toBe(400);
  });

  test('GET /ventas — supervisor lista ventas del turno', async () => {
    const loginRes = await post('/api/v1/auth/login', { username:'admin', password:'Admin2024!' });
    const res = await get('/api/v1/ventas', loginRes.body.token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  test('POST /ventas/:id/anular — supervisor anula venta', async () => {
    if (!ventaId) return;
    const res = await post(`/api/v1/ventas/${ventaId}/anular`, {
      motivo: 'Prueba de anulación automática Jest'
    }, tokenAdmin);
    expect(res.status).toBe(200);
  });

});

// ════════════════════════════════════════════════════════════
// 6. INVENTARIO
// ════════════════════════════════════════════════════════════
describe('Inventario — movimientos y stock', () => {

  test('GET /inventario/stock — lista artículos con existencias', async () => {
    const res = await get('/api/v1/inventario/stock', tokenAdmin);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('resumen');
  });

  test('POST /inventario/movimientos — ENTRADA incrementa stock', async () => {
    if (!articuloId) return;

    const stockRes = await get(`/api/v1/articulos/${articuloId}`, tokenAdmin);
    const stockAntes = +stockRes.body.stock_actual;

    const res = await post('/api/v1/inventario/movimientos', {
      articulo_id:    articuloId,
      tipo:           'ENTRADA',
      cantidad:       50,
      costo_unitario: 18,
      referencia_tipo:'COMPRA',
      observaciones:  'Prueba Jest — entrada de stock',
    }, tokenAdmin);
    expect(res.status).toBe(201);
    expect(+res.body.stock_nuevo).toBe(stockAntes + 50);
  });

  test('POST /inventario/movimientos — SALIDA reduce stock', async () => {
    if (!articuloId) return;

    const stockRes = await get(`/api/v1/articulos/${articuloId}`, tokenAdmin);
    const stockAntes = +stockRes.body.stock_actual;

    const res = await post('/api/v1/inventario/movimientos', {
      articulo_id:    articuloId,
      tipo:           'SALIDA',
      cantidad:       5,
      referencia_tipo:'AJUSTE_MANUAL',
    }, tokenAdmin);
    expect(res.status).toBe(201);
    expect(+res.body.stock_nuevo).toBe(stockAntes - 5);
  });

  test('POST /inventario/movimientos — artículo servicio → 400', async () => {
    // Buscar un artículo con no_usar_existencia=true
    const arts = await get('/api/v1/articulos?tipo=srv&limit=1', tokenAdmin);
    if (!arts.body.data?.length) return;
    const srvId = arts.body.data[0].id;
    const res = await post('/api/v1/inventario/movimientos', {
      articulo_id: srvId, tipo: 'ENTRADA', cantidad: 10,
    }, tokenAdmin);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('servicio');
  });

  test('GET /inventario/alertas — lista artículos bajo mínimo', async () => {
    const res = await get('/api/v1/inventario/alertas', tokenAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /inventario/kardex/:id — historial de un artículo', async () => {
    if (!articuloId) return;
    const res = await get(`/api/v1/inventario/kardex/${articuloId}`, tokenAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // entrada + salida del test
  });

});

// ════════════════════════════════════════════════════════════
// 7. CUENTAS POR COBRAR / PAGAR
// ════════════════════════════════════════════════════════════
describe('Cuentas — C×C y C×P', () => {

  test('POST /cuentas — crea cuenta por cobrar', async () => {
    const res = await post('/api/v1/cuentas', {
      tipo:              'COBRAR',
      tercero_nombre:    'Cliente Test Jest',
      tercero_rtn:       '0000000',
      descripcion:       'Venta a crédito prueba',
      monto_total:       5000,
      fecha_vencimiento: '2026-12-31',
    }, tokenAdmin);
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('PENDIENTE');
    cuentaId = res.body.id;
  });

  test('GET /cuentas?tipo=COBRAR — lista cuentas por cobrar', async () => {
    const res = await get('/api/v1/cuentas?tipo=COBRAR', tokenAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /cuentas/:id/pagar — pago parcial actualiza saldo', async () => {
    if (!cuentaId) return;
    const res = await post(`/api/v1/cuentas/${cuentaId}/pagar`, {
      monto:        2000,
      metodo_pago:  'EFECTIVO',
      observaciones:'Abono parcial Jest',
    }, tokenAdmin);
    expect(res.status).toBe(201);
    expect(+res.body.monto).toBe(2000);
    expect(res.body.nuevo_estado).toBe('PARCIAL');
    expect(+res.body.saldo_restante).toBeCloseTo(3000, 1);
  });

  test('POST /cuentas/:id/pagar — pago total liquida la cuenta', async () => {
    if (!cuentaId) return;
    const res = await post(`/api/v1/cuentas/${cuentaId}/pagar`, {
      monto:       3000,
      metodo_pago: 'TRANSFERENCIA',
    }, tokenAdmin);
    expect(res.status).toBe(201);
    expect(res.body.nuevo_estado).toBe('PAGADO');
    expect(+res.body.saldo_restante).toBeCloseTo(0, 1);
  });

  test('POST /cuentas/:id/pagar — cuenta ya pagada → 400', async () => {
    if (!cuentaId) return;
    const res = await post(`/api/v1/cuentas/${cuentaId}/pagar`, {
      monto: 100, metodo_pago: 'EFECTIVO',
    }, tokenAdmin);
    expect(res.status).toBe(400);
  });

  test('POST /cuentas/:id/pagar — monto > saldo → 400', async () => {
    const newC = await post('/api/v1/cuentas', {
      tipo:'COBRAR', tercero_nombre:'Test Overflow',
      descripcion:'overflow test', monto_total:100,
    }, tokenAdmin);
    const res = await post(`/api/v1/cuentas/${newC.body.id}/pagar`, {
      monto: 200, metodo_pago: 'EFECTIVO',
    }, tokenAdmin);
    expect(res.status).toBe(400);
  });

  test('GET /cuentas/pagos — historial de pagos registrados', async () => {
    const res = await get('/api/v1/cuentas/pagos', tokenAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

});

// ════════════════════════════════════════════════════════════
// 8. BANCOS
// ════════════════════════════════════════════════════════════
describe('Bancos — cuentas y movimientos', () => {

  test('GET /bancos — lista cuentas bancarias', async () => {
    const res = await get('/api/v1/bancos', tokenAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    bancoId = res.body[0].id;
  });

  test('POST /bancos — crea nueva cuenta bancaria', async () => {
    const res = await post('/api/v1/bancos', {
      nombre:         'Banco Prueba Jest',
      numero_cuenta:  'TEST-JEST-001',
      saldo_inicial:  10000,
    }, tokenAdmin);
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('Banco Prueba Jest');
  });

  test('POST /bancos/movimientos — DEPOSITO aumenta saldo', async () => {
    if (!bancoId) return;
    const bancoBefore = (await get('/api/v1/bancos', tokenAdmin)).body.find(b => b.id === bancoId);
    const saldoAntes = +bancoBefore.saldo_actual;

    const res = await post('/api/v1/bancos/movimientos', {
      banco_id:    bancoId,
      tipo:        'DEPOSITO',
      monto:       5000,
      descripcion: 'Depósito prueba Jest',
    }, tokenAdmin);
    expect(res.status).toBe(201);

    // Verificar que el saldo se actualizó
    const bancoAfter = (await get('/api/v1/bancos', tokenAdmin)).body.find(b => b.id === bancoId);
    expect(+bancoAfter.saldo_actual).toBeCloseTo(saldoAntes + 5000, 0);
  });

  test('POST /bancos/movimientos — tipo inválido → 400', async () => {
    const res = await post('/api/v1/bancos/movimientos', {
      banco_id: bancoId, tipo: 'TIPO_INVENTADO', monto: 100,
    }, tokenAdmin);
    expect(res.status).toBe(400);
  });

  test('GET /bancos/movimientos — lista movimientos del banco', async () => {
    const res = await get(`/api/v1/bancos/movimientos?banco_id=${bancoId}`, tokenAdmin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

});

// ════════════════════════════════════════════════════════════
// 9. CIERRE DE TURNO (al final para no romper otros tests)
// ════════════════════════════════════════════════════════════
describe('Turnos — cierre y arqueo', () => {

  test('POST /turnos/:id/cerrar — cierra turno con arqueo', async () => {
    if (!turnoId) return;
    const res = await post(`/api/v1/turnos/${turnoId}/cerrar`, {
      monto_final_declarado: 2030,
      observaciones:         'Cierre de prueba Jest',
    }, tokenCajero);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('CERRADO');
    expect(res.body).toHaveProperty('diferencia');
  });

  test('GET /turnos/:id — verifica datos del turno cerrado', async () => {
    if (!turnoId) return;
    const res = await get(`/api/v1/turnos/${turnoId}`, tokenAdmin);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('CERRADO');
    expect(res.body).toHaveProperty('total_ventas');
  });

});

// ════════════════════════════════════════════════════════════
// 10. HEALTH CHECK
// ════════════════════════════════════════════════════════════
describe('Sistema — health check', () => {
  test('GET /health → status ok', async () => {
    const res = await api('get', '/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
