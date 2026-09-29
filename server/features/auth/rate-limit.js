import { HttpError } from '../../core/http-error.js';

/*
 * Freno a los intentos de contraseña, por equipo (IP) y por usuario:
 *  - un equipo que falla 5 veces se bloquea 5 min (luego 10, 20, 40 y hasta 60);
 *  - un usuario que falla 10 veces (desde donde sea) se bloquea 15 min.
 */

const byIp = new Map();
const byUser = new Map();

const RULES = {
  ip: { max: 5, first: 5, cap: 60 },
  user: { max: 10, first: 15, cap: 60 },
};

function check(map, key) {
  const a = map.get(key);
  if (a && a.until > Date.now()) {
    const mins = Math.ceil((a.until - Date.now()) / 60000);
    throw new HttpError(429, `Demasiados intentos. Espera ${mins} minuto${mins === 1 ? '' : 's'} y vuelve a intentar.`);
  }
}

function bump(map, key, rule) {
  const a = map.get(key) ?? { fails: 0, until: 0, lock: 0, last: 0 };
  a.fails++;
  a.last = Date.now();
  if (a.fails >= rule.max) {
    a.lock = Math.min(a.lock ? a.lock * 2 : rule.first, rule.cap);
    a.until = Date.now() + a.lock * 60000;
    a.fails = 0;
  }
  map.set(key, a);
}

const userKey = (username) => String(username ?? '').trim().toLowerCase();

export function guardLogin(ip, username) {
  check(byIp, ip);
  if (userKey(username)) check(byUser, userKey(username));
}

export function loginFailed(ip, username) {
  bump(byIp, ip, RULES.ip);
  if (userKey(username)) bump(byUser, userKey(username), RULES.user);
}

export function loginSucceeded(ip, username) {
  byIp.delete(ip);
  byUser.delete(userKey(username));
}

/** Se usa también para confirmar la contraseña actual al cambiarla. */
export const guardIp = (ip) => check(byIp, ip);
export const ipFailed = (ip) => bump(byIp, ip, RULES.ip);

// limpieza: se olvidan los intentos viejos
setInterval(() => {
  const old = Date.now() - 6 * 3600_000;
  for (const map of [byIp, byUser]) for (const [k, a] of map) if (a.until < Date.now() && a.last < old) map.delete(k);
}, 3600_000).unref();
