import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Ban, Bike, Check, ChefHat, History, Megaphone, MapPin, Pencil, Phone, Repeat, RotateCcw, StickyNote, Truck, Undo2, User, UserCheck, Wallet } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { Modal, ModalClose, Visual } from '../../shared/components/ui';
import { ItemMods } from '../../shared/components/ItemMods';
import { api } from '../../shared/lib/api';
import { useLive } from '../../shared/lib/live';
import { can, ROLE_LABEL, useMe } from '../../shared/lib/session';
import { METHOD_LABEL, STATUS_LABEL, TYPE_ART, clock, minutesText, money, orderPlace } from '../../shared/lib/format';
import { markDelivered } from '../delivery/api';
import { canCloseDelivery, type BoardPerms } from './Board';
import { callTurn, cancelOrder, changeStatus, unpayOrder } from './actions';
import type { Order, OrderEvent } from '../../shared/types';
import './orders.css';

/** Cómo se lee cada línea de la bitácora. */
const EVENT_LABEL: Record<OrderEvent['kind'], string> = {
  creado: 'Tomó el pedido',
  editado: 'Editó el pedido',
  listo: 'Lo marcó listo',
  devuelto_cocina: 'Lo devolvió a cocina',
  despachado: 'Lo despachó',
  entregado: 'Lo entregó',
  cobrado: 'Cobró',
  cobro_anulado: 'Anuló el cobro',
  cancelado: 'Canceló el pedido',
};

interface Props {
  order: Order | null;
  onClose: () => void;
  onPay: (o: Order) => void;
  onEdit: (o: Order) => void;
  onDispatch: (o: Order) => void;
}

export function OrderDetail({ order, onClose, onPay, onEdit, onDispatch }: Props) {
  return (
    <Modal open={!!order} onClose={onClose} className="detail" labelledBy="detail-title">
      {order && <DetailBody initial={order} onClose={onClose} onPay={onPay} onEdit={onEdit} onDispatch={onDispatch} />}
    </Modal>
  );
}

const STATUS_CHIP: Record<Order['status'], string> = { recibido: 'orange', listo: 'gold', en_camino: 'sea', entregado: 'green', cancelado: 'red' };

function DetailBody({ initial, onClose, onPay, onEdit, onDispatch }: Omit<Props, 'order'> & { initial: Order }) {
  const { orders } = useLive();
  const [local, setLocal] = useState(initial);
  const [events, setEvents] = useState<OrderEvent[] | null>(null);
  const live = orders.find((o) => o.id === initial.id);
  useEffect(() => {
    if (live && live.updatedAt >= local.updatedAt) setLocal(live);
  }, [live, local.updatedAt]);
  const o = local;
  const apply = (u: Order | null) => u && setLocal(u);
  const delivery = o.type === 'domicilio';

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

  // la bitácora solo se pide al abrir el detalle, no en el tablero
  useEffect(() => {
    let alive = true;
    api
      .get<{ events: OrderEvent[] }>(`/orders/${o.id}/events`)
      .then((r) => alive && setEvents(r.events))
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [o.id, o.updatedAt]);

  /** Quién hizo ese paso, según la bitácora (la última vez que pasó). */
  const lastBy = (kind: OrderEvent['kind']) => [...(events ?? [])].reverse().find((e) => e.kind === kind)?.byName ?? '';

  const steps = [
    { label: 'Recibido', at: o.createdAt, icon: <ChefHat />, by: o.createdByName || lastBy('creado') },
    { label: 'Listo', at: o.readyAt, icon: <Check />, by: lastBy('listo') },
    ...(delivery ? [{ label: o.courierName ? `Salió con ${o.courierName.split(' ')[0]}` : 'Despachado', at: o.dispatchedAt, icon: <Bike />, by: lastBy('despachado') }] : []),
    { label: 'Entregado', at: o.deliveredAt, icon: delivery ? <Truck /> : <Check />, by: lastBy('entregado') },
    { label: o.paid ? `Cobrado · ${METHOD_LABEL[o.paymentMethod!] ?? ''}` : 'Sin cobrar', at: o.paidAt, icon: <Wallet />, by: o.paidByName || lastBy('cobrado') },
  ];
  const cancelled = o.status === 'cancelado';

  return (
    <>
      <ModalClose onClose={onClose} />
      <header className={`detail-head type-${o.type}`}>
        <div className="detail-turn">
          <span>Turno</span>
          <b id="detail-title" className="display num">
            #{o.turn}
          </b>
        </div>
        <div className="detail-place">
          <span className="detail-type-art">
            <Art name={TYPE_ART[o.type]} />
          </span>
          <div>
            <h3 className="display">{orderPlace(o, true)}</h3>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <span className={`chip ${STATUS_CHIP[o.status]}`}>{STATUS_LABEL[o.status]}</span>
              {!cancelled && (o.paid ? <span className="chip green">Pagado</span> : <span className="chip red">Sin pagar</span>)}
              {o.editCount > 0 && <span className="chip gold">Editado {o.editCount}×</span>}
            </div>
          </div>
        </div>
      </header>
      <div className="band thin" />

      <div className="detail-body">
        {(o.customerName || o.phone || o.address || o.courierName) && (
          <div className="detail-customer">
            {o.customerName && (
              <span>
                <User /> {o.customerName}
              </span>
            )}
            {o.phone && (
              <span>
                <Phone /> {o.phone}
              </span>
            )}
            {o.courierName && (
              <span className="courier-line">
                <Bike /> {o.status === 'en_camino' ? 'Lo lleva' : 'Lo llevó'} {o.courierName}
              </span>
            )}
            {o.address && (
              <span className="wide">
                <MapPin /> {o.address}
                {o.addressRef && <small> · {o.addressRef}</small>}
              </span>
            )}
          </div>
        )}

        <div className="detail-items">
          {o.items.map((i) => (
            <div key={i.id} className="ditem">
              <Visual className="ditem-thumb" image={i.image} imageFit={i.imageFit} icon={i.icon} />
              <div className="grow">
                <div className="ditem-title">
                  <b className="num">{i.qty}×</b> {i.name}
                  {i.optionName && <em>{i.optionName}</em>}
                </div>
                <ItemMods mods={i} />
              </div>
              <b className="num">{money(i.lineTotal)}</b>
            </div>
          ))}
        </div>

        {o.note && (
          <p className="detail-note">
            <StickyNote /> {o.note}
          </p>
        )}

        <div className="detail-totals">
          <div>
            <span>Subtotal</span>
            <span className="num">{money(o.subtotal)}</span>
          </div>
          {delivery && (
            <div>
              <span>Domicilio</span>
              <span className="num">{money(o.deliveryFee)}</span>
            </div>
          )}
          <div className="big">
            <span>Total</span>
            <b className="num">{money(o.total)}</b>
          </div>
          {o.paid && o.paymentMethod === 'efectivo' && o.amountReceived != null && (
            <div className="muted">
              <span>
                Recibido {money(o.amountReceived)} · cambio {money(o.change)}
              </span>
            </div>
          )}
        </div>

        {cancelled ? (
          <p className="detail-cancel">
            <Ban /> Cancelado a las {clock(o.cancelledAt!)}
            {o.cancelReason && ` · ${o.cancelReason}`}
          </p>
        ) : (
          <ol className="timeline" style={{ '--steps': steps.length } as CSSProperties}>
            {steps.map((s, i) => (
              <li key={i} className={s.at ? 'done' : ''}>
                <span className="tl-dot">{s.icon}</span>
                <span className="tl-label">{s.label}</span>
                <span className="tl-time num">{s.at ? clock(s.at) : '—'}</span>
                {(s.by || (i === 1 && o.readyAt)) && (
                  <small className="muted">{[s.at && s.by, i === 1 && o.readyAt ? `${minutesText(o.readyAt - o.createdAt)} de preparación` : ''].filter(Boolean).join(' · ')}</small>
                )}
              </li>
            ))}
          </ol>
        )}

        {(o.createdByName || o.paidByName) && (
          <p className="detail-staff muted">
            <UserCheck />
            {o.createdByName && (
              <span>
                Tomado por <b>{o.createdByName}</b>
              </span>
            )}
            {o.paidByName && (
              <span>
                Cobrado por <b>{o.paidByName}</b>
              </span>
            )}
          </p>
        )}

        {!!events?.length && (
          <details className="detail-log">
            <summary>
              <History /> Bitácora · {events.length} movimiento{events.length === 1 ? '' : 's'}
            </summary>
            <ol>
              {events.map((e) => (
                <li key={e.id}>
                  <span className="dlog-time num">{clock(e.at)}</span>
                  <span className="dlog-what">{EVENT_LABEL[e.kind] ?? e.kind}</span>
                  <span className="dlog-who">{e.byName ? <b>{e.byName}</b> : <i>sistema</i>}{e.byRole && <small> · {ROLE_LABEL[e.byRole]}</small>}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>

      {!cancelled && (
        <footer className="detail-foot">
          <div className="detail-actions">
            {o.status !== 'recibido' && perms.kitchen && (
              <button className="btn sm outline" onClick={async () => apply(await changeStatus(o, 'recibido'))}>
                <RotateCcw /> Volver a cocina
              </button>
            )}
            {o.status === 'listo' && perms.manage && (
              <button className="btn sm outline" onClick={() => callTurn(o)}>
                <Megaphone /> Llamar
              </button>
            )}
            {o.status === 'en_camino' && perms.dispatch && (
              <button className="btn sm outline" onClick={() => onDispatch(o)}>
                <Repeat /> Otro repartidor
              </button>
            )}
            {perms.manage && (
              <button className="btn sm outline" onClick={() => onEdit(o)}>
                <Pencil /> Editar
              </button>
            )}
            {o.paid && perms.charge && (
              <button className="btn sm outline" onClick={async () => apply(await unpayOrder(o))}>
                <Undo2 /> Anular cobro
              </button>
            )}
            {perms.manage && (
              <button
                className="btn sm danger"
                onClick={async () => {
                  const u = await cancelOrder(o);
                  if (u) apply(u);
                }}
              >
                <Ban /> Cancelar
              </button>
            )}
          </div>
          <div className="detail-main-actions">
            {!o.paid && perms.charge && (
              <button className="btn primary" onClick={() => onPay(o)}>
                <Wallet /> Cobrar {money(o.total)}
              </button>
            )}
            {o.status === 'recibido' && perms.kitchen && (
              <button className="btn success" onClick={async () => apply(await changeStatus(o, 'listo'))}>
                <Check /> Marcar listo
              </button>
            )}
            {o.status === 'listo' &&
              (delivery
                ? perms.dispatch && (
                    <button className="btn sea" onClick={() => onDispatch(o)}>
                      <Truck /> Despachar
                    </button>
                  )
                : perms.kitchen && (
                    <button className="btn gold" onClick={async () => apply(await changeStatus(o, 'entregado'))}>
                      <Check /> Entregar
                    </button>
                  ))}
            {o.status === 'en_camino' && canCloseDelivery(o, perms) && (
              <button className="btn sea" onClick={async () => apply(await markDelivered(o))}>
                <Check /> Marcar entregado
              </button>
            )}
          </div>
        </footer>
      )}
    </>
  );
}
