import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Bike, ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { toastError } from '../../shared/components/ui';
import { api } from '../../shared/lib/api';
import { useLive, useLiveEvents } from '../../shared/lib/live';
import { METHODS, METHOD_LABEL, STATUS_LABEL, TYPE_ART, clock, money, orderPlace, prettyDay } from '../../shared/lib/format';
import type { DaySummary, Order } from '../../shared/types';
import './accounting.css';

type StatusFilter = 'all' | 'open' | 'closed' | 'cancelado';

function shiftDay(day: string, delta: number) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return date.toISOString().slice(0, 10);
}

export function History({ onOpen }: { onOpen: (o: Order) => void }) {
  const { bootstrap } = useLive();
  const [day, setDay] = useState(bootstrap!.businessDay);
  const [data, setData] = useState<{ day: string; today: string; orders: Order[]; summary: DaySummary } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get(`/orders?day=${day}`));
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => void load(), [load]);
  // se refresca solo cuando algo cambia en la caja o la cocina
  useLiveEvents(() => {
    if (data && day === data.today) void load();
  });

  const s = data?.summary;
  const today = data?.today ?? bootstrap!.businessDay;
  const orders = (data?.orders ?? []).filter((o) => {
    const closed = o.status === 'entregado' && o.paid;
    if (status === 'open' && (closed || o.status === 'cancelado')) return false;
    if (status === 'closed' && !closed) return false;
    if (status === 'cancelado' && o.status !== 'cancelado') return false;
    if (!query) return true;
    const q = query.toLowerCase().replace('#', '');
    return (
      String(o.turn) === q ||
      o.customerName.toLowerCase().includes(q) ||
      o.address.toLowerCase().includes(q) ||
      o.courierName.toLowerCase().includes(q) ||
      o.items.some((i) => i.name.toLowerCase().includes(q))
    );
  });

  const methodRows = s ? METHODS.map((m) => ({ ...m, value: s.byMethod[m.key] ?? 0 })).sort((a, b) => b.value - a.value) : [];
  const maxMethod = Math.max(1, ...methodRows.map((m) => m.value));
  const maxTop = Math.max(1, ...(s?.topProducts ?? []).map((p) => p.qty));

  return (
    <div className="history">
      <header className="history-head">
        <div className="day-nav">
          <button className="btn icon outline" onClick={() => setDay(shiftDay(day, -1))} aria-label="Día anterior">
            <ChevronLeft />
          </button>
          <label className="day-pick">
            <span className="display">{day === today ? 'Hoy' : prettyDay(day)}</span>
            <small className="muted">{day === today ? prettyDay(day) : day}</small>
            <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Elegir fecha" />
          </label>
          <button className="btn icon outline" disabled={day >= today} onClick={() => setDay(shiftDay(day, 1))} aria-label="Día siguiente">
            <ChevronRight />
          </button>
          {day !== today && (
            <button className="btn sm ghost" onClick={() => setDay(today)}>
              Ir a hoy
            </button>
          )}
        </div>
        <button className="btn sm ghost" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </header>

      <div className="history-scroll">
        {s && (
          <section className="kpis">
            <div className="kpi hero">
              <span className="kpi-label">Ventas cobradas</span>
              <b className="kpi-value">{money(s.sales)}</b>
              <span className="kpi-sub">
                {s.orders} pedido{s.orders === 1 ? '' : 's'}
                {s.cancelled > 0 && ` · ${s.cancelled} cancelado${s.cancelled === 1 ? '' : 's'}`}
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Ticket promedio</span>
              <b className="kpi-value">{money(s.avgTicket)}</b>
            </div>
            <div className="kpi">
              <span className="kpi-label">Por cobrar</span>
              <b className={`kpi-value ${s.pending ? 'warn' : ''}`}>{money(s.pending)}</b>
            </div>
            <div className="kpi">
              <span className="kpi-label">Domicilios</span>
              <b className="kpi-value">{s.byType.domicilio}</b>
              <span className="kpi-sub">{money(s.deliveryFees)} en envíos</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Preparación promedio</span>
              <b className="kpi-value">{s.avgPrepMinutes != null ? `${s.avgPrepMinutes} min` : '—'}</b>
              <span className="kpi-sub">
                {s.byType.mesa} mesa · {s.byType.llevar} llevar
              </span>
            </div>
          </section>
        )}

        {s && s.orders > 0 && (
          <section className="history-panels">
            <div className="hpanel">
              <h3>Cobrado por medio de pago</h3>
              <ul className="barlist">
                {methodRows.map((m) => (
                  <li key={m.key} title={`${m.label}: ${money(m.value)}${s.sales ? ` (${Math.round((m.value / s.sales) * 100)}%)` : ''}`}>
                    <span className="barlist-label">
                      <span className="barlist-art">
                        <Art name={m.art} accent={m.accent} />
                      </span>
                      {m.label}
                    </span>
                    <span className="barlist-track">
                      <motion.span className="barlist-bar" initial={{ width: 0 }} animate={{ width: `${(m.value / maxMethod) * 100}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                    </span>
                    <span className="barlist-value num">{money(m.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="hpanel">
              <h3>Lo más vendido</h3>
              <ul className="barlist">
                {s.topProducts.map((p) => (
                  <li key={p.name} title={`${p.name}: ${p.qty} unidades · ${money(p.total)}`}>
                    <span className="barlist-label">
                      <span className="barlist-art">
                        <Art name={p.icon} />
                      </span>
                      <span className="ellipsis">{p.name}</span>
                    </span>
                    <span className="barlist-track">
                      <motion.span className="barlist-bar" initial={{ width: 0 }} animate={{ width: `${(p.qty / maxTop) * 100}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                    </span>
                    <span className="barlist-value num">{p.qty} und</span>
                  </li>
                ))}
              </ul>
            </div>
            {s.byCourier.length > 0 && (
              <div className="hpanel">
                <h3>Domicilios por repartidor</h3>
                <ul className="courier-rows">
                  {s.byCourier.map((c) => (
                    <li key={c.id}>
                      <span className="courier-rows-icon">
                        <Bike />
                      </span>
                      <span className="grow">
                        <b>{c.name}</b>
                        <small className="muted">
                          {c.delivered} entregado{c.delivered === 1 ? '' : 's'}
                          {c.orders > c.delivered && ` · ${c.orders - c.delivered} en camino`} · {money(c.total)}
                        </small>
                      </span>
                      {c.pending > 0 ? <span className="chip red" title="Pedidos sin cobrar que lleva o entregó">Debe {money(c.pending)}</span> : <span className="chip green">Al día</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="history-table">
          <header className="row">
            <div className="board-filters">
              {(
                [
                  ['all', 'Todos'],
                  ['open', 'Abiertos'],
                  ['closed', 'Cerrados'],
                  ['cancelado', 'Cancelados'],
                ] as [StatusFilter, string][]
              ).map(([k, label]) => (
                <button key={k} className={`opt ${status === k ? 'on' : ''}`} onClick={() => setStatus(k)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="spacer" />
            <label className="search sm">
              <Search />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Turno, cliente o producto…" />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Limpiar">
                  <X />
                </button>
              )}
            </label>
          </header>

          {orders.length === 0 ? (
            <div className="empty">
              <div className="art-wrap">
                <Art name="menu" />
              </div>
              <h3>{loading ? 'Cargando…' : 'Sin pedidos'}</h3>
              <p>{data?.orders.length ? 'Ningún pedido coincide con el filtro.' : 'Aún no hay pedidos registrados en este día.'}</p>
            </div>
          ) : (
            <table className="otable">
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>Hora</th>
                  <th>Pedido</th>
                  <th>Productos</th>
                  <th className="r">Total</th>
                  <th>Pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} onClick={() => onOpen(o)} className={o.status === 'cancelado' ? 'is-cancelled' : ''}>
                    <td>
                      <b className="display num otable-turn">#{o.turn}</b>
                    </td>
                    <td className="num muted">{clock(o.createdAt)}</td>
                    <td>
                      <span className={`otable-place type-${o.type}`}>
                        <span className="otable-art">
                          <Art name={TYPE_ART[o.type]} />
                        </span>
                        <span className="ellipsis">
                          {orderPlace(o)}
                          {o.courierName && <small className="muted"> · {o.courierName}</small>}
                        </span>
                      </span>
                    </td>
                    <td className="otable-items">
                      <span className="ellipsis">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</span>
                    </td>
                    <td className="r num">
                      <b>{money(o.total)}</b>
                    </td>
                    <td>{o.status === 'cancelado' ? <span className="muted">—</span> : o.paid ? <span className="chip green">{METHOD_LABEL[o.paymentMethod!]}</span> : <span className="chip red">Pendiente</span>}</td>
                    <td>
                      <span className={`chip ${o.status === 'cancelado' ? 'red' : o.status === 'listo' ? 'gold' : o.status === 'en_camino' ? 'sea' : o.status === 'entregado' ? '' : 'orange'}`}>{STATUS_LABEL[o.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
