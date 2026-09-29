import type { Order, OrderStatus, OrderType, PaymentMethod } from '../types';

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export const money = (n: number) => cop.format(Math.round(n || 0)).replace(/\s/g, ' ');
export const plain = (n: number) => num.format(Math.round(n || 0));

export const clock = (ts: number, withSeconds = false) =>
  new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}), hour12: true });

export function elapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function minutesText(ms: number) {
  const m = Math.floor(Math.max(0, ms) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const TYPE_LABEL: Record<OrderType, string> = { mesa: 'Mesa', llevar: 'Para llevar', domicilio: 'Domicilio' };
export const TYPE_ART: Record<OrderType, string> = { mesa: 'mesa', llevar: 'llevar', domicilio: 'domicilio' };

export const STATUS_LABEL: Record<OrderStatus, string> = {
  recibido: 'En cocina',
  listo: 'Listo',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const METHODS: { key: PaymentMethod; label: string; art: string; accent?: string }[] = [
  { key: 'efectivo', label: 'Efectivo', art: 'efectivo' },
  { key: 'nequi', label: 'Nequi', art: 'movil', accent: '#C21A7E' },
  { key: 'daviplata', label: 'Daviplata', art: 'movil', accent: '#E1251B' },
  { key: 'tarjeta', label: 'Tarjeta', art: 'tarjeta' },
  { key: 'transferencia', label: 'Transferencia', art: 'banco' },
];
export const METHOD_LABEL = Object.fromEntries(METHODS.map((m) => [m.key, m.label])) as Record<PaymentMethod, string>;

/** "Mesa 4", "Para llevar · Ana", "Domicilio · Cra 5 #3-20" */
export function orderPlace(o: Pick<Order, 'type' | 'tableNumber' | 'customerName' | 'address'>, short = false) {
  if (o.type === 'mesa') return `Mesa ${o.tableNumber}`;
  if (o.type === 'llevar') return o.customerName && !short ? `Para llevar · ${o.customerName}` : 'Para llevar';
  return short ? 'Domicilio' : `Domicilio · ${o.address}`;
}

export function todayISO(timeZone = 'America/Bogota') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function prettyDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
