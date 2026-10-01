import { buildId } from './build.js';

/*
 * Hub de Server-Sent Events: caja, cocina, repartidores y pantallas reciben todo
 * en vivo. Cada conexión sabe de qué usuario es, así cada feature puede mandarle
 * solo lo que le corresponde (un repartidor solo ve sus domicilios).
 */

/** @type {Map<import('node:http').ServerResponse, { sessionId: string, user: any }>} */
const clients = new Map();

const hooks = {
  /** (client) => usuario actualizado o null si la sesión ya no sirve */
  validate: null,
  /** (client) => marcos iniciales al conectarse */
  onConnect: [],
};

export const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function write(res, chunk) {
  try {
    res.write(chunk);
  } catch {
    /* conexión cerrada: se limpia en 'close' */
  }
}

export function setStreamValidator(fn) {
  hooks.validate = fn;
}

export function onStreamConnect(fn) {
  hooks.onConnect.push(fn);
}

export function streamHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.socket?.setKeepAlive(true);
  res.socket?.setNoDelay(true);
  const client = { sessionId: req.session.id, user: req.user };
  write(res, 'retry: 2000\n\n');
  write(res, frame('hello', { build: buildId() }));
  for (const fn of hooks.onConnect) {
    const chunk = fn(client);
    if (chunk) write(res, chunk);
  }
  clients.set(res, client);
  req.on('close', () => clients.delete(res));
}

function close(res) {
  write(res, frame('logout', {}));
  res.end();
  clients.delete(res);
}

/** Corta la conexión en vivo de las sesiones cerradas o desconectadas. */
export function closeSessions(ids) {
  const set = new Set(ids);
  for (const [res, c] of clients) if (set.has(c.sessionId)) close(res);
}

export function broadcast(event, data = {}) {
  const payload = frame(event, data);
  for (const res of clients.keys()) write(res, payload);
}

/**
 * Un mensaje distinto por conexión. `keyOf` agrupa a quienes reciben lo mismo
 * para armar el JSON una sola vez por grupo; `build` devuelve null para no enviar.
 */
export function broadcastEach(event, keyOf, build) {
  const cache = new Map();
  for (const [res, c] of clients) {
    const key = keyOf(c);
    if (!cache.has(key)) {
      const data = build(c);
      cache.set(key, data == null ? null : frame(event, data));
    }
    const payload = cache.get(key);
    if (payload) write(res, payload);
  }
}

export const connectedSessions = () => new Set([...clients.values()].map((c) => c.sessionId));

setInterval(() => {
  // evento con nombre (no comentario) para que las pantallas detecten conexiones "zombi"
  broadcast('ping', { serverTime: Date.now(), build: buildId() });
}, 15000).unref();

setInterval(async () => {
  // las pantallas abiertas mantienen viva su sesión; las vencidas o desactivadas se cortan
  if (!hooks.validate) return;
  for (const [res, c] of clients) {
    const user = await hooks.validate(c);
    if (!user) close(res);
    else c.user = user;
  }
}, 60000).unref();
