import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Clock3, MapPin, MessageCircle, Navigation, Phone, StickyNote, Truck, Wallet } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { LivePill, Logo, SoundGate, ask, toast } from '../../shared/components/ui';
import { useLive, useLiveEvents, useNow } from '../../shared/lib/live';
import { METHOD_LABEL, clock, minutesText, money } from '../../shared/lib/format';
import { chime } from '../../shared/lib/voice';
import { useMe } from '../../shared/lib/session';
import { UserMenu } from '../auth/UserMenu';
import { fetchMine, mapsUrl, markDelivered, telUrl, whatsappUrl, type MyDeliveries } from './api';
import type { Order } from '../../shared/types';
import './delivery.css';

/** Pantalla del repartidor (pensada para el celular): sus domicilios y marcarlos entregados. */
export default function Delivery() {
  const me = useMe()!;
  const isCourier = me.user?.role === 'repartidor';
  const { orders } = useLive();
  const [mine, setMine] = useState<MyDeliveries | null>(null);
  const [showDone, setShowDone] = useState(false);

  // el servidor solo le manda a cada repartidor sus domicilios; el administrador los ve todos
  const active = useMemo(() => orders.filter((o) => o.status === 'en_camino').sort((a, b) => (a.dispatchedAt ?? 0) - (b.dispatchedAt ?? 0)), [orders]);
  const toCollect = active.filter((o) => !o.paid).reduce((s, o) => s + o.total, 0);

  const load = useCallback(() => {
    fetchMine()
      .then(setMine)
      .catch(() => null);
  }, []);
  useEffect(load, [load]);

  useLiveEvents((e) => {
    if (e.kind === 'dispatched' || e.kind === 'status' || e.kind === 'cancelled' || e.kind === 'updated') load();
    if (!isCourier || !e.turn) return;
    const myId = me.user!.id;
    if (e.kind === 'dispatched' && e.courierId === myId && e.prevCourierId !== myId) {
      chime('ready');
      navigator.vibrate?.([180, 90, 180]);
      toast(`Nuevo domicilio · turno #${e.turn}`, { text: e.paid ? 'Ya está pagado' : `Cobrar ${money(e.total)}`, art: 'domicilio', ms: 6000 });
    } else if (e.prevCourierId === myId && e.courierId !== myId && e.status !== 'entregado') {
      chime('new');
      toast(`El turno #${e.turn} ya no es tuyo`, { kind: 'info', text: e.courierId ? 'La caja se lo pasó a otro repartidor' : 'La caja lo quitó de tus domicilios' });
    } else if (e.kind === 'cancelled' && e.prevCourierId === myId) {
      chime('new');
      toast(`Turno #${e.turn} cancelado`, { kind: 'error', text: 'Comunícate con la caja' });
    }
  });

  const delivered = mine?.delivered ?? [];
  const owed = mine?.summary.owed ?? 0;

  return (
    <div className="dlv">
      <header className="dlv-top">
        <Logo kind="sc" tone="cream" className="dlv-logo" />
        <div className="dlv-title">
          <h1 className="display">{isCourier ? 'Mis domicilios' : 'Domicilios en camino'}</h1>
          <LivePill />
        </div>
        <UserMenu compact />
      </header>

      <section className="dlv-stats">
        <div className="dlv-stat">
          <b className="display num">{active.length}</b>
          <span>en camino</span>
        </div>
        <div className={`dlv-stat ${toCollect ? 'warn' : ''}`}>
          <b className="display num">{money(toCollect)}</b>
          <span>por cobrar a clientes</span>
        </div>
        <div className="dlv-stat">
          <b className="display num">{delivered.length}</b>
          <span>entregados hoy</span>
        </div>
      </section>

      <main className="dlv-list">
        <AnimatePresence mode="popLayout">
          {active.map((o) => (
            <DeliveryCard key={o.id} order={o} showCourier={!isCourier} onDelivered={load} />
          ))}
        </AnimatePresence>
        {active.length === 0 && (
          <div className="dlv-empty">
            <Logo kind="hat" className="dlv-empty-hat" />
            <h2 className="display">{isCourier ? 'Sin domicilios por ahora' : 'Nada en camino'}</h2>
            <p>{isCourier ? 'Cuando la caja te asigne uno, aparece aquí con sonido.' : 'Los domicilios despachados aparecen aquí.'}</p>
          </div>
        )}

        {delivered.length > 0 && (
          <section className="dlv-done">
            <button className="dlv-done-head" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
              <Check />
              <span className="grow">
                <b>Entregados hoy · {delivered.length}</b>
                {owed > 0 && <small>{money(owed)} por entregar en la caja</small>}
              </span>
              <ChevronDown className={showDone ? 'open' : ''} />
            </button>
            <AnimatePresence initial={false}>
              {showDone && (
                <motion.ul className="dlv-done-list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {delivered.map((o) => (
                    <li key={o.id}>
                      <b className="display num">#{o.turn}</b>
                      <span className="grow ellipsis">
                        {o.customerName || o.address}
                        {!isCourier && o.courierName && <small> · {o.courierName}</small>}
                      </span>
                      <span className="num muted">{o.deliveredAt ? clock(o.deliveredAt) : ''}</span>
                      <span className={`chip ${o.paid ? 'green' : 'red'}`}>{o.paid ? 'Cobrado' : money(o.total)}</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </section>
        )}
      </main>
      <SoundGate />
    </div>
  );
}

function DeliveryCard({ order: o, showCourier, onDelivered }: { order: Order; showCourier: boolean; onDelivered: () => void }) {
  const now = useNow(30000);
  const [busy, setBusy] = useState(false);
  const units = o.items.reduce((s, i) => s + i.qty, 0);

  const deliver = async () => {
    const ok = await ask({
      title: `¿Entregaste el turno #${o.turn}?`,
      text: o.paid ? 'El pedido ya estaba pagado.' : `Recuerda cobrar ${money(o.total)} y entregar la plata en la caja.`,
      confirm: 'Sí, entregado',
      art: 'domicilio',
    });
    if (!ok) return;
    setBusy(true);
    const r = await markDelivered(o);
    setBusy(false);
    if (r) onDelivered();
  };

  return (
    <motion.article
      layout
      className="dcard"
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', damping: 24, stiffness: 260 }}
    >
      <header className="dcard-head">
        <div className="dcard-turn">
          <span>Turno</span>
          <b className="display num">{o.turn}</b>
        </div>
        <div className="grow">
          <b className="dcard-name">{o.customerName || 'Cliente'}</b>
          <small>
            <Clock3 size={13} /> Salió {o.dispatchedAt ? `hace ${minutesText(now - o.dispatchedAt)}` : ''}
            {showCourier && o.courierName && ` · ${o.courierName}`}
          </small>
        </div>
        <span className="dcard-art">
          <Art name="domicilio" />
        </span>
      </header>

      <a className="dcard-address" href={mapsUrl(o)} target="_blank" rel="noreferrer">
        <MapPin />
        <span className="grow">
          <b>{o.address}</b>
          {o.addressRef && <small>{o.addressRef}</small>}
        </span>
        <span className="dcard-go">
          <Navigation /> Mapa
        </span>
      </a>

      {o.phone && (
        <div className="dcard-contact">
          <a className="btn outline" href={telUrl(o.phone)}>
            <Phone /> {o.phone}
          </a>
          <a className="btn outline" href={whatsappUrl(o.phone)} target="_blank" rel="noreferrer">
            <MessageCircle /> WhatsApp
          </a>
        </div>
      )}

      <ul className="dcard-items">
        {o.items.map((i) => (
          <li key={i.id}>
            <b className="num">{i.qty}×</b> {i.name}
            {i.optionName && <em> · {i.optionName}</em>}
          </li>
        ))}
      </ul>
      {o.note && (
        <p className="dcard-note">
          <StickyNote /> {o.note}
        </p>
      )}

      <div className={`dcard-money ${o.paid ? 'paid' : ''}`}>
        {o.paid ? (
          <>
            <Wallet />
            <span className="grow">
              <b>Ya está pagado</b>
              <small>{o.paymentMethod ? METHOD_LABEL[o.paymentMethod] : ''} · no cobres nada</small>
            </span>
          </>
        ) : (
          <>
            <Wallet />
            <span className="grow">
              <b>Cobrar al cliente</b>
              <small>
                {units} producto{units === 1 ? '' : 's'}
                {o.deliveryFee > 0 && ` · incluye domicilio ${money(o.deliveryFee)}`}
              </small>
            </span>
            <b className="dcard-total display num">{money(o.total)}</b>
          </>
        )}
      </div>

      <button className="btn sea lg dcard-done" disabled={busy} onClick={deliver}>
        {busy ? <span className="spinner" /> : <Truck />} Marcar entregado
      </button>
    </motion.article>
  );
}
