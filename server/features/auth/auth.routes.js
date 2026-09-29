import express from 'express';
import { q, tx } from '../../core/db.js';
import { HttpError } from '../../core/http-error.js';
import { permissionsOf, ROLE_LABEL } from './permissions.js';
import { hashPassword, needsRehash, validatePassword, verifyPassword } from './passwords.js';
import { guardIp, guardLogin, ipFailed, loginFailed, loginSucceeded } from './rate-limit.js';
import { clearCookie, clientIp, createSession, isLocal, revokeAllSessions, revokeSessions, revokeUserSessions, sessionFromReq } from './sessions.js';
import { activeAdmins, changeOwnPassword, cleanUsername, createUser, findByUsername } from '../users/users.service.js';
import { checkSetupCode, clearSetupCode, issueSetupCode } from './setup-code.js';

/* ------------------------------------------------ modo de recuperación */

const RECOVERY_KEY = 'auth_recovery';

/**
 * Lo activa `restablecer-claves.bat` (o `npm run reset-claves`): permite crear o recuperar
 * el administrador desde el PC del sistema, o desde otro equipo con el código que devuelve.
 */
export function startRecovery() {
  return tx(() => {
    q.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', RECOVERY_KEY, JSON.stringify(Date.now()));
    revokeAllSessions();
    return issueSetupCode();
  });
}

const inRecovery = () => !!q.get('SELECT 1 FROM settings WHERE key = ?', RECOVERY_KEY);
export const setupRequired = () => activeAdmins() === 0 || inRecovery();

/* ------------------------------------------------------------ helpers */

const publicUser = (u) => (u ? { id: u.id, username: u.username, name: u.name, role: u.role, mustChange: !!u.mustChange } : null);

function logAuth(text) {
  const time = new Date().toLocaleTimeString('es-CO', { hour12: false });
  console.log(`  [${time}] ${text}`);
}

/** Toda la API (salvo /auth) exige una sesión válida. */
export function authenticate(req, _res, next) {
  if (req.path.startsWith('/auth/')) return next();
  const found = sessionFromReq(req);
  if (!found) throw new HttpError(401, 'Tu sesión terminó. Vuelve a iniciar sesión.');
  req.session = found.session;
  req.user = found.user;
  if (found.user.mustChange) throw new HttpError(403, 'Debes cambiar tu contraseña antes de continuar');
  next();
}

/** Quién hizo algo (para los avisos en vivo y el historial). */
export const actorOf = (req) => (req.user ? { id: req.user.id, name: req.user.name, role: req.user.role } : null);

/* -------------------------------------------------------------- rutas */

export const authRouter = express.Router();

authRouter.get('/auth/me', (req, res) => {
  const found = sessionFromReq(req);
  res.json({
    setupRequired: setupRequired(),
    recovery: inRecovery(),
    canSetup: isLocal(req),
    user: publicUser(found?.user),
    session: found ? { id: found.session.id, device: found.session.device } : null,
    permissions: found && !found.user.mustChange ? permissionsOf(found.user) : [],
  });
});

authRouter.post('/auth/setup', (req, res) => {
  if (!setupRequired()) throw new HttpError(409, 'El sistema ya tiene administrador');
  const { name, username, password, device, code } = req.body ?? {};
  // así nadie en el wifi o en internet puede adelantarse y crear la cuenta del dueño:
  // o se hace en el computador del sistema, o con el código que muestra su consola
  if (!isLocal(req)) {
    const ip = clientIp(req);
    guardIp(ip);
    if (!checkSetupCode(code)) {
      ipFailed(ip);
      logAuth(`Código de instalación incorrecto desde ${ip}`);
      throw new HttpError(403, 'El código de instalación no es correcto. Revisa el que muestra la consola del servidor.');
    }
  }
  const userId = tx(() => {
    const existing = findByUsername(cleanUsername(username));
    let id;
    if (existing) {
      // recuperación: el usuario ya existía, se vuelve administrador con la nueva contraseña
      const pass = validatePassword(password, { username: existing.username, name: name || existing.name });
      const now = Date.now();
      q.run(
        "UPDATE users SET name = ?, role = 'admin', active = 1, must_change = 0, password = ?, password_changed_at = ?, updated_at = ? WHERE id = ?",
        String(name ?? '').trim().slice(0, 60) || existing.name,
        hashPassword(pass),
        now,
        now,
        existing.id,
      );
      id = existing.id;
    } else {
      id = createUser({ name, username, password, role: 'admin' });
    }
    q.run('DELETE FROM settings WHERE key = ?', RECOVERY_KEY);
    clearSetupCode();
    return id;
  });
  const user = q.get('SELECT * FROM users WHERE id = ?', userId);
  q.run('UPDATE users SET last_login_at = ? WHERE id = ?', Date.now(), userId);
  createSession(res, req, user, device);
  logAuth(`Cuenta de administrador lista: ${user.username}`);
  res.json({ ok: true });
});

authRouter.post('/auth/login', (req, res) => {
  const ip = clientIp(req);
  const { username, password, device } = req.body ?? {};
  guardLogin(ip, username);
  if (!q.get('SELECT 1 FROM users LIMIT 1')) throw new HttpError(409, 'Primero hay que crear la cuenta del administrador');
  const name = String(username ?? '').trim().toLowerCase();
  const user = name ? findByUsername(name) : null;
  // se verifica siempre (aunque el usuario no exista) para que todas las respuestas tarden igual
  const ok = verifyPassword(String(password ?? ''), user?.password ?? null);
  if (!user || !ok) {
    loginFailed(ip, name);
    logAuth(`Intento fallido de inicio de sesión: “${name.slice(0, 30)}” desde ${ip}`);
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  if (!user.active) throw new HttpError(403, 'Este usuario está desactivado. Habla con el administrador.');
  loginSucceeded(ip, name);
  const now = Date.now();
  if (needsRehash(user.password)) q.run('UPDATE users SET password = ? WHERE id = ?', hashPassword(password), user.id);
  q.run('UPDATE users SET last_login_at = ? WHERE id = ?', now, user.id);
  // si el equipo ya tenía una sesión (de otro usuario, por ejemplo), se cierra
  const old = sessionFromReq(req);
  if (old) revokeSessions([old.session.id]);
  createSession(res, req, user, device);
  logAuth(`${user.name} (${ROLE_LABEL[user.role]}) inició sesión desde ${ip}`);
  res.json({ ok: true });
});

authRouter.post('/auth/logout', (req, res) => {
  const found = sessionFromReq(req);
  if (found) revokeSessions([found.session.id]);
  clearCookie(res);
  res.json({ ok: true });
});

/** Cambiar la contraseña propia. Cierra la sesión en los demás equipos. */
authRouter.post('/auth/password', (req, res) => {
  const found = sessionFromReq(req);
  if (!found) throw new HttpError(401, 'Tu sesión terminó. Vuelve a iniciar sesión.');
  const ip = clientIp(req);
  guardIp(ip);
  const { current, next } = req.body ?? {};
  const row = q.get('SELECT password FROM users WHERE id = ?', found.user.id);
  if (!verifyPassword(String(current ?? ''), row?.password ?? null)) {
    ipFailed(ip);
    throw new HttpError(401, 'La contraseña actual no es correcta');
  }
  if (String(current) === String(next)) throw new HttpError(400, 'La nueva contraseña debe ser distinta a la actual');
  changeOwnPassword(found.user.id, next);
  const closed = revokeUserSessions(found.user.id, found.session.id);
  logAuth(`${found.user.name} cambió su contraseña`);
  res.json({ ok: true, closedSessions: closed });
});
