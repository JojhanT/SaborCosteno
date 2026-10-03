import crypto from 'node:crypto';
import { broadcastEach, frame, onStreamConnect } from '../../core/events.js';
import { activeOrders, nextTurn } from './orders.service.js';

/*
 * Estado en vivo de los pedidos. Cada cambio envía el estado completo (así una
 * pantalla que se reconecta nunca queda desactualizada) más el evento que lo
 * causó, para los anuncios por voz y los avisos. Cada rol recibe solo lo suyo.
 */

function visibleOrders(user, orders) {
  switch (user?.role) {
    case 'admin':
    case 'mesero':
      return orders;
    // el cajero solo maneja plata: ve lo que falta por cobrar, en cualquier estado
    case 'cajero':
      return orders.filter((o) => !o.paid);
    case 'cocinero':
      return orders.filter((o) => o.status === 'recibido' || o.status === 'listo');
    case 'repartidor':
      return orders.filter((o) => o.status === 'en_camino' && o.courierId === user.id);
    default:
      return [];
  }
}

const groupOf = (user) =>
  user?.role === 'repartidor' ? `r:${user.id}` : user?.role === 'cocinero' ? 'k' : user?.role === 'cajero' ? 'c' : user?.role === 'admin' || user?.role === 'mesero' ? 'all' : 'none';

/** Un repartidor solo se entera de lo que tiene que ver con sus domicilios. */
function eventFor(user, event) {
  if (!event || user?.role !== 'repartidor') return event;
  return event.courierId === user.id || event.prevCourierId === user.id ? event : null;
}

function snapshot(user, orders, turn, event) {
  return { orders: visibleOrders(user, orders), nextTurn: turn, serverTime: Date.now(), event: eventFor(user, event) };
}

onStreamConnect(async (client) => frame('orders', snapshot(client.user, await activeOrders(), await nextTurn(), null)));

/**
 * @param {string} kind  created | updated | status | paid | unpaid | cancelled | call | dispatched
 * @param {{ by?: {id:number,name:string,role:string}|null, prevStatus?: string, prevCourierId?: number|null, itemsChanged?: boolean, backToKitchen?: boolean }} extra
 */
/** No se espera desde las rutas (es un efecto secundario): si falla, no debe tumbar la petición. */
export function emitOrders(kind, order, extra = {}) {
  emitOrdersAsync(kind, order, extra).catch((err) => console.error('No se pudo avisar el cambio del pedido:', err));
}

async function emitOrdersAsync(kind, order, extra = {}) {
  const event = {
    id: crypto.randomUUID(),
    kind,
    at: Date.now(),
    orderId: order?.id ?? null,
    turn: order?.turn ?? null,
    type: order?.type ?? null,
    tableNumber: order?.tableNumber ?? null,
    customerName: order?.customerName ?? '',
    status: order?.status ?? null,
    total: order?.total ?? 0,
    paid: !!order?.paid,
    courierId: order?.courierId ?? null,
    courierName: order?.courierName ?? '',
    items: (order?.items ?? []).map((i) => ({ qty: i.qty, name: i.name, optionName: i.optionName, categoryId: i.categoryId })),
    ...extra,
    prevCourierId: extra.prevCourierId ?? null,
    by: extra.by ?? null,
  };
  const [all, turn] = await Promise.all([activeOrders(), nextTurn()]);
  broadcastEach(
    'orders',
    (c) => groupOf(c.user),
    (c) => snapshot(c.user, all, turn, event),
  );
}
