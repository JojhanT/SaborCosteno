import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = process.env.SABOR_DATA ? path.resolve(process.env.SABOR_DATA) : path.join(ROOT, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'sabor.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 4000;
  PRAGMA synchronous = NORMAL;
`);

const ORDER_COLUMNS_V1 = `id, turn, business_day, type, table_number, customer_name, phone, address, address_ref, delivery_fee, note,
  status, subtotal, total, paid, payment_method, amount_received, edit_count, cancel_reason,
  created_at, updated_at, ready_at, delivered_at, paid_at, cancelled_at`;

/**
 * Migraciones incrementales controladas con PRAGMA user_version.
 * Para agregar cambios futuros (contabilidad, inventario...) basta con sumar una entrada.
 */
const MIGRATIONS = [
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE categories (
    id       INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    icon     TEXT NOT NULL DEFAULT 'salchipapa',
    image    TEXT,
    image_fit TEXT NOT NULL DEFAULT 'cover',
    sort     INTEGER NOT NULL DEFAULT 0,
    active   INTEGER NOT NULL DEFAULT 1,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE products (
    id            INTEGER PRIMARY KEY,
    category_id   INTEGER REFERENCES categories(id),
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    price         INTEGER NOT NULL DEFAULT 0,
    cost          INTEGER,
    icon          TEXT NOT NULL DEFAULT 'salchipapa',
    image         TEXT,
    image_fit     TEXT NOT NULL DEFAULT 'cover',
    options_label TEXT NOT NULL DEFAULT 'Opción',
    options       TEXT NOT NULL DEFAULT '[]',
    ingredients   TEXT NOT NULL DEFAULT '[]',
    allow_sauces  INTEGER NOT NULL DEFAULT 0,
    allow_extras  INTEGER NOT NULL DEFAULT 0,
    featured      INTEGER NOT NULL DEFAULT 0,
    active        INTEGER NOT NULL DEFAULT 1,
    archived      INTEGER NOT NULL DEFAULT 0,
    sort          INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE TABLE sauces (
    id       INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    color    TEXT NOT NULL DEFAULT '#E0452B',
    sort     INTEGER NOT NULL DEFAULT 0,
    active   INTEGER NOT NULL DEFAULT 1,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE extras (
    id       INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    price    INTEGER NOT NULL DEFAULT 0,
    sort     INTEGER NOT NULL DEFAULT 0,
    active   INTEGER NOT NULL DEFAULT 1,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE orders (
    id              INTEGER PRIMARY KEY,
    turn            INTEGER NOT NULL,
    business_day    TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('mesa', 'llevar', 'domicilio')),
    table_number    INTEGER,
    customer_name   TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    address         TEXT NOT NULL DEFAULT '',
    address_ref     TEXT NOT NULL DEFAULT '',
    delivery_fee    INTEGER NOT NULL DEFAULT 0,
    note            TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'recibido' CHECK (status IN ('recibido', 'listo', 'entregado', 'cancelado')),
    subtotal        INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    paid            INTEGER NOT NULL DEFAULT 0,
    payment_method  TEXT,
    amount_received INTEGER,
    edit_count      INTEGER NOT NULL DEFAULT 0,
    cancel_reason   TEXT NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    ready_at        INTEGER,
    delivered_at    INTEGER,
    paid_at         INTEGER,
    cancelled_at    INTEGER
  );
  CREATE UNIQUE INDEX orders_day_turn ON orders (business_day, turn);
  CREATE INDEX orders_status ON orders (status, paid);

  CREATE TABLE order_items (
    id            INTEGER PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    INTEGER,
    category_id   INTEGER,
    category_name TEXT NOT NULL DEFAULT '',
    name          TEXT NOT NULL,
    icon          TEXT NOT NULL DEFAULT '',
    image         TEXT,
    image_fit     TEXT NOT NULL DEFAULT 'cover',
    option_label  TEXT NOT NULL DEFAULT '',
    option_name   TEXT NOT NULL DEFAULT '',
    qty           INTEGER NOT NULL DEFAULT 1,
    unit_price    INTEGER NOT NULL DEFAULT 0,
    unit_cost     INTEGER,
    line_total    INTEGER NOT NULL DEFAULT 0,
    removed       TEXT NOT NULL DEFAULT '[]',
    aparte        TEXT NOT NULL DEFAULT '[]',
    sauces        TEXT NOT NULL DEFAULT '[]',
    extras        TEXT NOT NULL DEFAULT '[]',
    note          TEXT NOT NULL DEFAULT '',
    sort          INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX order_items_order ON order_items (order_id);
  CREATE INDEX order_items_product ON order_items (product_id);
  `,
  // 2 · acceso por roles: cada equipo autorizado tiene su sesión
  `
  CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    token_hash  TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'caja', 'pantalla')),
    device      TEXT NOT NULL DEFAULT '',
    user_agent  TEXT NOT NULL DEFAULT '',
    ip          TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL,
    admin_until INTEGER,
    revoked     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX sessions_role ON sessions (role, revoked);
  `,
  // 3 · usuarios con rol (reemplazan los PIN por equipo) y reparto de domicilios
  `
  CREATE TABLE users (
    id                  INTEGER PRIMARY KEY,
    username            TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name                TEXT NOT NULL,
    role                TEXT NOT NULL CHECK (role IN ('admin', 'cajero', 'cocinero', 'repartidor')),
    password            TEXT NOT NULL,
    phone               TEXT NOT NULL DEFAULT '',
    active              INTEGER NOT NULL DEFAULT 1,
    must_change         INTEGER NOT NULL DEFAULT 0,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    password_changed_at INTEGER NOT NULL,
    last_login_at       INTEGER
  );

  DROP TABLE sessions;
  CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    token_hash  TEXT NOT NULL UNIQUE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device      TEXT NOT NULL DEFAULT '',
    user_agent  TEXT NOT NULL DEFAULT '',
    ip          TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    revoked     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX sessions_user ON sessions (user_id, revoked);

  DELETE FROM settings WHERE key LIKE 'pin_%' OR key = 'adminPin';

  -- SQLite no permite cambiar un CHECK: se reconstruye la tabla con el estado "en camino"
  CREATE TABLE orders_v3 (
    id              INTEGER PRIMARY KEY,
    turn            INTEGER NOT NULL,
    business_day    TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('mesa', 'llevar', 'domicilio')),
    table_number    INTEGER,
    customer_name   TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    address         TEXT NOT NULL DEFAULT '',
    address_ref     TEXT NOT NULL DEFAULT '',
    delivery_fee    INTEGER NOT NULL DEFAULT 0,
    note            TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'recibido' CHECK (status IN ('recibido', 'listo', 'en_camino', 'entregado', 'cancelado')),
    subtotal        INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    paid            INTEGER NOT NULL DEFAULT 0,
    payment_method  TEXT,
    amount_received INTEGER,
    edit_count      INTEGER NOT NULL DEFAULT 0,
    cancel_reason   TEXT NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    ready_at        INTEGER,
    delivered_at    INTEGER,
    paid_at         INTEGER,
    cancelled_at    INTEGER,
    courier_id      INTEGER REFERENCES users(id),
    dispatched_at   INTEGER,
    created_by      INTEGER REFERENCES users(id),
    paid_by         INTEGER REFERENCES users(id)
  );
  INSERT INTO orders_v3 (${ORDER_COLUMNS_V1}) SELECT ${ORDER_COLUMNS_V1} FROM orders;
  DROP TABLE orders;
  ALTER TABLE orders_v3 RENAME TO orders;
  CREATE UNIQUE INDEX orders_day_turn ON orders (business_day, turn);
  CREATE INDEX orders_status ON orders (status, paid);
  CREATE INDEX orders_courier ON orders (courier_id, status);
  `,
];

/** Copia de la base antes de actualizarla (por si algo sale mal, se puede volver atrás). */
function backupBefore(version) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const file = path.join(DATA_DIR, `respaldo-antes-de-actualizar-v${version}-${stamp}.db`);
  try {
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    console.log(`  ✓ Copia de seguridad antes de actualizar: ${path.basename(file)}`);
  } catch (err) {
    console.error('  ✗ No se pudo crear la copia de seguridad:', err.message);
    throw err;
  }
}

function migrate() {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  if (current >= MIGRATIONS.length) return;
  if (current > 0) backupBefore(current);
  // las reconstrucciones de tablas necesitan las llaves foráneas apagadas (fuera de la transacción)
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    for (let v = current; v < MIGRATIONS.length; v++) {
      tx(() => {
        db.exec(MIGRATIONS[v]);
        const broken = db.prepare('PRAGMA foreign_key_check').all();
        if (broken.length) throw new Error(`La migración ${v + 1} dejó referencias rotas`);
        db.exec(`PRAGMA user_version = ${v + 1}`);
      });
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

const cache = new Map();
function stmt(sql) {
  let s = cache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    cache.set(sql, s);
  }
  return s;
}

export const q = {
  all: (sql, ...params) => stmt(sql).all(...params),
  get: (sql, ...params) => stmt(sql).get(...params),
  run: (sql, ...params) => stmt(sql).run(...params),
};

let depth = 0;
export function tx(fn) {
  if (depth > 0) return fn();
  depth++;
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    depth--;
  }
}

export const json = {
  parse(value, fallback = []) {
    if (value == null || value === '') return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  str: (value) => JSON.stringify(value ?? []),
};

/** Números en SQL IN (...): arma los signos de interrogación. */
export const placeholders = (list) => list.map(() => '?').join(',');

migrate();
