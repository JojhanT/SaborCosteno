import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './db.js';

/*
 * Identificador de la versión compilada de la app. Cambia cada vez que se
 * ejecuta `npm run build`; las pantallas abiertas lo comparan para saber que
 * hay una versión nueva y recargarse antes de pedir archivos que ya no existen.
 */
const INDEX = path.join(ROOT, 'client', 'dist', 'index.html');
const dev = process.argv.includes('--dev');
let cached = { at: 0, id: '' };

export function buildId() {
  if (dev) return 'dev';
  const now = Date.now();
  if (now - cached.at < 5000) return cached.id;
  let id = '';
  try {
    const html = fs.readFileSync(INDEX, 'utf8');
    id = /\/assets\/(index-[\w-]+\.js)/.exec(html)?.[1] ?? String(fs.statSync(INDEX).mtimeMs);
  } catch {
    id = '';
  }
  cached = { at: now, id };
  return id;
}
