import { q, tx } from '../../core/db.js';
import { HttpError } from '../../core/http-error.js';
import { ROLES } from '../auth/permissions.js';
import { hashPassword, validatePassword } from '../auth/passwords.js';
import { revokeUserSessions } from '../auth/sessions.js';
import { connectedSessions } from '../../core/events.js';

const str = (v, max) => String(v ?? '').trim().slice(0, max);

export function cleanUsername(v) {
  const u = String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new HttpError(400, 'El usuario debe tener de 3 a 30 letras o números, sin espacios (puede llevar . _ -)');
  return u;
}

function cleanName(v) {
  const n = str(v, 60);
  if (n.length < 2) throw new HttpError(400, 'Escribe el nombre de la persona');
  return n;
}

function cleanRole(v) {
  if (!ROLES.includes(v)) throw new HttpError(400, 'Elige un rol válido');
  return v;
}

export function serializeUser(r, online = new Set()) {
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    role: r.role,
    phone: r.phone,
    active: !!r.active,
    mustChange: !!r.must_change,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
    passwordChangedAt: r.password_changed_at,
    sessions: r.sessions ?? 0,
    lastSeen: r.last_seen ?? null,
    online: r.session_ids ? r.session_ids.split(',').some((id) => online.has(id)) : false,
  };
}

export async function listUsers() {
  const online = connectedSessions();
  const rows = await q.all(
    `SELECT u.*, COUNT(s.id) AS sessions, MAX(s.last_seen) AS last_seen, GROUP_CONCAT(s.id) AS session_ids
       FROM users u
       LEFT JOIN sessions s ON s.user_id = u.id AND s.revoked = 0 AND s.expires_at > ?
      GROUP BY u.id
      ORDER BY u.active DESC, CASE u.role WHEN 'admin' THEN 0 WHEN 'mesero' THEN 1 WHEN 'cajero' THEN 2 WHEN 'cocinero' THEN 3 ELSE 4 END, u.name`,
    Date.now(),
  );
  return rows.map((r) => serializeUser(r, online));
}

export async function getUserRow(id) {
  const row = await q.get('SELECT * FROM users WHERE id = ?', Number(id));
  if (!row) throw new HttpError(404, 'Usuario no encontrado');
  return row;
}

export const findByUsername = (username) => q.get('SELECT * FROM users WHERE username = ?', String(username ?? '').trim().toLowerCase());

export const activeAdmins = async () => (await q.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1")).n;

async function ensureUniqueUsername(username, exceptId = 0) {
  if (await q.get('SELECT id FROM users WHERE username = ? AND id != ?', username, exceptId)) throw new HttpError(409, `Ya existe un usuario llamado “${username}”`);
}

export async function createUser(body) {
  const username = cleanUsername(body.username);
  const name = cleanName(body.name);
  const role = cleanRole(body.role);
  const password = validatePassword(body.password, { username, name });
  await ensureUniqueUsername(username);
  const now = Date.now();
  const { lastInsertRowid } = await q.run(
    `INSERT INTO users (username, name, role, password, phone, active, must_change, created_at, updated_at, password_changed_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    username,
    name,
    role,
    hashPassword(password),
    str(body.phone, 30),
    body.mustChange ? 1 : 0,
    now,
    now,
    now,
  );
  return Number(lastInsertRowid);
}

/** Editar datos y rol. Un cambio de rol o una desactivación cierra sus sesiones. */
export function updateUser(id, body, actor) {
  return tx(async () => {
    const row = await getUserRow(id);
    const username = body.username !== undefined ? cleanUsername(body.username) : row.username;
    const name = body.name !== undefined ? cleanName(body.name) : row.name;
    const role = body.role !== undefined ? cleanRole(body.role) : row.role;
    const active = body.active !== undefined ? (body.active ? 1 : 0) : row.active;
    const phone = body.phone !== undefined ? str(body.phone, 30) : row.phone;
    await ensureUniqueUsername(username, row.id);

    if (row.id === actor.id && (role !== row.role || !active)) throw new HttpError(400, 'No puedes cambiar tu propio rol ni desactivarte');
    const losesAdmin = row.role === 'admin' && row.active && (role !== 'admin' || !active);
    if (losesAdmin && (await activeAdmins()) <= 1) throw new HttpError(400, 'Debe quedar al menos un administrador activo');
    if (!active && row.role === 'repartidor' && (await q.get("SELECT id FROM orders WHERE courier_id = ? AND status = 'en_camino'", row.id))) {
      throw new HttpError(409, 'Este repartidor tiene domicilios en camino. Reasígnalos o márcalos como entregados primero.');
    }

    await q.run('UPDATE users SET username = ?, name = ?, role = ?, active = ?, phone = ?, updated_at = ? WHERE id = ?', username, name, role, active, phone, Date.now(), row.id);
    if (role !== row.role || !active) await revokeUserSessions(row.id);
    return row.id;
  });
}

/** El administrador asigna una contraseña nueva (por olvido o por seguridad). */
export async function resetPassword(id, body) {
  const row = await getUserRow(id);
  const password = validatePassword(body.password, { username: row.username, name: row.name });
  const now = Date.now();
  await q.run('UPDATE users SET password = ?, must_change = ?, password_changed_at = ?, updated_at = ? WHERE id = ?', hashPassword(password), body.mustChange ? 1 : 0, now, now, row.id);
  await revokeUserSessions(row.id);
}

/** El mismo usuario cambia su contraseña (ya se verificó la actual). */
export async function changeOwnPassword(userId, next) {
  const row = await getUserRow(userId);
  const password = validatePassword(next, { username: row.username, name: row.name });
  const now = Date.now();
  await q.run('UPDATE users SET password = ?, must_change = 0, password_changed_at = ?, updated_at = ? WHERE id = ?', hashPassword(password), now, now, row.id);
}

/** Repartidores activos y cuántos domicilios llevan en este momento. */
export async function listCouriers() {
  const rows = await q.all(
    `SELECT u.id, u.name, u.phone,
            (SELECT COUNT(*) FROM orders o WHERE o.courier_id = u.id AND o.status = 'en_camino') AS active
       FROM users u
      WHERE u.role = 'repartidor' AND u.active = 1
      ORDER BY u.name`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, active: r.active }));
}
