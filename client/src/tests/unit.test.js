/**
 * POSManual - DevSys Honduras
 * Pruebas unitarias — Frontend (lógica de negocio pura)
 * Archivo: client/src/tests/unit.test.js
 *
 * npm install --save-dev vitest @vitest/ui
 * Añadir en vite.config.js:
 *   test: { environment: 'jsdom', globals: true }
 *
 * Corre con: npx vitest run
 */
import { describe, test, expect, beforeEach } from 'vitest';

// ─── Replicar funciones puras del store ───────────────────────
function calcTotales(items) {
  let subtotal = 0, exento = 0, gravado15 = 0, gravado18 = 0;
  items.forEach(({ precio, qty, isv }) => {
    const base = precio * qty;
    subtotal += base;
    if      (isv === 15) gravado15 += base / 1.15;
    else if (isv === 18) gravado18 += base / 1.18;
    else                 exento    += base;
  });
  return {
    subtotal:  +subtotal.toFixed(2),
    exento:    +exento.toFixed(2),
    gravado15: +gravado15.toFixed(2),
    isv15:     +(gravado15 * 0.15).toFixed(2),
    gravado18: +gravado18.toFixed(2),
    isv18:     +(gravado18 * 0.18).toFixed(2),
    total:     +subtotal.toFixed(2),
  };
}

function validarFila(row, index) {
  const errs = [];
  if (!row.codigo?.toString().trim())  errs.push('Código vacío');
  if (!row.nombre?.toString().trim())  errs.push('Nombre vacío');
  if (Number(row.precio1) < 0)         errs.push(`Precio negativo`);
  if (![0,15,18].includes(Number(row.impuesto1))) errs.push('ISV inválido');
  return errs.length ? { fila: index + 2, errores: errs } : null;
}

function calcularEstadisticas(rows) {
  const listaErrores = rows.map(validarFila).filter(Boolean);
  return {
    total:    rows.length,
    validos:  rows.length - listaErrores.length,
    errores:  listaErrores.length,
    grupos:   [...new Set(rows.map(r => r.grupo).filter(Boolean))].length,
    servicios:rows.filter(r => Number(r.usaexist) === 2).length,
    isv15:    rows.filter(r => Number(r.impuesto1) === 15).length,
    isv18:    rows.filter(r => Number(r.impuesto1) === 18).length,
    exentos:  rows.filter(r => Number(r.impuesto1) === 0).length,
    listaErrores,
  };
}

// ════════════════════════════════════════════════════════════
// 1. CÁLCULO DE TOTALES FISCALES (ISV Honduras)
// ════════════════════════════════════════════════════════════
describe('calcTotales — ISV 15% / 18% / exento', () => {

  test('carrito vacío → todos los totales en 0', () => {
    const t = calcTotales([]);
    expect(t.subtotal).toBe(0);
    expect(t.total).toBe(0);
    expect(t.isv15).toBe(0);
    expect(t.isv18).toBe(0);
  });

  test('artículo exento — no genera ISV', () => {
    const t = calcTotales([{ precio: 72, qty: 1, isv: 0 }]);
    expect(t.subtotal).toBe(72);
    expect(t.exento).toBe(72);
    expect(t.isv15).toBe(0);
    expect(t.isv18).toBe(0);
  });

  test('artículo ISV 15% — separa base e impuesto correctamente', () => {
    // precio 115 incluye ISV → base gravada = 100, ISV = 15
    const t = calcTotales([{ precio: 115, qty: 1, isv: 15 }]);
    expect(t.subtotal).toBe(115);
    expect(t.gravado15).toBeCloseTo(100, 1);
    expect(t.isv15).toBeCloseTo(15, 1);
  });

  test('artículo ISV 18% — separa base e impuesto correctamente', () => {
    // precio 118 incluye ISV → base = 100, ISV = 18
    const t = calcTotales([{ precio: 118, qty: 1, isv: 18 }]);
    expect(t.subtotal).toBe(118);
    expect(t.gravado18).toBeCloseTo(100, 1);
    expect(t.isv18).toBeCloseTo(18, 1);
  });

  test('múltiples artículos con distintos ISV', () => {
    const items = [
      { precio: 72, qty: 1, isv: 0   },  // exento
      { precio: 19, qty: 2, isv: 15  },  // 38 con ISV 15%
      { precio: 50, qty: 1, isv: 15  },  // 50 con ISV 15%
    ];
    const t = calcTotales(items);
    expect(t.subtotal).toBe(72 + 38 + 50);        // 160
    expect(t.exento).toBeCloseTo(72, 1);
    expect(t.gravado15).toBeCloseTo(88 / 1.15, 1); // 76.52
    expect(t.isv15).toBeCloseTo(88 / 1.15 * 0.15, 1); // 11.48
  });

  test('cantidad > 1 — multiplica correctamente', () => {
    const t = calcTotales([{ precio: 50, qty: 4, isv: 15 }]);
    expect(t.subtotal).toBe(200);
    expect(t.gravado15).toBeCloseTo(200 / 1.15, 1);
  });

  test('total === subtotal (precios incluyen ISV)', () => {
    const items = [
      { precio: 115, qty: 1, isv: 15 },
      { precio: 72,  qty: 1, isv: 0  },
    ];
    const t = calcTotales(items);
    expect(t.total).toBe(t.subtotal);
    expect(t.total).toBe(187);
  });

  test('cálculo del cambio', () => {
    const { total } = calcTotales([{ precio: 72, qty: 1, isv: 0 }]);
    const recibido = 100;
    const cambio = +(recibido - total).toFixed(2);
    expect(cambio).toBe(28);
  });

});

// ════════════════════════════════════════════════════════════
// 2. VALIDADOR DE FILAS DEL EXCEL (importación)
// ════════════════════════════════════════════════════════════
describe('validarFila — importación de artículos', () => {

  const filaValida = { codigo:'001', nombre:'COCA COLA', precio1:19, impuesto1:15 };

  test('fila válida → null (sin errores)', () => {
    expect(validarFila(filaValida, 0)).toBeNull();
  });

  test('código vacío → detecta error', () => {
    const r = validarFila({ ...filaValida, codigo:'' }, 1);
    expect(r).not.toBeNull();
    expect(r.errores).toContain('Código vacío');
  });

  test('nombre vacío → detecta error', () => {
    const r = validarFila({ ...filaValida, nombre:null }, 2);
    expect(r).not.toBeNull();
    expect(r.errores).toContain('Nombre vacío');
  });

  test('precio negativo → detecta error', () => {
    const r = validarFila({ ...filaValida, precio1:-5 }, 3);
    expect(r).not.toBeNull();
    expect(r.errores.some(e => e.includes('negativo'))).toBe(true);
  });

  test('ISV inválido (99) → detecta error', () => {
    const r = validarFila({ ...filaValida, impuesto1:99 }, 4);
    expect(r).not.toBeNull();
    expect(r.errores.some(e => e.includes('ISV'))).toBe(true);
  });

  test('ISV 0, 15, 18 → todos válidos', () => {
    [0, 15, 18].forEach(isv => {
      expect(validarFila({ ...filaValida, impuesto1: isv }, 0)).toBeNull();
    });
  });

  test('fila con múltiples errores → lista todos', () => {
    const r = validarFila({ codigo:'', nombre:'', precio1:-1, impuesto1:99 }, 5);
    expect(r.errores.length).toBeGreaterThanOrEqual(3);
  });

});

// ════════════════════════════════════════════════════════════
// 3. ESTADÍSTICAS DE IMPORTACIÓN
// ════════════════════════════════════════════════════════════
describe('calcularEstadisticas — análisis de catálogo', () => {

  const catalogoBase = [
    { codigo:'001', nombre:'Art 1', grupo:4, precio1:19, impuesto1:15, usaexist:1 },
    { codigo:'002', nombre:'Art 2', grupo:4, precio1:50, impuesto1:0,  usaexist:1 },
    { codigo:'003', nombre:'Art 3', grupo:5, precio1:72, impuesto1:0,  usaexist:1 },
    { codigo:'004', nombre:'Art 4', grupo:5, precio1:236,impuesto1:18, usaexist:1 },
    { codigo:'201', nombre:'Diesel',grupo:21,precio1:17, impuesto1:0,  usaexist:2 }, // servicio
  ];

  test('cuenta totales correctamente', () => {
    const s = calcularEstadisticas(catalogoBase);
    expect(s.total).toBe(5);
    expect(s.validos).toBe(5);
    expect(s.errores).toBe(0);
  });

  test('detecta grupos únicos', () => {
    const s = calcularEstadisticas(catalogoBase);
    expect(s.grupos).toBe(3); // 4, 5, 21
  });

  test('cuenta servicios (usaexist=2)', () => {
    const s = calcularEstadisticas(catalogoBase);
    expect(s.servicios).toBe(1);
  });

  test('clasifica por ISV correctamente', () => {
    const s = calcularEstadisticas(catalogoBase);
    expect(s.isv15).toBe(1);
    expect(s.isv18).toBe(1);
    expect(s.exentos).toBe(3);
  });

  test('detecta errores dentro de un lote mixto', () => {
    const lote = [
      ...catalogoBase,
      { codigo:'', nombre:'Sin código', precio1:10, impuesto1:15 },
      { codigo:'006', nombre:'', precio1:10, impuesto1:15 },
    ];
    const s = calcularEstadisticas(lote);
    expect(s.total).toBe(7);
    expect(s.errores).toBe(2);
    expect(s.validos).toBe(5);
  });

});

// ════════════════════════════════════════════════════════════
// 4. VALIDACIONES DE FORMULARIOS
// ════════════════════════════════════════════════════════════
describe('Validaciones — formularios del sistema', () => {

  function validarLoginForm({ username, password }) {
    const e = {};
    if (!username?.trim())    e.username = 'Requerido';
    if (!password)            e.password = 'Requerido';
    return e;
  }

  function validarArticuloForm({ codigo, nombre, precio_venta }) {
    const e = {};
    if (!codigo?.trim())   e.codigo = 'El código es obligatorio';
    if (!nombre?.trim())   e.nombre = 'El nombre es obligatorio';
    if (+precio_venta < 0) e.precio_venta = 'No puede ser negativo';
    return e;
  }

  function validarMovimientoForm({ tipo, articulo_id, cantidad }) {
    const e = {};
    const TIPOS = ['ENTRADA','SALIDA','AJUSTE_POSITIVO','AJUSTE_NEGATIVO','MERMA','TRANSFERENCIA'];
    if (!tipo || !TIPOS.includes(tipo)) e.tipo = 'Tipo inválido';
    if (!articulo_id)                   e.art  = 'Seleccioná un artículo';
    if (!cantidad || +cantidad <= 0)    e.cant = 'Cantidad debe ser mayor a 0';
    return e;
  }

  test('login — campos vacíos → errores', () => {
    const e = validarLoginForm({ username:'', password:'' });
    expect(e.username).toBeDefined();
    expect(e.password).toBeDefined();
  });

  test('login — datos válidos → sin errores', () => {
    const e = validarLoginForm({ username:'admin', password:'Admin2024!' });
    expect(Object.keys(e).length).toBe(0);
  });

  test('artículo — código vacío → error', () => {
    const e = validarArticuloForm({ codigo:'', nombre:'Test', precio_venta:10 });
    expect(e.codigo).toBeDefined();
  });

  test('artículo — precio negativo → error', () => {
    const e = validarArticuloForm({ codigo:'001', nombre:'Test', precio_venta:-5 });
    expect(e.precio_venta).toBeDefined();
  });

  test('artículo — datos completos → sin errores', () => {
    const e = validarArticuloForm({ codigo:'001', nombre:'Coca Cola', precio_venta:19 });
    expect(Object.keys(e).length).toBe(0);
  });

  test('movimiento — tipo inválido → error', () => {
    const e = validarMovimientoForm({ tipo:'RARO', articulo_id:1, cantidad:5 });
    expect(e.tipo).toBeDefined();
  });

  test('movimiento — cantidad 0 → error', () => {
    const e = validarMovimientoForm({ tipo:'ENTRADA', articulo_id:1, cantidad:0 });
    expect(e.cant).toBeDefined();
  });

  test('movimiento — datos válidos → sin errores', () => {
    const e = validarMovimientoForm({ tipo:'ENTRADA', articulo_id:1, cantidad:50 });
    expect(Object.keys(e).length).toBe(0);
  });

});

// ════════════════════════════════════════════════════════════
// 5. NÚMERO EN LETRAS (Lempiras — para el ticket)
// ════════════════════════════════════════════════════════════
describe('numLetras — importe en letras', () => {

  function numLetras(n) {
    const ent = Math.floor(n);
    const dec = Math.round((n - ent) * 100);
    const u = ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ',
      'ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO',
      'DIECINUEVE','VEINTE'];
    const d = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
    const c = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
      'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
    let r = '';
    if (ent >= 100) r = ent === 100 ? 'CIEN' : c[Math.floor(ent / 100)];
    const rem = ent % 100;
    if (rem <= 20)  r += (r ? ' ' : '') + u[rem];
    else            r += (r ? ' ' : '') + d[Math.floor(rem / 10)] + (rem % 10 ? ' Y ' + u[rem % 10] : '');
    return (r || 'CERO') + ' CON ' + String(dec).padStart(2,'0') + '/100';
  }

  test('72.00 → SETENTA Y DOS CON 00/100', () => {
    expect(numLetras(72)).toBe('SETENTA Y DOS CON 00/100');
  });

  test('100.00 → CIEN CON 00/100', () => {
    expect(numLetras(100)).toBe('CIEN CON 00/100');
  });

  test('0 → CERO CON 00/100', () => {
    expect(numLetras(0)).toBe('CERO CON 00/100');
  });

  test('19.00 → DIECINUEVE CON 00/100', () => {
    expect(numLetras(19)).toBe('DIECINUEVE CON 00/100');
  });

  test('50.50 → CINCUENTA CON 50/100', () => {
    expect(numLetras(50.5)).toBe('CINCUENTA CON 50/100');
  });

  test('250.75 → DOSCIENTOS CINCUENTA CON 75/100', () => {
    expect(numLetras(250.75)).toBe('DOSCIENTOS CINCUENTA CON 75/100');
  });

});
