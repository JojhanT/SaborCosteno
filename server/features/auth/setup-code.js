import crypto from 'node:crypto';
import { q } from '../../core/db.js';

/*
 * Código de instalación: en un servidor en internet nadie está "en el mismo
 * computador", así que la cuenta del administrador también se puede crear (o
 * recuperar) desde otro equipo escribiendo este código. Solo aparece en la
 * consola del servidor (en Docker: `docker compose logs app`); en la base se
 * guarda su hash y se borra al usarlo.
 */

const KEY = 'auth_setup_code';
// sin letras ni números que se confunden al leerlos (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

const normalize = (code) => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const hash = (code) => crypto.createHash('sha256').update(normalize(code)).digest('hex');

/** Crea un código nuevo (el anterior deja de servir) y lo devuelve para mostrarlo. */
export function issueSetupCode() {
  let code = '';
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  q.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', KEY, JSON.stringify(hash(code)));
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function checkSetupCode(code) {
  const row = q.get('SELECT value FROM settings WHERE key = ?', KEY);
  if (!row || normalize(code).length !== LENGTH) return false;
  let expected;
  try {
    expected = Buffer.from(JSON.parse(row.value), 'hex');
  } catch {
    return false;
  }
  const given = Buffer.from(hash(code), 'hex');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export const clearSetupCode = () => q.run('DELETE FROM settings WHERE key = ?', KEY);
