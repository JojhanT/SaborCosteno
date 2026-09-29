import crypto from 'node:crypto';
import { HttpError } from '../../core/http-error.js';

/*
 * Contraseñas con scrypt (sal propia por usuario). Se guarda el costo junto al
 * hash para poder subirlo en el futuro sin romper las contraseñas existentes.
 */

const COST = { N: 32768, r: 8, p: 1 };
const KEY_LEN = 32;
const MAXMEM = 96 * 1024 * 1024;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, KEY_LEN, { ...COST, maxmem: MAXMEM }).toString('hex');
  return JSON.stringify({ alg: 'scrypt', ...COST, salt, hash });
}

// hash de relleno: si el usuario no existe se hace el mismo trabajo, así no se
// puede adivinar qué usuarios existen midiendo cuánto tarda la respuesta
const DUMMY = hashPassword(crypto.randomBytes(12).toString('hex'));

export function verifyPassword(password, stored) {
  let s;
  try {
    s = JSON.parse(stored ?? DUMMY);
  } catch {
    s = JSON.parse(DUMMY);
  }
  const a = crypto.scryptSync(String(password ?? ''), s.salt, KEY_LEN, { N: s.N, r: s.r, p: s.p, maxmem: MAXMEM });
  const b = Buffer.from(s.hash, 'hex');
  return stored != null && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** El hash usa un costo menor al actual: conviene rehacerlo al iniciar sesión. */
export function needsRehash(stored) {
  try {
    const s = JSON.parse(stored);
    return s.N !== COST.N || s.r !== COST.r || s.p !== COST.p;
  } catch {
    return true;
  }
}

const COMMON = new Set(['12345678', '123456789', '1234567890', '87654321', 'password', 'password1', 'contraseña', 'contrasena', 'qwerty123', 'abc12345', 'sabor123', 'saborcosteno', '11111111', '00000000']);

export function validatePassword(password, { username = '', name = '' } = {}) {
  const p = String(password ?? '');
  if (p.length < 8) throw new HttpError(400, 'La contraseña debe tener mínimo 8 caracteres');
  if (p.length > 128) throw new HttpError(400, 'La contraseña es demasiado larga');
  if (!/[a-zA-ZñÑáéíóúÁÉÍÓÚ]/.test(p) || !/\d/.test(p)) throw new HttpError(400, 'La contraseña debe tener letras y números');
  const lower = p.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(p)) throw new HttpError(400, 'Esa contraseña es muy fácil de adivinar');
  if (username && lower.includes(String(username).toLowerCase())) throw new HttpError(400, 'La contraseña no puede contener el usuario');
  const first = String(name).trim().split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 4 && lower.includes(first)) throw new HttpError(400, 'La contraseña no puede contener el nombre');
  return p;
}
