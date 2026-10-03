import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

/*
 * Recorre el flujo real contra una MySQL de verdad: mesero toma el pedido, cocina lo
 * marca listo, el cajero cobra, el repartidor entrega. Comprueba sobre todo lo que NO
 * se puede hacer, porque esconder un botón no es la protección.
 *
 * Necesita una MySQL andando. En CI la pone el workflow; en local:
 *   DB_HOST=localhost DB_USER=root DB_PASSWORD=... npm run test:integration
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.TEST_PORT) || 3199;
const BASE = `http://127.0.0.1:${PORT}`;

const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const DB_NAME = process.env.TEST_DB_NAME || 'sabor_test';

let server;

/** Un equipo con su sesión: guarda la cookie y la manda en cada petición. */
function session() {
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(BASE + url, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) if (c.startsWith('sabor_sid=')) cookie = c.split(';')[0];
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  };
  return {
    get: (url) => call('GET', url),
    post: (url, body = {}) => call('POST', url, body),
    put: (url, body) => call('PUT', url, body),
    del: (url) => call('DELETE', url),
  };
}

const admin = session();
const mesero = session();
const cajero = session();
const repartidor = session();
const cocinero = session();

let menu;

before(async () => {
  // base limpia en cada corrida: las migraciones la vuelven a armar al arrancar
  const root = await mysql.createConnection(DB);
  await root.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await root.query(`CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4`);
  await root.end();

  server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_NAME, DB_HOST: DB.host, DB_PORT: String(DB.port), DB_USER: DB.user, DB_PASSWORD: DB.password, TRUST_PROXY: '', PUBLIC_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));

  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {
      /* todavía no levanta */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`el servidor no arrancó en 30s:\n${log}`);
});

after(() => server?.kill());

describe('1 · instalación y personal', () => {
  test('se crea el administrador desde el mismo equipo, sin código', async () => {
    const r = await admin.post('/api/auth/setup', { name: 'Yovany', username: 'yovany', password: 'Prueba2026', device: 'test' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  test('el administrador crea un usuario de cada rol', async () => {
    for (const [username, role] of [
      ['mesa1', 'mesero'],
      ['caja1', 'cajero'],
      ['coci1', 'cocinero'],
      ['moto1', 'repartidor'],
    ]) {
      const r = await admin.post('/api/users', { name: username, username, role, password: 'Prueba2026' });
      assert.equal(r.status, 201, `${role}: ${JSON.stringify(r.data)}`);
    }
  });

  test('cada uno entra y recibe sus permisos', async () => {
    for (const [s, username, esperado] of [
      [mesero, 'mesa1', 'orders.manage'],
      [cajero, 'caja1', 'orders.charge'],
      [cocinero, 'coci1', 'orders.kitchen'],
      [repartidor, 'moto1', 'orders.deliver'],
    ]) {
      const login = await s.post('/api/auth/login', { username, password: 'Prueba2026', device: 'test' });
      assert.equal(login.status, 200, `${username}: ${JSON.stringify(login.data)}`);
      const me = await s.get('/api/auth/me');
      assert.ok(me.data.permissions.includes(esperado), `${username} debería tener ${esperado}`);
    }
  });

  test('el administrador arma un producto para las pruebas', async () => {
    const cat = await admin.post('/api/categories', { name: 'Pruebas' });
    assert.equal(cat.status, 201, JSON.stringify(cat.data));
    const prod = await admin.post('/api/products', { name: 'Salchipapa', categoryId: cat.data.id, price: 20000 });
    assert.equal(prod.status, 201, JSON.stringify(prod.data));
    menu = { categoryId: cat.data.id, productId: prod.data.id };
  });
});

describe('2 · el mesero toma pedidos pero no cobra', () => {
  let pedido;

  test('crea un pedido para llevar', async () => {
    const r = await mesero.post('/api/orders', { type: 'llevar', customerName: 'Ana', items: [{ productId: menu.productId, qty: 1 }] });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.paid, false);
    assert.equal(r.data.total, 20000);
    pedido = r.data;
  });

  test('NO puede cobrarlo', async () => {
    const r = await mesero.post(`/api/orders/${pedido.id}/pay`, { method: 'efectivo' });
    assert.equal(r.status, 403, 'un mesero no debería poder cobrar');
  });

  test('NO puede cobrar mandando el pago al crear el pedido', async () => {
    const r = await mesero.post('/api/orders', {
      type: 'llevar',
      items: [{ productId: menu.productId, qty: 1 }],
      payment: { method: 'efectivo', received: 20000 },
    });
    assert.equal(r.status, 403, 'el cobro no puede colarse en el cuerpo del pedido');
  });

  test('sí puede marcarlo listo y entregarlo', async () => {
    const listo = await mesero.post(`/api/orders/${pedido.id}/status`, { status: 'listo' });
    assert.equal(listo.status, 200, JSON.stringify(listo.data));
    const entregado = await mesero.post(`/api/orders/${pedido.id}/status`, { status: 'entregado' });
    assert.equal(entregado.status, 200, JSON.stringify(entregado.data));
  });

  test('el cajero lo cobra', async () => {
    const r = await cajero.post(`/api/orders/${pedido.id}/pay`, { method: 'efectivo', received: 20000 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.paid, true);
    assert.equal(r.data.paidByName, 'caja1');
  });
});

describe('3 · el cajero no toca los pedidos', () => {
  test('NO puede crear', async () => {
    const r = await cajero.post('/api/orders', { type: 'llevar', items: [{ productId: menu.productId, qty: 1 }] });
    assert.equal(r.status, 403);
  });

  test('NO puede editar', async () => {
    const r = await cajero.put('/api/orders/1', { type: 'llevar', items: [{ productId: menu.productId, qty: 2 }] });
    assert.equal(r.status, 403);
  });

  test('NO puede cancelar', async () => {
    const r = await cajero.post('/api/orders/1/cancel', { reason: 'no' });
    assert.equal(r.status, 403);
  });

  test('NO puede mover pedidos en cocina', async () => {
    const r = await cajero.post('/api/orders/1/status', { status: 'recibido' });
    assert.equal(r.status, 403);
  });
});

describe('4 · el domicilio lo cierra quien lo lleva', () => {
  let domicilio;

  test('el mesero lo crea y lo despacha con el repartidor', async () => {
    const crear = await mesero.post('/api/orders', { type: 'domicilio', address: 'Calle 1', deliveryFee: 3000, items: [{ productId: menu.productId, qty: 1 }] });
    assert.equal(crear.status, 201, JSON.stringify(crear.data));
    domicilio = crear.data;

    await mesero.post(`/api/orders/${domicilio.id}/status`, { status: 'listo' });
    const couriers = await mesero.get('/api/couriers');
    assert.equal(couriers.status, 200, JSON.stringify(couriers.data));
    const moto = couriers.data.couriers[0];
    const despachar = await mesero.post(`/api/orders/${domicilio.id}/dispatch`, { courierId: moto.id });
    assert.equal(despachar.status, 200, JSON.stringify(despachar.data));
    assert.equal(despachar.data.status, 'en_camino');
  });

  test('el mesero NO puede marcarlo entregado', async () => {
    const r = await mesero.post(`/api/orders/${domicilio.id}/deliver`);
    assert.equal(r.status, 403, 'solo lo cierra el repartidor asignado');
  });

  test('el mesero tampoco por la puerta de atrás del cambio de estado', async () => {
    const r = await mesero.post(`/api/orders/${domicilio.id}/status`, { status: 'entregado' });
    assert.equal(r.status, 403, 'este era el hueco: cerrar el domicilio ajeno vía /status');
  });

  test('el repartidor asignado sí', async () => {
    const r = await repartidor.post(`/api/orders/${domicilio.id}/deliver`);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.status, 'entregado');
  });
});

describe('5 · la contabilidad responde con números', () => {
  test('el cajero abre el cuadre del día', async () => {
    const hoy = await cajero.get('/api/auth/me');
    assert.equal(hoy.status, 200);
    const r = await cajero.get('/api/orders');
    assert.equal(r.status, 200, `el cuadre del día falló: ${JSON.stringify(r.data)}`);
    assert.ok(Array.isArray(r.data.orders));
    assert.ok(r.data.summary, 'falta el resumen');
  });

  test('los totales del resumen son números, no texto', async () => {
    const { data } = await cajero.get('/api/orders');
    const s = data.summary;
    for (const campo of ['sales', 'pending', 'deliveryFees', 'avgTicket', 'orders']) {
      assert.equal(typeof s[campo], 'number', `summary.${campo} llegó como ${typeof s[campo]}`);
    }
    for (const p of s.topProducts) {
      assert.equal(typeof p.qty, 'number', `topProducts.qty llegó como ${typeof p.qty}`);
      assert.equal(typeof p.total, 'number', `topProducts.total llegó como ${typeof p.total}`);
    }
    for (const c of s.byCourier) {
      assert.equal(typeof c.total, 'number', `byCourier.total llegó como ${typeof c.total}`);
      assert.equal(typeof c.pending, 'number', `byCourier.pending llegó como ${typeof c.pending}`);
    }
  });

  test('el mesero NO ve la contabilidad', async () => {
    const r = await mesero.get('/api/orders');
    assert.equal(r.status, 403);
  });
});

describe('6 · la bitácora cuenta quién hizo qué', () => {
  test('guarda la secuencia completa con su responsable', async () => {
    const r = await cajero.get('/api/orders/1/events');
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const porTipo = Object.fromEntries(r.data.events.map((e) => [e.kind, e.byName]));
    assert.equal(porTipo.creado, 'mesa1', 'lo tomó el mesero');
    assert.equal(porTipo.listo, 'mesa1');
    assert.equal(porTipo.entregado, 'mesa1');
    assert.equal(porTipo.cobrado, 'caja1', 'lo cobró el cajero');
  });

  test('un cobro anulado no borra el rastro de quién había cobrado', async () => {
    const anular = await cajero.post('/api/orders/1/unpay');
    assert.equal(anular.status, 200, JSON.stringify(anular.data));
    const { data } = await cajero.get('/api/orders/1/events');
    const tipos = data.events.map((e) => e.kind);
    assert.ok(tipos.includes('cobrado'), 'el cobro sigue registrado');
    assert.ok(tipos.includes('cobro_anulado'), 'y la anulación también');
    const anulado = data.events.find((e) => e.kind === 'cobro_anulado');
    assert.equal(anulado.byName, 'caja1');
  });
});

describe('7 · cada rol recibe solo lo suyo', () => {
  test('el cocinero no puede cobrar ni crear', async () => {
    assert.equal((await cocinero.post('/api/orders/1/pay', { method: 'efectivo' })).status, 403);
    assert.equal((await cocinero.post('/api/orders', { type: 'llevar', items: [] })).status, 403);
  });

  test('el repartidor solo ve sus domicilios', async () => {
    const r = await repartidor.get('/api/delivery/mine');
    assert.equal(r.status, 200, JSON.stringify(r.data));
    for (const o of [...r.data.active, ...r.data.delivered]) {
      assert.equal(o.type, 'domicilio');
    }
  });

  test('sin sesión no se obtiene nada', async () => {
    const anon = session();
    for (const url of ['/api/orders', '/api/orders/active', '/api/users', '/api/catalog', '/api/settings', '/api/bootstrap', '/api/couriers', '/api/delivery/mine']) {
      assert.equal((await anon.get(url)).status, 401, `${url} debería pedir sesión`);
    }
  });
});

describe('8 · la carta pública del QR', () => {
  const anon = session();

  test('se abre sin sesión', async () => {
    const r = await anon.get('/api/carta');
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(Array.isArray(r.data.productos));
    assert.ok(r.data.productos.length > 0, 'debería traer el producto de prueba');
  });

  test('trae el precio de venta: es el punto de la carta', async () => {
    const { data } = await anon.get('/api/carta');
    const salchipapa = data.productos.find((p) => p.name === 'Salchipapa');
    assert.ok(salchipapa, 'falta el producto');
    assert.equal(salchipapa.price, 20000);
  });

  test('NUNCA trae el costo de preparación', async () => {
    const { data } = await anon.get('/api/carta');
    for (const p of data.productos) {
      assert.ok(!('cost' in p), `el producto ${p.name} expone el costo al público`);
    }
    // ni escondido en otro rincón de la respuesta
    assert.ok(!JSON.stringify(data).includes('"cost"'), 'la respuesta menciona el costo en alguna parte');
  });

  test('no expone ajustes internos del negocio', async () => {
    const { data } = await anon.get('/api/carta');
    for (const interno of ['voiceNew', 'voiceReady', 'voiceKitchen', 'dayCutoffHour', 'tables', 'kitchenWarnMinutes']) {
      assert.ok(!(interno in data.negocio), `la carta expone el ajuste interno ${interno}`);
    }
  });

  test('no muestra lo que está marcado como no disponible', async () => {
    const antes = (await anon.get('/api/carta')).data.productos.length;
    const prod = (await admin.get('/api/catalog')).data.products.find((p) => p.name === 'Salchipapa');
    await admin.put(`/api/products/${prod.id}`, { ...prod, categoryId: prod.categoryId, active: false });

    const apagado = (await anon.get('/api/carta')).data.productos;
    assert.equal(apagado.length, antes - 1, 'el producto apagado sigue en la carta');
    assert.ok(!apagado.some((p) => p.name === 'Salchipapa'));

    await admin.put(`/api/products/${prod.id}`, { ...prod, categoryId: prod.categoryId, active: true });
    assert.equal((await anon.get('/api/carta')).data.productos.length, antes, 'al reactivarlo debería volver');
  });

  test('los datos del negocio salen tal como se guardaron', async () => {
    await admin.put('/api/settings', { address: 'Calle 110 # 48 B - 15', whatsapp: '3000000000', hours: 'Todos los días' });
    const { negocio } = (await anon.get('/api/carta')).data;
    assert.equal(negocio.address, 'Calle 110 # 48 B - 15');
    assert.equal(negocio.whatsapp, '3000000000');
    assert.equal(negocio.hours, 'Todos los días');
  });
});
