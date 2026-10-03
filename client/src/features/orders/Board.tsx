import { memo, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Bike, Check, ChevronRight, Megaphone, Pencil, Repeat, Search, Truck, Wallet, X } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { useLive, useNow } from '../../shared/lib/live';
import { can, useMe } from '../../shared/lib/session';
import { TYPE_ART, elapsed, minutesText, money, orderPlace } from '../../shared/lib/format';
import { markDelivered } from '../delivery/api';
import { changeStatus, callTurn } from './actions';
import type { Order, OrderType } from '../../shared/types';
import './orders.css';

export interface BoardHandlers {
  onPay: (o: Order) => void;
  onEdit: (o: Order) => void;
  onDetail: (o: Order) => void;
  onDispatch: (o: Order) => void;
}

/** Qué puede hacer quien está mirando el tablero. */
export interface BoardPerms {
  manage: boolean;
  charge: boolean;
  kitchen: boolean;
  dispatch: boolean;
  userId: number | null;
  isAdmin: boolean;
}

/** Un domicilio en camino solo lo cierra el repartidor que lo lleva (o el admin). */
export const canCloseDelivery = (o: Order, p: BoardPerms) => p.isAdmin || (o.courierId != null && o.courierId === p.userId);

const FILTERS: { key: 'all' | OrderType; label: string; art?: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'mesa', label: 'Mesas', art: 'mesa' },
  { key: 'llevar', label: 'Llevar', art: 'llevar' },
  { key: 'domicilio', label: 'Domicilios', art: 'domicilio' },
];

const EMPTY: Record<string, string> = { recibido: 'Cocina al día', listo: 'Nada esperando', en_camino: 'Ningún domicilio en la calle', cobrar: 'Todo cobrado' };

export function Board(props: BoardHandlers) {
  const { orders, bootstrap } = useLive();
  const settings = bootstrap!.settings;
  const me = useMe();
  const perms = useMemo<BoardPerms>(
    () => ({
      manage: can(me, 'orders.manage'),
      charge: can(me, 'orders.charge'),
      kitchen: can(me, 'orders.kitchen'),
      dispatch: can(me, 'orders.dispatch'),
      userId: me?.user?.id ?? null,
      isAdmin: me?.user?.role === 'admin',
    }),
    [me],
  );
  // manejadores estables: así las tarjetas memorizadas no se redibujan sin motivo
  const ref = useRef(props);
  ref.current = props;
  const h = useMemo<BoardHandlers>(
    () => ({ onPay: (o) => ref.current.onPay(o), onEdit: (o) => ref.current.onEdit(o), onDetail: (o) => ref.current.onDetail(o), onDispatch: (o) => ref.current.onDispatch(o) }),
    [],
  );
  const [filter, setFilter] = useState<'all' | OrderType>('all');
  const [query, setQuery] = useState('');

  const q = query.toLowerCase().replace('#', '');
  const list = orders.filter((o) => (filter === 'all' || o.type === filter) && (!q || String(o.turn).includes(q) || o.customerName.toLowerCase().includes(q) || o.courierName.toLowerCase().includes(q)));
  const cols = [
    { key: 'recibido', title: 'En cocina', hint: 'Preparándose', art: 'cocina', orders: list.filter((o) => o.status === 'recibido') },
    { key: 'listo', title: 'Listos', hint: 'Para entregar o despachar', art: 'campana', orders: list.filter((o) => o.status === 'listo') },
    { key: 'en_camino', title: 'En camino', hint: 'Domicilios con repartidor', art: 'domicilio', orders: list.filter((o) => o.status === 'en_camino') },
    { key: 'cobrar', title: 'Por cobrar', hint: 'Entregados sin pagar', art: 'efectivo', orders: list.filter((o) => o.status === 'entregado' && !o.paid) },
  ];

  return (
    <div className="board">
      <header className="board-head">
        <div className="board-filters">
          {FILTERS.map((f) => {
            const n = f.key === 'all' ? orders.length : orders.filter((o) => o.type === f.key).length;
            return (
              <button key={f.key} className={`opt ${filter === f.key ? 'on' : ''}`} onClick={() => setFilter(f.key)}>
                {f.art && <Art name={f.art} />}
                {f.label}
                <span className="opt-count num">{n}</span>
              </button>
            );
          })}
        </div>
        <label className="search sm">
          <Search />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Turno, cliente o repartidor…" />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Limpiar">
              <X />
            </button>
          )}
        </label>
      </header>

      <LayoutGroup>
        <div className="board-cols">
          {cols.map((col) => (
            <section key={col.key} className={`bcol bcol-${col.key}`}>
              <header className="bcol-head">
                <span className="bcol-art">
                  <Art name={col.art} />
                </span>
                <div className="grow">
                  <h2 className="display">{col.title}</h2>
                  <span className="muted">{col.hint}</span>
                </div>
                <motion.b key={col.orders.length} className="bcol-count display num" initial={{ scale: 1.5 }} animate={{ scale: 1 }}>
                  {col.orders.length}
                </motion.b>
              </header>
              <div className="bcol-list">
                <AnimatePresence mode="popLayout">
                  {col.orders.map((o) => (
                    <BoardCard key={o.id} order={o} warn={settings.kitchenWarnMinutes} late={settings.kitchenLateMinutes} perms={perms} {...h} />
                  ))}
                </AnimatePresence>
                {col.orders.length === 0 && (
                  <div className="bcol-empty">
                    <span>{EMPTY[col.key]}</span>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}

function heatOf(o: Order, now: number, warn: number, late: number) {
  const mins = (now - o.createdAt) / 60000;
  return o.status !== 'recibido' ? '' : mins >= late ? 'late' : mins >= warn ? 'warn' : '';
}

/** Solo el reloj se actualiza cada segundo; la tarjeta completa no. */
function BoardTime({ order: o, warn, late }: { order: Order; warn: number; late: number }) {
  const now = useNow(1000);
  const text =
    o.status === 'recibido'
      ? elapsed(now - o.createdAt)
      : o.status === 'listo'
        ? `listo · ${minutesText(now - (o.readyAt ?? now))}`
        : o.status === 'en_camino'
          ? `salió · ${minutesText(now - (o.dispatchedAt ?? now))}`
          : minutesText(now - (o.deliveredAt ?? now));
  return <span className={`bcard-time num ${heatOf(o, now, warn, late)}`}>{text}</span>;
}

const BoardCard = memo(function BoardCard({ order: o, warn, late, perms, onPay, onEdit, onDetail, onDispatch }: BoardHandlers & { order: Order; warn: number; late: number; perms: BoardPerms }) {
  const [busy, setBusy] = useState(false);
  const now = useNow(10000);
  const heat = heatOf(o, now, warn, late);
  const units = o.items.reduce((s, i) => s + i.qty, 0);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <motion.article
      layout
      layoutId={`order-${o.id}`}
      className={`bcard type-${o.type} ${heat}`}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', damping: 26, stiffness: 300 }}
    >
      <button className="bcard-top" onClick={() => onDetail(o)}>
        <span className="bcard-turn display num">#{o.turn}</span>
        <span className="bcard-place">
          <span className="bcard-type-art">
            <Art name={TYPE_ART[o.type]} />
          </span>
          <span className="grow ellipsis">
            <b>{orderPlace(o, true)}</b>
            <small className="ellipsis">{o.type === 'domicilio' ? o.address : o.customerName || `${units} producto${units === 1 ? '' : 's'}`}</small>
          </span>
        </span>
        <BoardTime order={o} warn={warn} late={late} />
      </button>

      {o.courierName && (o.status === 'en_camino' || o.status === 'entregado') && (
        <div className="bcard-courier">
          <Bike /> {o.status === 'en_camino' ? 'Lo lleva' : 'Lo entregó'} <b>{o.courierName}</b>
        </div>
      )}

      <ul className="bcard-items">
        {o.items.slice(0, 4).map((i) => (
          <li key={i.id}>
            <b className="num">{i.qty}×</b> {i.name}
            {i.optionName && <em> · {i.optionName}</em>}
            {(i.removed.length > 0 || i.aparte.length > 0 || i.sauces.length > 0 || i.extras.length > 0 || i.note) && <span className="bcard-mod-dot" title="Tiene cambios" />}
          </li>
        ))}
        {o.items.length > 4 && <li className="muted">+{o.items.length - 4} más…</li>}
      </ul>

      <div className="bcard-foot">
        <div className="bcard-total">
          <b className="num">{money(o.total)}</b>
          {o.paid ? <span className="chip green">Pagado</span> : <span className="chip red">Sin pagar</span>}
          {o.editCount > 0 && <span className="chip gold">Editado</span>}
        </div>
        <div className="bcard-actions">
          {o.status === 'recibido' && (
            <>
              {perms.manage && (
                <button className="btn sm icon ghost" title="Editar pedido" onClick={() => onEdit(o)}>
                  <Pencil />
                </button>
              )}
              {!o.paid && perms.charge && (
                <button className="btn sm icon ghost" title="Cobrar" onClick={() => onPay(o)}>
                  <Wallet />
                </button>
              )}
              {perms.kitchen && (
                <button className="btn sm success" disabled={busy} onClick={() => run(() => changeStatus(o, 'listo'))}>
                  <Check /> Listo
                </button>
              )}
            </>
          )}
          {o.status === 'listo' && (
            <>
              {perms.manage && (
                <button className="btn sm icon ghost" title="Volver a llamar el turno" onClick={() => callTurn(o)}>
                  <Megaphone />
                </button>
              )}
              {!o.paid && perms.charge && (
                <button className="btn sm icon ghost" title="Cobrar" onClick={() => onPay(o)}>
                  <Wallet />
                </button>
              )}
              {o.type === 'domicilio'
                ? perms.dispatch && (
                    <button className="btn sm sea" disabled={busy} onClick={() => onDispatch(o)}>
                      <Truck /> Despachar
                    </button>
                  )
                : perms.kitchen && (
                    <button className="btn sm gold" disabled={busy} onClick={() => run(() => changeStatus(o, 'entregado'))}>
                      <Check /> Entregar
                    </button>
                  )}
            </>
          )}
          {o.status === 'en_camino' && (
            <>
              {perms.dispatch && (
                <button className="btn sm icon ghost" title="Pasar a otro repartidor" onClick={() => onDispatch(o)}>
                  <Repeat />
                </button>
              )}
              {!o.paid && perms.charge && (
                <button className="btn sm icon ghost" title="Cobrar" onClick={() => onPay(o)}>
                  <Wallet />
                </button>
              )}
              {/* lo cierra quien lo lleva: así el registro dice de verdad quién entregó */}
              {canCloseDelivery(o, perms) && (
                <button className="btn sm sea" disabled={busy} onClick={() => run(() => markDelivered(o))} title="Confirmar que llegó">
                  <Check /> Entregado
                </button>
              )}
            </>
          )}
          {o.status === 'entregado' && perms.charge && (
            <button className="btn sm primary" onClick={() => onPay(o)}>
              <Wallet /> Cobrar
            </button>
          )}
          <button className="btn sm icon ghost" title="Ver detalle" onClick={() => onDetail(o)}>
            <ChevronRight />
          </button>
        </div>
      </div>
    </motion.article>
  );
});
