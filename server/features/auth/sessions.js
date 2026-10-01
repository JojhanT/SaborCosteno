import crypto from 'node:crypto';
import { q, placeholders } from '../../core/db.js';
import { closeSessions } from '../../core/events.js';

/*
 * Sesiones: cada equipo que inicia sesión recibe una cookie HttpOnly con un
 * token aleatorio (en la base solo se guarda su hash). La sesión se renueva sola
 * mientras se usa y vence tras un tiempo sin uso que depende del rol.
 */

const COOKIE = 'sabor_sid';
const DAY = 86400_000;
const MAX_AGE = 400 * DAY; // lo máximo que guardan los navegadores
const TOUCH_EVERY = 60_000;

/** Tiempo sin uso para que la sesión venza. */
export const IDLE = {
  admin: 12 * 3600_000,
  cajero: 7 * DAY,
  cocinero: 180 * DAY, // televisores y tablets fijas de la cocina
  repartidor: 30 * DAY,
};

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try {
        out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        /* cookie mal formada: se ignora */
      }
    }
  }
  return out;
}

const plainIp = (ip) => String(ip ?? '').replace(/^::ffff:/, '');

/** IP del equipo; detrás de un proxy de confianza (TRUST_PROXY) es la que el proxy reporta. */
export const clientIp = (req) => plainIp(req.ip ?? req.socket?.remoteAddress);

/**
 * Petición hecha desde el mismo computador donde corre el servidor (la caja).
 * Si pasó por un proxy no cuenta: un proxy en el mismo equipo haría ver "local" a todo internet.
 */
export const isLocal = (req) =>
  ['127.0.0.1', '::1'].includes(plainIp(req.socket?.remoteAddress)) && !req.get('x-forwarded-for') && !req.get('forwarded') && !req.get('x-real-ip');

function setCookie(res, token, secure) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE / 1000}${secure ? '; Secure' : ''}`);
}

export function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

const expiryFor = (role, createdAt, now) => Math.min(now + (IDLE[role] ?? DAY), createdAt + MAX_AGE);

export function browserName(ua = '') {
  if (/SmartTV|SMART-TV|Tizen|webOS|BRAVIA|AFT|Android TV|GoogleTV/i.test(ua)) return 'Smart TV';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return os ? `${br} · ${os}` : br;
}

export async function createSession(res, req, user, device) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const id = crypto.randomUUID();
  const ua = String(req.get('user-agent') ?? '').slice(0, 200);
  await q.run(
    `INSERT INTO sessions (id, token_hash, user_id, device, user_agent, ip, created_at, last_seen, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    hashToken(token),
    user.id,
    String(device ?? '').trim().slice(0, 40) || browserName(ua),
    ua,
    clientIp(req),
    now,
    now,
    expiryFor(user.role, now, now),
  );
  // con HTTPS la cookie solo viaja cifrada
  setCookie(res, token, req.secure);
  return id;
}

const SESSION_SQL = `SELECT s.*, u.id AS u_id, u.username, u.name, u.role, u.phone, u.active, u.must_change
  FROM sessions s JOIN users u ON u.id = s.user_id`;

function split(row) {
  const session = { id: row.id, userId: row.user_id, device: row.device, createdAt: row.created_at, lastSeen: row.last_seen, expiresAt: row.expires_at };
  const user = { id: row.u_id, username: row.username, name: row.name, role: row.role, phone: row.phone, active: row.active, mustChange: !!row.must_change };
  return { session, user };
}

/** Revisa que la sesión siga viva y la renueva si se está usando. */
async function validRow(row, ip) {
  if (!row || row.revoked) return null;
  const now = Date.now();
  if (!row.active || row.expires_at <= now) {
    await q.run('UPDATE sessions SET revoked = 1 WHERE id = ?', row.id);
    return null;
  }
  if (now - row.last_seen > TOUCH_EVERY) {
    const expires = expiryFor(row.role, row.created_at, now);
    if (ip) await q.run('UPDATE sessions SET last_seen = ?, expires_at = ?, ip = ? WHERE id = ?', now, expires, ip, row.id);
    else await q.run('UPDATE sessions SET last_seen = ?, expires_at = ? WHERE id = ?', now, expires, row.id);
    row.last_seen = now;
    row.expires_at = expires;
  }
  return split(row);
}

export async function sessionFromReq(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token || token.length > 100) return null;
  return validRow(await q.get(`${SESSION_SQL} WHERE s.token_hash = ? AND s.revoked = 0`, hashToken(token)), clientIp(req));
}

/** Para las conexiones en vivo: devuelve el usuario vigente o null. */
export async function validateSessionId(id) {
  return (await validRow(await q.get(`${SESSION_SQL} WHERE s.id = ? AND s.revoked = 0`, id), null))?.user ?? null;
}

export async function revokeSessions(ids) {
  if (!ids.length) return;
  await q.run(`UPDATE sessions SET revoked = 1 WHERE id IN (${placeholders(ids)})`, ...ids);
  closeSessions(ids);
}

/** Cierra todas las sesiones de un usuario (menos, opcionalmente, la actual). */
export async function revokeUserSessions(userId, exceptId = null) {
  const ids = (await q.all('SELECT id FROM sessions WHERE user_id = ? AND revoked = 0 AND id != ?', userId, exceptId ?? '')).map((r) => r.id);
  await revokeSessions(ids);
  return ids.length;
}

export async function revokeAllSessions() {
  const ids = (await q.all('SELECT id FROM sessions WHERE revoked = 0')).map((r) => r.id);
  await revokeSessions(ids);
}

export async function activeSessions() {
  const now = Date.now();
  return (
    await q.all(
      `SELECT s.id, s.user_id, s.device, s.user_agent, s.ip, s.created_at, s.last_seen, s.expires_at, u.name, u.username, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.revoked = 0 AND s.expires_at > ? AND u.active = 1
        ORDER BY s.last_seen DESC`,
      now,
    )
  ).map((s) => ({
    id: s.id,
    userId: s.user_id,
    userName: s.name,
    username: s.username,
    role: s.role,
    device: s.device,
    browser: browserName(s.user_agent),
    ip: s.ip,
    createdAt: s.created_at,
    lastSeen: s.last_seen,
    expiresAt: s.expires_at,
  }));
}

// limpieza: las sesiones cerradas o vencidas hace más de 30 días se borran
setInterval(() => {
  q.run('DELETE FROM sessions WHERE (revoked = 1 OR expires_at < ?) AND last_seen < ?', Date.now(), Date.now() - 30 * DAY).catch((err) =>
    console.error('No se pudo limpiar sesiones viejas:', err),
  );
}, 6 * 3600_000).unref();
