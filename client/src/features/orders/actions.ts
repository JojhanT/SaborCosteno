import { api } from '../../shared/lib/api';
import { ask, toast, toastError } from '../../shared/components/ui';
import type { Order, OrderStatus, PaymentMethod } from '../../shared/types';

export async function changeStatus(order: Order, status: Extract<OrderStatus, 'recibido' | 'listo' | 'entregado'>) {
  try {
    const updated = await api.post<Order>(`/orders/${order.id}/status`, { status });
    if (status === 'entregado' && updated.paid) toast(`Turno #${order.turn} cerrado`, { text: order.type === 'domicilio' ? 'Despachado y cobrado' : 'Entregado y cobrado', art: 'campana' });
    return updated;
  } catch (err) {
    toastError(err);
    return null;
  }
}

export async function payOrder(order: Order, payment: { method: PaymentMethod; received: number | null }) {
  try {
    const updated = await api.post<Order>(`/orders/${order.id}/pay`, payment);
    toast(updated.change > 0 ? `Cambio: $${updated.change.toLocaleString('es-CO')}` : `Turno #${order.turn} cobrado`, {
      text: updated.status === 'entregado' ? 'Pedido cerrado' : undefined,
      art: payment.method === 'efectivo' ? 'efectivo' : 'movil',
      ms: updated.change > 0 ? 6000 : 3200,
    });
    return updated;
  } catch (err) {
    toastError(err);
    return null;
  }
}

export async function unpayOrder(order: Order) {
  const ok = await ask({ title: `¿Anular el cobro del #${order.turn}?`, text: 'El pedido vuelve a quedar pendiente de pago.', confirm: 'Anular cobro', danger: true, art: 'efectivo' });
  if (!ok) return null;
  try {
    return await api.post<Order>(`/orders/${order.id}/unpay`);
  } catch (err) {
    toastError(err);
    return null;
  }
}

export async function callTurn(order: Order) {
  try {
    await api.post(`/orders/${order.id}/call`);
    toast(`Llamando al turno #${order.turn}`, { kind: 'info', art: 'turnos' });
  } catch (err) {
    toastError(err);
  }
}

export async function cancelOrder(order: Order) {
  const reason = await ask({
    title: `¿Cancelar el turno #${order.turn}?`,
    text: order.paid ? 'Este pedido ya estaba cobrado: recuerda devolver el dinero.' : 'Saldrá de la cocina y de las pantallas.',
    confirm: 'Cancelar pedido',
    danger: true,
    art: 'cocina',
    input: 'Motivo (opcional)',
  });
  if (reason === false) return null;
  try {
    const updated = await api.post<Order>(`/orders/${order.id}/cancel`, { reason: reason.trim() });
    toast(`Turno #${order.turn} cancelado`, { kind: 'info' });
    return updated;
  } catch (err) {
    toastError(err);
    return null;
  }
}
