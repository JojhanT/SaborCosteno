// Copia de seguridad de la base: data/respaldos/sabor-AAAA-MM-DD-HHMM.sql
// Deja las últimas N copias (por defecto 30; se cambia con RESPALDOS_MAX).
// Las fotos no se copian: viven en data/uploads y nunca cambian una vez subidas.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pool, DATA_DIR } from '../core/db.js';

const run = promisify(execFile);

const KEEP = Math.max(1, Number(process.env.RESPALDOS_MAX) || 30);
const DIR = path.join(DATA_DIR, 'respaldos');
fs.mkdirSync(DIR, { recursive: true });

const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
const file = path.join(DIR, `sabor-${stamp}.sql`);

// la clave va por el entorno (MYSQL_PWD) y no como argumento: así no queda a la
// vista de quien liste los procesos del servidor
const { stdout } = await run(
  'mysqldump',
  [
    `--host=${process.env.DB_HOST || 'localhost'}`,
    `--port=${process.env.DB_PORT || 3306}`,
    `--user=${process.env.DB_USER || 'root'}`,
    '--single-transaction',
    '--routines',
    process.env.DB_NAME || 'sabor',
  ],
  { maxBuffer: 1024 * 1024 * 1024, env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' } },
);
fs.writeFileSync(file, stdout);
await pool.end();
console.log(`  ✓ Copia de seguridad: ${path.relative(DATA_DIR, file)}`);

const old = fs
  .readdirSync(DIR)
  .filter((f) => /^sabor-[\d-]+\.sql$/.test(f))
  .sort()
  .slice(0, -KEEP);
for (const f of old) fs.rmSync(path.join(DIR, f));
if (old.length) console.log(`  · Se borraron ${old.length} copias viejas (quedan las últimas ${KEEP})`);
