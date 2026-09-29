import express from 'express';
import { requirePermission } from '../auth/permissions.js';
import { actorOf } from '../auth/auth.routes.js';
import { listCouriers } from '../users/users.service.js';
import { courierOrders, deliverOrder, dispatchOrder, setStatus } from '../orders/orders.service.js';
import { emitOrders } from '../orders/orders.feed.js';
import { idParam } from '../orders/orders.routes.js';

/*
 * Domicilios: la caja despacha un pedido listo con un repartidor, el
 * repartidor lo ve en su celular y lo marca como entregado.
 */

export const deliveryRouter = express.Router();

deliveryRouter.get('/couriers', requirePermission('orders.dispatch'), (_req, res) => res.json({ couriers: listCouriers() }));

/** Sin repartidor (lo llevó alguien del local): se cierra como entregado de una vez. */
deliveryRouter.post('/orders/:id/dispatch', requirePermission('orders.dispatch'), (req, res) => {
  const id = idParam(req);
  const courierId = req.body?.courierId;
  if (courierId == null) {
    const { order, prevStatus, prevCourierId } = setStatus(id, 'entregado');
    emitOrders('status', order, { prevStatus, prevCourierId, by: actorOf(req) });
    return res.json(order);
  }
  const { order, prevStatus, prevCourierId } = dispatchOrder(id, courierId);
  emitOrders('dispatched', order, { prevStatus, prevCourierId, by: actorOf(req) });
  res.json(order);
});

deliveryRouter.post('/orders/:id/deliver', requirePermission('orders.deliver'), (req, res) => {
  const { order, prevStatus, prevCourierId } = deliverOrder(idParam(req), req.user);
  emitOrders('status', order, { prevStatus, prevCourierId, by: actorOf(req) });
  res.json(order);
});

/** Lo que lleva el repartidor y lo que ya entregó hoy (el administrador ve los de todos). */
deliveryRouter.get('/delivery/mine', requirePermission('delivery.view'), (req, res) => {
  const { active, delivered } = courierOrders(req.user.role === 'repartidor' ? req.user.id : null);
  const unpaid = (list) => list.filter((o) => !o.paid).reduce((s, o) => s + o.total, 0);
  res.json({
    active,
    delivered,
    summary: {
      toCollect: unpaid(active),
      deliveredCount: delivered.length,
      deliveredTotal: delivered.reduce((s, o) => s + o.total, 0),
      owed: unpaid(delivered),
    },
  });
});
