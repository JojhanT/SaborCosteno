import { q, tx, json } from '../../core/db.js';
import { HttpError } from '../../core/http-error.js';

const bool = (v) => (v ? 1 : 0);
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const money = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const optMoney = (v) => (v === '' || v == null ? null : money(v));
const imageUrl = (v) => (typeof v === 'string' && /^\/uploads\/[\w.-]+$/.test(v) ? v : null);
const fit = (v) => (v === 'contain' ? 'contain' : 'cover');

export function serializeCategory(r) {
  return { id: r.id, name: r.name, icon: r.icon, image: r.image, imageFit: r.image_fit, sort: r.sort, active: !!r.active };
}

export function serializeProduct(r) {
  return {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    description: r.description,
    price: r.price,
    cost: r.cost,
    icon: r.icon,
    image: r.image,
    imageFit: r.image_fit,
    optionsLabel: r.options_label,
    options: json.parse(r.options),
    ingredients: json.parse(r.ingredients),
    allowSauces: !!r.allow_sauces,
    allowExtras: !!r.allow_extras,
    featured: !!r.featured,
    active: !!r.active,
    sort: r.sort,
  };
}

export function serializeSauce(r) {
  return { id: r.id, name: r.name, color: r.color, sort: r.sort, active: !!r.active };
}

export function serializeExtra(r) {
  return { id: r.id, name: r.name, price: r.price, sort: r.sort, active: !!r.active };
}

/** El costo de los productos solo lo ve quien administra el menú. */
export function getCatalog({ withCost = true } = {}) {
  return {
    categories: q.all('SELECT * FROM categories WHERE archived = 0 ORDER BY sort, id').map(serializeCategory),
    products: q
      .all('SELECT * FROM products WHERE archived = 0 ORDER BY sort, id')
      .map(serializeProduct)
      .map((p) => (withCost ? p : { ...p, cost: null })),
    sauces: q.all('SELECT * FROM sauces WHERE archived = 0 ORDER BY sort, id').map(serializeSauce),
    extras: q.all('SELECT * FROM extras WHERE archived = 0 ORDER BY sort, id').map(serializeExtra),
  };
}

function nextSort(table) {
  return (q.get(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM ${table}`)?.n ?? 0);
}

function cleanOptions(list) {
  return (Array.isArray(list) ? list : [])
    .map((o) => ({ name: str(o?.name, 60), price: optMoney(o?.price) }))
    .filter((o) => o.name)
    .slice(0, 20);
}

function cleanIngredients(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((i) => str(i, 50))
    .filter((i) => i && !seen.has(i.toLowerCase()) && seen.add(i.toLowerCase()))
    .slice(0, 30);
}

/* ---------- Categorías ---------- */
export function saveCategory(id, body) {
  const name = str(body.name, 40);
  if (!name) throw new HttpError(400, 'La categoría necesita un nombre');
  const icon = str(body.icon, 40) || 'salchipapa';
  const image = imageUrl(body.image);
  const imageFit = fit(body.imageFit);
  const active = body.active === undefined ? 1 : bool(body.active);
  if (id) {
    const r = q.run('UPDATE categories SET name = ?, icon = ?, image = ?, image_fit = ?, active = ? WHERE id = ? AND archived = 0', name, icon, image, imageFit, active, id);
    if (!r.changes) throw new HttpError(404, 'Categoría no encontrada');
    return id;
  }
  return Number(
    q.run('INSERT INTO categories (name, icon, image, image_fit, active, sort) VALUES (?, ?, ?, ?, ?, ?)', name, icon, image, imageFit, active, nextSort('categories')).lastInsertRowid,
  );
}

/* ---------- Productos ---------- */
export function saveProduct(id, body) {
  const name = str(body.name, 60);
  if (!name) throw new HttpError(400, 'El producto necesita un nombre');
  const categoryId = Number(body.categoryId);
  if (!q.get('SELECT id FROM categories WHERE id = ? AND archived = 0', categoryId)) throw new HttpError(400, 'Selecciona una categoría válida');
  const now = Date.now();
  const data = [
    categoryId,
    name,
    str(body.description, 240),
    money(body.price),
    optMoney(body.cost),
    str(body.icon, 40) || 'salchipapa',
    imageUrl(body.image),
    fit(body.imageFit),
    str(body.optionsLabel, 30) || 'Opción',
    json.str(cleanOptions(body.options)),
    json.str(cleanIngredients(body.ingredients)),
    bool(body.allowSauces),
    bool(body.allowExtras),
    bool(body.featured),
    body.active === undefined ? 1 : bool(body.active),
  ];
  if (id) {
    const r = q.run(
      `UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, cost = ?, icon = ?, image = ?, image_fit = ?,
         options_label = ?, options = ?, ingredients = ?, allow_sauces = ?, allow_extras = ?, featured = ?, active = ?, updated_at = ?
       WHERE id = ? AND archived = 0`,
      ...data,
      now,
      id,
    );
    if (!r.changes) throw new HttpError(404, 'Producto no encontrado');
    return id;
  }
  return Number(
    q.run(
      `INSERT INTO products (category_id, name, description, price, cost, icon, image, image_fit, options_label, options, ingredients,
         allow_sauces, allow_extras, featured, active, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ...data,
      nextSort('products'),
      now,
      now,
    ).lastInsertRowid,
  );
}

/* ---------- Salsas ---------- */
export function saveSauce(id, body) {
  const name = str(body.name, 40);
  if (!name) throw new HttpError(400, 'La salsa necesita un nombre');
  const color = /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#E0452B';
  const active = body.active === undefined ? 1 : bool(body.active);
  if (id) {
    const r = q.run('UPDATE sauces SET name = ?, color = ?, active = ? WHERE id = ? AND archived = 0', name, color, active, id);
    if (!r.changes) throw new HttpError(404, 'Salsa no encontrada');
    return id;
  }
  return Number(q.run('INSERT INTO sauces (name, color, active, sort) VALUES (?, ?, ?, ?)', name, color, active, nextSort('sauces')).lastInsertRowid);
}

/* ---------- Adiciones ---------- */
export function saveExtra(id, body) {
  const name = str(body.name, 40);
  if (!name) throw new HttpError(400, 'La adición necesita un nombre');
  const active = body.active === undefined ? 1 : bool(body.active);
  if (id) {
    const r = q.run('UPDATE extras SET name = ?, price = ?, active = ? WHERE id = ? AND archived = 0', name, money(body.price), active, id);
    if (!r.changes) throw new HttpError(404, 'Adición no encontrada');
    return id;
  }
  return Number(q.run('INSERT INTO extras (name, price, active, sort) VALUES (?, ?, ?, ?)', name, money(body.price), active, nextSort('extras')).lastInsertRowid);
}

const TABLES = { categories: 'categories', products: 'products', sauces: 'sauces', extras: 'extras' };

/** Nunca se borra físicamente: los pedidos históricos siguen apuntando a su producto. */
export function archive(entity, id) {
  const table = TABLES[entity];
  if (!table) throw new HttpError(404, 'Recurso desconocido');
  if (table === 'categories') {
    const used = q.get('SELECT COUNT(*) AS n FROM products WHERE category_id = ? AND archived = 0', id).n;
    if (used) throw new HttpError(409, `La categoría tiene ${used} producto(s). Muévelos o elimínalos primero.`);
  }
  q.run(`UPDATE ${table} SET archived = 1, active = 0 WHERE id = ?`, id);
}

export function reorder(entity, ids) {
  const table = TABLES[entity];
  if (!table) throw new HttpError(404, 'Recurso desconocido');
  tx(() => {
    (Array.isArray(ids) ? ids : []).forEach((id, index) => q.run(`UPDATE ${table} SET sort = ? WHERE id = ?`, index, Number(id)));
  });
}

export const savers = { categories: saveCategory, products: saveProduct, sauces: saveSauce, extras: saveExtra };
