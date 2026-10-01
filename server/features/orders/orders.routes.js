import express from 'express';
import { HttpError } from '../../core/http-error.js';
import { businessDay } from '../settings/settings.service.js';
import { can, requirePermission } from '../auth/permissions.js';
import { actorOf } from '../auth/auth.routes.js';
import { activeOrders, dayOrders, daySummary, getOrder, nextTurn, createOrder, updateOrder, setStatus, payOrder, unpayOrder, cancelOrder, findOrderRow } from './orders.service.js';
import { emitOrders } from './orders.feed.js';

export const ordersRouter = express.Router();

const manage = requirePermission('orders.manage');

export const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identificador no válido');
  return id;
};

ordersRouter.get('/orders/active', manage, async (_req, res) => res.json({ orders: await activeOrders(), nextTurn: await nextTurn(), serverTime: Date.now() }));

/** Historial y cuadre de un día (la contabilidad de la caja). */
ordersRouter.get('/orders', requirePermission('reports.view'), async (req, res) => {
  const today = await businessDay();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(req.query.day ?? '') ? req.query.day : today;
  res.json({ day, today, orders: await dayOrders(day), summary: await daySummary(day) });
});

ordersRouter.get('/orders/:id', requirePermission('orders.manage', 'reports.view'), async (req, res) => res.json(await getOrder(idParam(req))));

ordersRouter.post('/orders', manage, async (req, res) => {
  const order = await createOrder(req.body ?? {}, req.user);
  emitOrders('created', order, { by: actorOf(req) });
  if (order.paid) emitOrders('paid', order, { by: actorOf(req) });
  res.status(201).json(order);
});

ordersRouter.put('/orders/:id', manage, async (req, res) => {
  const { order, itemsChanged, backToKitchen, prevCourierId } = await updateOrder(idParam(req), req.body ?? {});
  emitOrders('updated', order, { itemsChanged, backToKitchen, prevCourierId, by: actorOf(req) });
  res.json(order);
});

/**
 * La caja mueve el pedido a cualquier estado. La cocina solo puede marcarlo
 * listo o devolverlo a la cocina (para deshacer un "listo" por error).
 */
ordersRouter.post('/orders/:id/status', requirePermission('orders.kitchen'), async (req, res) => {
  const id = idParam(req);
  const status = req.body?.status;
  if (!can(req.user, 'orders.manage')) {
    const current = (await findOrderRow(id)).status;
    const allowed = (current === 'recibido' && status === 'listo') || (current === 'listo' && status === 'recibido');
    if (!allowed) throw new HttpError(403, current === status ? 'El pedido ya estaba así' : 'Desde la cocina solo se marca listo o se devuelve a preparación');
  }
  const { order, prevStatus, prevCourierId } = await setStatus(id, status);
  if (prevStatus !== order.status) emitOrders('status', order, { prevStatus, prevCourierId, by: actorOf(req) });
  res.json(order);
});

ordersRouter.post('/orders/:id/pay', manage, async (req, res) => {
  const order = await payOrder(idParam(req), req.body ?? {}, req.user);
  emitOrders('paid', order, { by: actorOf(req) });
  res.json(order);
});

ordersRouter.post('/orders/:id/unpay', manage, async (req, res) => {
  const order = await unpayOrder(idParam(req));
  emitOrders('unpaid', order, { by: actorOf(req) });
  res.json(order);
});

ordersRouter.post('/orders/:id/cancel', manage, async (req, res) => {
  const { order, prevStatus, prevCourierId } = await cancelOrder(idParam(req), req.body?.reason);
  emitOrders('cancelled', order, { prevStatus, prevCourierId, by: actorOf(req) });
  res.json(order);
});

/** Vuelve a anunciar un turno en las pantallas (sin cambiar nada). */
ordersRouter.post('/orders/:id/call', manage, async (req, res) => {
  const order = await getOrder(idParam(req));
  emitOrders('call', order, { by: actorOf(req) });
  res.json({ ok: true });
});
