// Copia de seguridad de la base sin apagar el sistema: data/respaldos/sabor-AAAA-MM-DD-HHMM.db
// Deja las últimas N copias (por defecto 30; se cambia con RESPALDOS_MAX).
// Las fotos no se copian: viven en data/uploads y nunca cambian una vez subidas.
import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR } from '../core/db.js';

const KEEP = Math.max(1, Number(process.env.RESPALDOS_MAX) || 30);
const DIR = path.join(DATA_DIR, 'respaldos');
fs.mkdirSync(DIR, { recursive: true });

const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
const file = path.join(DIR, `sabor-${stamp}.db`);

fs.rmSync(file, { force: true });
// VACUUM INTO arma una copia consistente aunque la caja esté trabajando
db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
db.close();
console.log(`  ✓ Copia de seguridad: ${path.relative(DATA_DIR, file)}`);

const old = fs
  .readdirSync(DIR)
  .filter((f) => /^sabor-[\d-]+\.db$/.test(f))
  .sort()
  .slice(0, -KEEP);
for (const f of old) fs.rmSync(path.join(DIR, f));
if (old.length) console.log(`  · Se borraron ${old.length} copias viejas (quedan las últimas ${KEEP})`);
