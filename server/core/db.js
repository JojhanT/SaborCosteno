import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = process.env.SABOR_DATA ? path.resolve(process.env.SABOR_DATA) : path.join(ROOT, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sabor',
};

export const pool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,
  connectionLimit: 10,
});

/**
 * Migraciones incrementales controladas con la tabla schema_migrations.
 * Para agregar cambios futuros (contabilidad, inventario...) basta con sumar una entrada.
 */
const MIGRATIONS = [
  `
  CREATE TABLE settings (
    \`key\` VARCHAR(100) PRIMARY KEY,
    value   TEXT NOT NULL
  ) ENGINE=InnoDB;

  CREATE TABLE categories (
    id        INT PRIMARY KEY AUTO_INCREMENT,
    name      VARCHAR(40) NOT NULL,
    icon      VARCHAR(40) NOT NULL DEFAULT 'salchipapa',
    image     VARCHAR(255),
    image_fit VARCHAR(10) NOT NULL DEFAULT 'cover',
    sort      INT NOT NULL DEFAULT 0,
    active    TINYINT(1) NOT NULL DEFAULT 1,
    archived  TINYINT(1) NOT NULL DEFAULT 0
  ) ENGINE=InnoDB;

  CREATE TABLE products (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    category_id   INT,
    name          VARCHAR(60) NOT NULL,
    description   VARCHAR(240) NOT NULL DEFAULT '',
    price         INT NOT NULL DEFAULT 0,
    cost          INT,
    icon          VARCHAR(40) NOT NULL DEFAULT 'salchipapa',
    image         VARCHAR(255),
    image_fit     VARCHAR(10) NOT NULL DEFAULT 'cover',
    options_label VARCHAR(30) NOT NULL DEFAULT 'Opción',
    options       TEXT NOT NULL,
    ingredients   TEXT NOT NULL,
    allow_sauces  TINYINT(1) NOT NULL DEFAULT 0,
    allow_extras  TINYINT(1) NOT NULL DEFAULT 0,
    featured      TINYINT(1) NOT NULL DEFAULT 0,
    active        TINYINT(1) NOT NULL DEFAULT 1,
    archived      TINYINT(1) NOT NULL DEFAULT 0,
    sort          INT NOT NULL DEFAULT 0,
    created_at    BIGINT NOT NULL,
    updated_at    BIGINT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  ) ENGINE=InnoDB;

  CREATE TABLE sauces (
    id       INT PRIMARY KEY AUTO_INCREMENT,
    name     VARCHAR(40) NOT NULL,
    color    VARCHAR(10) NOT NULL DEFAULT '#E0452B',
    sort     INT NOT NULL DEFAULT 0,
    active   TINYINT(1) NOT NULL DEFAULT 1,
    archived TINYINT(1) NOT NULL DEFAULT 0
  ) ENGINE=InnoDB;

  CREATE TABLE extras (
    id       INT PRIMARY KEY AUTO_INCREMENT,
    name     VARCHAR(40) NOT NULL,
    price    INT NOT NULL DEFAULT 0,
    sort     INT NOT NULL DEFAULT 0,
    active   TINYINT(1) NOT NULL DEFAULT 1,
    archived TINYINT(1) NOT NULL DEFAULT 0
  ) ENGINE=InnoDB;

  CREATE TABLE users (
    id                  INT PRIMARY KEY AUTO_INCREMENT,
    username            VARCHAR(30) NOT NULL UNIQUE,
    name                VARCHAR(60) NOT NULL,
    role                VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'cajero', 'cocinero', 'repartidor')),
    password            VARCHAR(255) NOT NULL,
    phone               VARCHAR(30) NOT NULL DEFAULT '',
    active              TINYINT(1) NOT NULL DEFAULT 1,
    must_change         TINYINT(1) NOT NULL DEFAULT 0,
    created_at          BIGINT NOT NULL,
    updated_at          BIGINT NOT NULL,
    password_changed_at BIGINT NOT NULL,
    last_login_at       BIGINT
  ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

  CREATE TABLE sessions (
    id          VARCHAR(36) PRIMARY KEY,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    user_id     INT NOT NULL,
    device      VARCHAR(40) NOT NULL DEFAULT '',
    user_agent  VARCHAR(200) NOT NULL DEFAULT '',
    ip          VARCHAR(45) NOT NULL DEFAULT '',
    created_at  BIGINT NOT NULL,
    last_seen   BIGINT NOT NULL,
    expires_at  BIGINT NOT NULL,
    revoked     TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;
  CREATE INDEX sessions_user ON sessions (user_id, revoked);

  CREATE TABLE orders (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    turn            INT NOT NULL,
    business_day    VARCHAR(10) NOT NULL,
    type            VARCHAR(12) NOT NULL CHECK (type IN ('mesa', 'llevar', 'domicilio')),
    table_number    INT,
    customer_name   VARCHAR(60) NOT NULL DEFAULT '',
    phone           VARCHAR(30) NOT NULL DEFAULT '',
    address         VARCHAR(160) NOT NULL DEFAULT '',
    address_ref     VARCHAR(160) NOT NULL DEFAULT '',
    delivery_fee    INT NOT NULL DEFAULT 0,
    note            VARCHAR(400) NOT NULL DEFAULT '',
    status          VARCHAR(12) NOT NULL DEFAULT 'recibido' CHECK (status IN ('recibido', 'listo', 'en_camino', 'entregado', 'cancelado')),
    subtotal        INT NOT NULL DEFAULT 0,
    total           INT NOT NULL DEFAULT 0,
    paid            TINYINT(1) NOT NULL DEFAULT 0,
    payment_method  VARCHAR(20),
    amount_received INT,
    edit_count      INT NOT NULL DEFAULT 0,
    cancel_reason   VARCHAR(200) NOT NULL DEFAULT '',
    created_at      BIGINT NOT NULL,
    updated_at      BIGINT NOT NULL,
    ready_at        BIGINT,
    delivered_at    BIGINT,
    paid_at         BIGINT,
    cancelled_at    BIGINT,
    courier_id      INT,
    dispatched_at   BIGINT,
    created_by      INT,
    paid_by         INT,
    FOREIGN KEY (courier_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (paid_by) REFERENCES users(id)
  ) ENGINE=InnoDB;
  CREATE UNIQUE INDEX orders_day_turn ON orders (business_day, turn);
  CREATE INDEX orders_status ON orders (status, paid);
  CREATE INDEX orders_courier ON orders (courier_id, status);

  CREATE TABLE order_items (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    order_id      INT NOT NULL,
    product_id    INT,
    category_id   INT,
    category_name VARCHAR(40) NOT NULL DEFAULT '',
    name          VARCHAR(60) NOT NULL,
    icon          VARCHAR(40) NOT NULL DEFAULT '',
    image         VARCHAR(255),
    image_fit     VARCHAR(10) NOT NULL DEFAULT 'cover',
    option_label  VARCHAR(30) NOT NULL DEFAULT '',
    option_name   VARCHAR(60) NOT NULL DEFAULT '',
    qty           INT NOT NULL DEFAULT 1,
    unit_price    INT NOT NULL DEFAULT 0,
    unit_cost     INT,
    line_total    INT NOT NULL DEFAULT 0,
    removed       TEXT NOT NULL,
    aparte        TEXT NOT NULL,
    sauces        TEXT NOT NULL,
    extras        TEXT NOT NULL,
    note          VARCHAR(200) NOT NULL DEFAULT '',
    sort          INT NOT NULL DEFAULT 0,
    created_at    BIGINT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;
  CREATE INDEX order_items_order ON order_items (order_id);
  CREATE INDEX order_items_product ON order_items (product_id);
  `,
];

/** Espera a que MySQL acepte conexiones: al arrancar junto al contenedor, el healthcheck
 * a veces lo da por listo un poco antes de que ya reciba conexiones nuevas. */
async function waitForDb(retries = 20, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const connection = await pool.getConnection();
      connection.release();
      return;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`  … esperando a MySQL (intento ${i}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function migrate() {
  await waitForDb();
  // conexión aparte y de un solo uso: solo las migraciones mandan varias sentencias
  // juntas, así ninguna consulta de la app puede encadenar sentencias
  const connection = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true });
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    INT PRIMARY KEY,
        applied_at BIGINT NOT NULL
      ) ENGINE=InnoDB
    `);
    const [[{ current }]] = await connection.query('SELECT COALESCE(MAX(version), 0) AS current FROM schema_migrations');
    for (let v = current; v < MIGRATIONS.length; v++) {
      await connection.query(MIGRATIONS[v]);
      await connection.query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [v + 1, Date.now()]);
      console.log(`  ✓ Migración ${v + 1} aplicada`);
    }
  } finally {
    await connection.end();
  }
}

// la conexión activa de la transacción en curso (si hay una) para que q.* la use sin
// que cada función de servicio tenga que recibirla y pasarla a mano
const als = new AsyncLocalStorage();
const client = () => als.getStore() ?? pool;

export const q = {
  all: async (sql, ...params) => {
    const [rows] = await client().query(sql, params);
    return rows;
  },
  get: async (sql, ...params) => {
    const [rows] = await client().query(sql, params);
    return rows[0] ?? null;
  },
  run: async (sql, ...params) => {
    const [result] = await client().query(sql, params);
    // mysql2 trae FOUND_ROWS activo por defecto: affectedRows cuenta filas que hicieron
    // match en el WHERE (como el "changes" de SQLite), no solo las que de verdad cambiaron
    return { lastInsertRowid: result.insertId, changes: result.affectedRows };
  },
};

export async function tx(fn) {
  if (als.getStore()) return fn();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await als.run(connection, fn);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
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

await migrate();
