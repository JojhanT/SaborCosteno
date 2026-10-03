import { q, tx, json, placeholders } from '../../core/db.js';
import { HttpError } from '../../core/http-error.js';
import { can, canCloseDelivery } from '../auth/permissions.js';
import { getSettings, businessDay } from '../settings/settings.service.js';

export const ORDER_TYPES = ['mesa', 'llevar', 'domicilio'];
/** Estados que se cambian a mano. "en_camino" solo se pone al despachar un domicilio. */
export const FLOW_STATUSES = ['recibido', 'listo', 'entregado'];
export const PAYMENT_METHODS = ['efectivo', 'nequi', 'daviplata', 'tarjeta', 'transferencia'];

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const money = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const uniqStrings = (list) => [...new Set((Array.isArray(list) ? list : []).map((v) => str(v, 60)).filter(Boolean))];

/* ------------------------------------------------------------- bitácora */

/**
 * Quién hizo qué y cuándo. Queda todo, incluso lo que se deshace (un cobro anulado
 * no borra el rastro de quién había cobrado), que es lo que sirve en un descuadre.
 */
function logEvent(orderId, kind, actor, detail = null) {
  return q.run('INSERT INTO order_events (order_id, kind, user_id, at, detail) VALUES (?, ?, ?, ?, ?)', orderId, kind, actor?.id ?? null, Date.now(), detail ? json.str(detail) : null);
}

export async function orderEvents(id) {
  const rows = await q.all(
    `SELECT e.id, e.kind, e.at, e.detail, e.user_id, u.name, u.role
       FROM order_events e LEFT JOIN users u ON u.id = e.user_id
      WHERE e.order_id = ? ORDER BY e.id`,
    Number(id),
  );
  return rows.map((r) => ({ id: r.id, kind: r.kind, at: r.at, detail: json.parse(r.detail, null), byId: r.user_id, byName: r.name ?? '', byRole: r.role ?? null }));
}

/* ---------------------------------------------------------------- lectura */

function serializeItem(r) {
  return {
    id: r.id,
    productId: r.product_id,
    categoryId: r.category_id,
    categoryName: r.category_name,
    name: r.name,
    icon: r.icon,
    image: r.image,
    imageFit: r.image_fit,
    optionLabel: r.option_label,
    optionName: r.option_name,
    qty: r.qty,
    unitPrice: r.unit_price,
    lineTotal: r.line_total,
    removed: json.parse(r.removed),
    aparte: json.parse(r.aparte),
    sauces: json.parse(r.sauces),
    extras: json.parse(r.extras),
    note: r.note,
    createdAt: r.created_at,
  };
}

function serializeOrder(r, items = [], names = new Map()) {
  return {
    id: r.id,
    turn: r.turn,
    businessDay: r.business_day,
    type: r.type,
    tableNumber: r.table_number,
    customerName: r.customer_name,
    phone: r.phone,
    address: r.address,
    addressRef: r.address_ref,
    deliveryFee: r.delivery_fee,
    note: r.note,
    status: r.status,
    subtotal: r.subtotal,
    total: r.total,
    paid: !!r.paid,
    paymentMethod: r.payment_method,
    amountReceived: r.amount_received,
    change: r.paid && r.amount_received != null ? Math.max(r.amount_received - r.total, 0) : 0,
    editCount: r.edit_count,
    cancelReason: r.cancel_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    readyAt: r.ready_at,
    deliveredAt: r.delivered_at,
    paidAt: r.paid_at,
    cancelledAt: r.cancelled_at,
    courierId: r.courier_id,
    courierName: names.get(r.courier_id) ?? '',
    dispatchedAt: r.dispatched_at,
    createdByName: names.get(r.created_by) ?? '',
    paidByName: names.get(r.paid_by) ?? '',
    items,
  };
}

async function withItems(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const byOrder = new Map(ids.map((id) => [id, []]));
  const items = await q.all(`SELECT * FROM order_items WHERE order_id IN (${placeholders(ids)}) ORDER BY sort, id`, ...ids);
  for (const it of items) byOrder.get(it.order_id)?.push(serializeItem(it));
  // nombres de quien tomó, cobró o lleva el pedido
  const people = [...new Set(rows.flatMap((r) => [r.courier_id, r.created_by, r.paid_by]).filter(Boolean))];
  const names = new Map(people.length ? (await q.all(`SELECT id, name FROM users WHERE id IN (${placeholders(people)})`, ...people)).map((u) => [u.id, u.name]) : []);
  return rows.map((r) => serializeOrder(r, byOrder.get(r.id), names));
}

export async function getOrder(id) {
  const row = await q.get('SELECT * FROM orders WHERE id = ?', Number(id));
  if (!row) throw new HttpError(404, 'Pedido no encontrado');
  return (await withItems([row]))[0];
}

/** Pedidos "vivos": en cocina, listos, en camino o entregados pendientes de cobro. */
export async function activeOrders() {
  return withItems(
    await q.all(`SELECT * FROM orders
           WHERE status IN ('recibido', 'listo', 'en_camino') OR (status = 'entregado' AND paid = 0)
           ORDER BY created_at, id`),
  );
}

export async function dayOrders(day) {
  return withItems(await q.all('SELECT * FROM orders WHERE business_day = ? ORDER BY turn DESC', day));
}

/** Domicilios de un repartidor: los que lleva y los que ya entregó hoy. */
export async function courierOrders(courierId, day) {
  day ??= await businessDay();
  const where = courierId == null ? '' : 'AND courier_id = ?';
  const args = courierId == null ? [] : [courierId];
  const [active, delivered] = await Promise.all([
    q.all(`SELECT * FROM orders WHERE status = 'en_camino' ${where} ORDER BY dispatched_at, id`, ...args),
    q.all(`SELECT * FROM orders WHERE status = 'entregado' AND courier_id IS NOT NULL AND business_day = ? ${where} ORDER BY delivered_at DESC`, day, ...args),
  ]);
  return { active: await withItems(active), delivered: await withItems(delivered) };
}

export async function nextTurn() {
  return (await q.get('SELECT COALESCE(MAX(turn), 0) + 1 AS n FROM orders WHERE business_day = ?', await businessDay())).n;
}

export async function daySummary(day) {
  const rows = await q.all('SELECT * FROM orders WHERE business_day = ?', day);
  const valid = rows.filter((r) => r.status !== 'cancelado');
  const paid = valid.filter((r) => r.paid);
  const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0]));
  for (const r of paid) byMethod[r.payment_method] = (byMethod[r.payment_method] ?? 0) + r.total;
  const byType = Object.fromEntries(ORDER_TYPES.map((t) => [t, 0]));
  for (const r of valid) byType[r.type]++;
  const prep = valid.filter((r) => r.ready_at).map((r) => r.ready_at - r.created_at);
  const sales = paid.reduce((s, r) => s + r.total, 0);
  const [byCourier, topProducts] = await Promise.all([
    q.all(
      `SELECT u.id, u.name,
              COUNT(*) AS orders,
              SUM(CASE WHEN o.status = 'entregado' THEN 1 ELSE 0 END) AS delivered,
              SUM(o.total) AS total,
              SUM(CASE WHEN o.paid = 0 THEN o.total ELSE 0 END) AS pending
         FROM orders o JOIN users u ON u.id = o.courier_id
        WHERE o.business_day = ? AND o.status IN ('en_camino', 'entregado')
        GROUP BY u.id ORDER BY orders DESC, u.name`,
      day,
    ),
    q.all(
      `SELECT oi.name, oi.icon, SUM(oi.qty) AS qty, SUM(oi.line_total) AS total
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.business_day = ? AND o.status != 'cancelado'
        GROUP BY oi.product_id, oi.name ORDER BY qty DESC, total DESC LIMIT 5`,
      day,
    ),
  ]);
  return {
    orders: valid.length,
    cancelled: rows.length - valid.length,
    sales,
    pending: valid.filter((r) => !r.paid).reduce((s, r) => s + r.total, 0),
    deliveryFees: valid.reduce((s, r) => s + r.delivery_fee, 0),
    avgTicket: paid.length ? Math.round(sales / paid.length) : 0,
    avgPrepMinutes: prep.length ? Math.round(prep.reduce((a, b) => a + b, 0) / prep.length / 60000) : null,
    byMethod,
    byType,
    // cuánto llevó y cuánto le falta entregar a la caja cada repartidor
    byCourier,
    topProducts,
  };
}

/* ------------------------------------------------------------ construcción */

function orderInfo(body, settings) {
  const type = body.type;
  if (!ORDER_TYPES.includes(type)) throw new HttpError(400, 'Elige si el pedido es para mesa, para llevar o domicilio');
  const info = {
    type,
    table_number: null,
    customer_name: str(body.customerName, 60),
    phone: str(body.phone, 30),
    address: '',
    address_ref: '',
    delivery_fee: 0,
    note: str(body.note, 400),
  };
  if (type === 'mesa') {
    const n = Math.round(Number(body.tableNumber));
    if (!(n >= 1 && n <= settings.tables)) throw new HttpError(400, 'Selecciona el número de mesa');
    info.table_number = n;
  }
  if (type === 'domicilio') {
    info.address = str(body.address, 160);
    if (!info.address) throw new HttpError(400, 'Falta la dirección del domicilio');
    info.address_ref = str(body.addressRef, 160);
    info.delivery_fee = money(body.deliveryFee);
  }
  return info;
}

/** Calcula precios en el servidor a partir del catálogo; el cliente solo envía elecciones. */
async function buildItems(list, prevItems = new Map()) {
  if (!Array.isArray(list) || !list.length) throw new HttpError(400, 'El pedido no tiene productos');
  const [sauceRows, extraRows, categoryRows] = await Promise.all([q.all('SELECT * FROM sauces'), q.all('SELECT * FROM extras'), q.all('SELECT * FROM categories')]);
  const sauces = new Map(sauceRows.map((s) => [s.id, s]));
  const extras = new Map(extraRows.map((e) => [e.id, e]));
  const categories = new Map(categoryRows.map((c) => [c.id, c]));

  const result = [];
  for (const [index, raw] of list.slice(0, 100).entries()) {
    const product = await q.get('SELECT * FROM products WHERE id = ?', Number(raw?.productId));
    if (!product) throw new HttpError(400, 'Uno de los productos ya no existe');
    const prev = raw.id != null ? prevItems.get(Number(raw.id)) : undefined;
    if (!prev && (!product.active || product.archived)) throw new HttpError(400, `${product.name} no está disponible`);

    const qty = Math.min(Math.max(Math.round(Number(raw.qty) || 1), 1), 99);
    const options = json.parse(product.options);
    let base = product.price;
    let optionName = '';
    if (options.length) {
      const opt = options.find((o) => o.name === raw.option);
      if (!opt) throw new HttpError(400, `Elige ${product.options_label.toLowerCase()} para ${product.name}`);
      optionName = opt.name;
      if (opt.price != null) base = opt.price;
    }

    const ingredients = json.parse(product.ingredients);
    const removed = uniqStrings(raw.removed).filter((i) => ingredients.includes(i));
    const aparte = uniqStrings(raw.aparte).filter((i) => ingredients.includes(i) && !removed.includes(i));

    const seenSauces = new Set();
    const itemSauces = !product.allow_sauces
      ? []
      : (Array.isArray(raw.sauces) ? raw.sauces : [])
          .map((s) => ({ sauce: sauces.get(Number(s?.id)), mode: s?.mode === 'aparte' ? 'aparte' : 'con' }))
          .filter(({ sauce }) => sauce && !seenSauces.has(sauce.id) && seenSauces.add(sauce.id))
          .map(({ sauce, mode }) => ({ id: sauce.id, name: sauce.name, color: sauce.color, mode }));

    const itemExtras = !product.allow_extras
      ? []
      : [...new Set((Array.isArray(raw.extras) ? raw.extras : []).map(Number))]
          .map((id) => extras.get(id))
          .filter(Boolean)
          .map((e) => ({ id: e.id, name: e.name, price: e.price }));

    const unit = base + itemExtras.reduce((s, e) => s + e.price, 0);
    result.push({
      prevId: prev ? prev.id : null,
      prevCreatedAt: prev ? prev.created_at : null,
      row: {
        product_id: product.id,
        category_id: product.category_id,
        category_name: categories.get(product.category_id)?.name ?? '',
        name: product.name,
        icon: product.icon,
        image: product.image,
        image_fit: product.image_fit,
        option_label: options.length ? product.options_label : '',
        option_name: optionName,
        qty,
        unit_price: unit,
        unit_cost: product.cost,
        line_total: unit * qty,
        removed: json.str(removed),
        aparte: json.str(aparte),
        sauces: json.str(itemSauces),
        extras: json.str(itemExtras),
        note: str(raw.note, 200),
        sort: index,
      },
    });
  }
  return result;
}

const ITEM_COLUMNS = ['product_id', 'category_id', 'category_name', 'name', 'icon', 'image', 'image_fit', 'option_label', 'option_name', 'qty', 'unit_price', 'unit_cost', 'line_total', 'removed', 'aparte', 'sauces', 'extras', 'note', 'sort'];

function insertItem(orderId, row, createdAt) {
  return q.run(
    `INSERT INTO order_items (order_id, ${ITEM_COLUMNS.join(', ')}, created_at) VALUES (?, ${ITEM_COLUMNS.map(() => '?').join(', ')}, ?)`,
    orderId,
    ...ITEM_COLUMNS.map((c) => row[c]),
    createdAt,
  );
}

function itemSignature(row) {
  return [row.product_id, row.option_name, row.qty, row.removed, row.aparte, row.sauces, row.extras, row.note].join('|');
}

function paymentFields(total, payment) {
  const method = payment?.method;
  if (!PAYMENT_METHODS.includes(method)) throw new HttpError(400, 'Elige el medio de pago');
  let received = total;
  if (method === 'efectivo' && payment.received != null && payment.received !== '') {
    received = money(payment.received);
    if (received < total) throw new HttpError(400, 'El efectivo recibido no alcanza para el total');
  }
  return { method, received };
}

/* ------------------------------------------------------------- escritura */

export async function createOrder(body, actor = null) {
  const settings = await getSettings();
  const now = Date.now();
  // quien toma pedidos no cobra: el cobro es un paso aparte en la caja
  if (body?.payment && !can(actor, 'orders.charge')) throw new HttpError(403, 'Tu usuario no cobra: envía el pedido y la caja lo cobra');
  const info = orderInfo(body ?? {}, settings);
  return tx(async () => {
    const built = await buildItems(body.items);
    const subtotal = built.reduce((s, b) => s + b.row.line_total, 0);
    const total = subtotal + info.delivery_fee;
    const day = await businessDay(now, settings);
    const turn = (await q.get('SELECT COALESCE(MAX(turn), 0) + 1 AS n FROM orders WHERE business_day = ?', day)).n;
    const pay = body.payment ? paymentFields(total, body.payment) : null;

    const { lastInsertRowid } = await q.run(
      `INSERT INTO orders (turn, business_day, type, table_number, customer_name, phone, address, address_ref, delivery_fee, note,
         status, subtotal, total, paid, payment_method, amount_received, created_at, updated_at, paid_at, created_by, paid_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recibido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      turn,
      day,
      info.type,
      info.table_number,
      info.customer_name,
      info.phone,
      info.address,
      info.address_ref,
      info.delivery_fee,
      info.note,
      subtotal,
      total,
      pay ? 1 : 0,
      pay?.method ?? null,
      pay?.received ?? null,
      now,
      now,
      pay ? now : null,
      actor?.id ?? null,
      pay ? (actor?.id ?? null) : null,
    );
    const id = Number(lastInsertRowid);
    for (const b of built) await insertItem(id, b.row, now);
    await logEvent(id, 'creado', actor, { turno: turn, tipo: info.type, total });
    if (pay) await logEvent(id, 'cobrado', actor, { metodo: pay.method, total, recibido: pay.received });
    return getOrder(id);
  });
}

export async function updateOrder(id, body, actor = null) {
  const settings = await getSettings();
  const now = Date.now();
  return tx(async () => {
    const order = await q.get('SELECT * FROM orders WHERE id = ?', Number(id));
    if (!order) throw new HttpError(404, 'Pedido no encontrado');
    if (order.status === 'cancelado') throw new HttpError(409, 'El pedido está cancelado');
    const info = orderInfo(body ?? {}, settings);
    const prevRows = await q.all('SELECT * FROM order_items WHERE order_id = ? ORDER BY sort, id', order.id);
    const prevMap = new Map(prevRows.map((r) => [r.id, r]));
    const built = await buildItems(body.items, prevMap);
    const subtotal = built.reduce((s, b) => s + b.row.line_total, 0);
    const total = subtotal + info.delivery_fee;
    if (order.paid && total !== order.total) {
      throw new HttpError(409, 'Este pedido ya fue cobrado y el total cambiaría. Registra lo adicional como un pedido nuevo.');
    }

    const before = prevRows.map(itemSignature).join('\n');
    const after = built.map((b) => itemSignature(b.row)).join('\n');
    const itemsChanged = before !== after;
    const backToKitchen = itemsChanged && order.status !== 'recibido';

    const keep = new Set(built.filter((b) => b.prevId).map((b) => b.prevId));
    for (const r of prevRows) if (!keep.has(r.id)) await q.run('DELETE FROM order_items WHERE id = ?', r.id);
    for (const b of built) {
      if (b.prevId) {
        await q.run(`UPDATE order_items SET ${ITEM_COLUMNS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...ITEM_COLUMNS.map((c) => b.row[c]), b.prevId);
      } else {
        await insertItem(order.id, b.row, now);
      }
    }

    // si deja de ser domicilio o vuelve a cocina, ya no tiene repartidor
    const dropCourier = backToKitchen || info.type !== 'domicilio';
    const status = backToKitchen ? 'recibido' : order.status === 'en_camino' && dropCourier ? 'listo' : order.status;

    await q.run(
      `UPDATE orders SET type = ?, table_number = ?, customer_name = ?, phone = ?, address = ?, address_ref = ?, delivery_fee = ?, note = ?,
         subtotal = ?, total = ?, updated_at = ?, edit_count = edit_count + ?, status = ?,
         ready_at = CASE WHEN ? THEN NULL ELSE ready_at END,
         delivered_at = CASE WHEN ? THEN NULL ELSE delivered_at END,
         courier_id = CASE WHEN ? THEN NULL ELSE courier_id END,
         dispatched_at = CASE WHEN ? THEN NULL ELSE dispatched_at END
       WHERE id = ?`,
      info.type,
      info.table_number,
      info.customer_name,
      info.phone,
      info.address,
      info.address_ref,
      info.delivery_fee,
      info.note,
      subtotal,
      total,
      now,
      itemsChanged ? 1 : 0,
      status,
      backToKitchen ? 1 : 0,
      backToKitchen ? 1 : 0,
      dropCourier ? 1 : 0,
      dropCourier ? 1 : 0,
      order.id,
    );
    await logEvent(order.id, 'editado', actor, { total, cambiaronProductos: itemsChanged, volvioACocina: backToKitchen });
    return { order: await getOrder(order.id), itemsChanged, backToKitchen, prevCourierId: order.courier_id };
  });
}

export async function findOrderRow(id) {
  const order = await q.get('SELECT * FROM orders WHERE id = ?', Number(id));
  if (!order) throw new HttpError(404, 'Pedido no encontrado');
  return order;
}

/**
 * recibido → vuelve a cocina · listo → sale de cocina · entregado → cerrado.
 * Volver a cocina o a "listo" le quita el repartidor a un domicilio en camino.
 */
export async function setStatus(id, status, actor = null) {
  if (!FLOW_STATUSES.includes(status)) throw new HttpError(400, 'Estado no válido');
  const order = await findOrderRow(id);
  if (order.status === 'cancelado') throw new HttpError(409, 'El pedido está cancelado');
  // un domicilio que ya salió con repartidor solo lo cierra él (este es el otro camino
  // a "entregado", aparte de deliverOrder: sin esto se podría cerrar el ajeno por aquí)
  if (status === 'entregado' && order.status === 'en_camino' && !canCloseDelivery(actor, order)) {
    throw new HttpError(403, 'Este domicilio lo cierra el repartidor que lo lleva');
  }
  const now = Date.now();
  if (status === 'recibido') {
    await q.run("UPDATE orders SET status = 'recibido', ready_at = NULL, delivered_at = NULL, courier_id = NULL, dispatched_at = NULL, updated_at = ? WHERE id = ?", now, order.id);
  } else if (status === 'listo') {
    await q.run(
      "UPDATE orders SET status = 'listo', ready_at = CASE WHEN status = 'recibido' THEN ? ELSE COALESCE(ready_at, ?) END, delivered_at = NULL, courier_id = NULL, dispatched_at = NULL, updated_at = ? WHERE id = ?",
      now,
      now,
      now,
      order.id,
    );
  } else {
    await q.run("UPDATE orders SET status = 'entregado', ready_at = COALESCE(ready_at, ?), delivered_at = ?, updated_at = ? WHERE id = ?", now, now, now, order.id);
  }
  const kind = status === 'recibido' ? 'devuelto_cocina' : status === 'listo' ? 'listo' : 'entregado';
  await logEvent(order.id, kind, actor, { desde: order.status });
  return { order: await getOrder(order.id), prevStatus: order.status, prevCourierId: order.courier_id };
}

export async function payOrder(id, payment, actor = null) {
  const order = await findOrderRow(id);
  if (order.status === 'cancelado') throw new HttpError(409, 'El pedido está cancelado');
  if (order.paid) throw new HttpError(409, 'Este pedido ya está cobrado');
  const pay = paymentFields(order.total, payment);
  const now = Date.now();
  await q.run('UPDATE orders SET paid = 1, payment_method = ?, amount_received = ?, paid_at = ?, paid_by = ?, updated_at = ? WHERE id = ?', pay.method, pay.received, now, actor?.id ?? null, now, order.id);
  await logEvent(order.id, 'cobrado', actor, { metodo: pay.method, total: order.total, recibido: pay.received });
  return getOrder(order.id);
}

export async function unpayOrder(id, actor = null) {
  const order = await findOrderRow(id);
  await q.run('UPDATE orders SET paid = 0, payment_method = NULL, amount_received = NULL, paid_at = NULL, paid_by = NULL, updated_at = ? WHERE id = ?', Date.now(), order.id);
  await logEvent(order.id, 'cobro_anulado', actor, { metodo: order.payment_method, total: order.total });
  return getOrder(order.id);
}

export async function cancelOrder(id, reason, actor = null) {
  const order = await findOrderRow(id);
  if (order.status === 'cancelado') throw new HttpError(409, 'El pedido ya estaba cancelado');
  const now = Date.now();
  await q.run("UPDATE orders SET status = 'cancelado', cancelled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?", now, str(reason, 200), now, order.id);
  await logEvent(order.id, 'cancelado', actor, { desde: order.status, motivo: str(reason, 200), estabaPagado: !!order.paid });
  return { order: await getOrder(order.id), prevStatus: order.status, prevCourierId: order.courier_id };
}

/* ------------------------------------------------------------- domicilios */

/** Asigna (o reasigna) el domicilio a un repartidor: queda "en camino". */
export function dispatchOrder(id, courierId, actor = null) {
  return tx(async () => {
    const order = await findOrderRow(id);
    if (order.type !== 'domicilio') throw new HttpError(400, 'Solo los domicilios se despachan con repartidor');
    if (!['listo', 'en_camino', 'recibido'].includes(order.status)) throw new HttpError(409, 'Este pedido ya no se puede despachar');
    const courier = await q.get("SELECT id, name FROM users WHERE id = ? AND role = 'repartidor' AND active = 1", Number(courierId));
    if (!courier) throw new HttpError(400, 'Elige un repartidor activo');
    const now = Date.now();
    await q.run(
      `UPDATE orders SET status = 'en_camino', courier_id = ?, ready_at = COALESCE(ready_at, ?),
         dispatched_at = CASE WHEN status = 'en_camino' THEN dispatched_at ELSE ? END, updated_at = ?
       WHERE id = ?`,
      courier.id,
      now,
      now,
      now,
      order.id,
    );
    await logEvent(order.id, 'despachado', actor, { repartidor: courier.name, repartidorId: courier.id, reasignado: order.status === 'en_camino', desde: order.status });
    return { order: await getOrder(order.id), prevStatus: order.status, prevCourierId: order.courier_id };
  });
}

/** Solo lo cierra el repartidor que lo lleva; el admin, únicamente para destrabarlo. */
export async function deliverOrder(id, actor) {
  const order = await findOrderRow(id);
  if (order.status !== 'en_camino') throw new HttpError(409, order.status === 'entregado' ? 'Este domicilio ya estaba entregado' : 'Este domicilio no está en camino');
  if (!canCloseDelivery(actor, order)) throw new HttpError(403, 'Este domicilio lo cierra el repartidor que lo lleva');
  const now = Date.now();
  await q.run("UPDATE orders SET status = 'entregado', delivered_at = ?, updated_at = ? WHERE id = ?", now, now, order.id);
  await logEvent(order.id, 'entregado', actor, { desde: order.status, porElAdmin: actor?.role === 'admin' && order.courier_id !== actor.id });
  return { order: await getOrder(order.id), prevStatus: order.status, prevCourierId: order.courier_id };
}
