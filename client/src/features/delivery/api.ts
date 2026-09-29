import { api } from '../../shared/lib/api';
import { toast, toastError } from '../../shared/components/ui';
import { money } from '../../shared/lib/format';
import type { Courier, Order } from '../../shared/types';

export async function fetchCouriers() {
  return (await api.get<{ couriers: Courier[] }>('/couriers')).couriers;
}

/** Despacha con un repartidor (o sin repartidor: se cierra como entregado). */
export async function dispatchOrder(order: Order, courier: Courier | null) {
  try {
    const updated = await api.post<Order>(`/orders/${order.id}/dispatch`, { courierId: courier?.id ?? null });
    if (courier) toast(`Turno #${order.turn} va con ${courier.name.split(' ')[0]}`, { text: order.paid ? 'Ya está pagado' : `Debe cobrar ${money(order.total)}`, art: 'domicilio' });
    else toast(`Turno #${order.turn} despachado`, { text: updated.paid ? 'Pedido cerrado' : 'Queda por cobrar', art: 'domicilio' });
    return updated;
  } catch (err) {
    toastError(err);
    return null;
  }
}

export async function markDelivered(order: Order) {
  try {
    const updated = await api.post<Order>(`/orders/${order.id}/deliver`);
    toast(`Turno #${order.turn} entregado`, { text: updated.paid ? 'Pedido cerrado' : `Entrega ${money(updated.total)} en la caja`, art: 'campana' });
    return updated;
  } catch (err) {
    toastError(err);
    return null;
  }
}

export interface MyDeliveries {
  active: Order[];
  delivered: Order[];
  summary: { toCollect: number; deliveredCount: number; deliveredTotal: number; owed: number };
}

export const fetchMine = () => api.get<MyDeliveries>('/delivery/mine');

/* ------------------------------------------------------ enlaces útiles */

const digits = (phone: string) => phone.replace(/\D/g, '');

export const telUrl = (phone: string) => `tel:${digits(phone)}`;

/** Celulares colombianos de 10 dígitos: se les pone el indicativo 57. */
export function whatsappUrl(phone: string) {
  const d = digits(phone);
  return `https://wa.me/${d.length === 10 ? `57${d}` : d}`;
}

export const mapsUrl = (o: Pick<Order, 'address' | 'addressRef'>) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([o.address, o.addressRef].filter(Boolean).join(', '))}`;
