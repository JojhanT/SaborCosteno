import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, MapPin, Truck, UserX } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { Modal, ModalClose, toastError } from '../../shared/components/ui';
import { money } from '../../shared/lib/format';
import { initials } from '../../shared/lib/session';
import { dispatchOrder, fetchCouriers } from './api';
import type { Courier, Order } from '../../shared/types';
import './delivery.css';

/** La caja elige quién lleva el domicilio (o lo reasigna si ya va en camino). */
export function DispatchModal({ order, onClose, onDone }: { order: Order | null; onClose: () => void; onDone?: (o: Order) => void }) {
  return (
    <Modal open={!!order} onClose={onClose} className="dispatch" labelledBy="dispatch-title">
      {order && <DispatchForm order={order} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function DispatchForm({ order: o, onClose, onDone }: { order: Order; onClose: () => void; onDone?: (o: Order) => void }) {
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [picked, setPicked] = useState<number | null>(o.courierId);
  const [busy, setBusy] = useState(false);
  const reassign = o.status === 'en_camino';

  useEffect(() => {
    fetchCouriers()
      .then((list) => {
        setCouriers(list);
        // con un solo repartidor no hay nada que elegir
        if (list.length === 1 && !o.courierId) setPicked(list[0].id);
      })
      .catch((err) => {
        toastError(err);
        setCouriers([]);
      });
  }, [o.courierId]);

  const courier = couriers?.find((c) => c.id === picked) ?? null;

  const go = async (c: Courier | null) => {
    setBusy(true);
    const updated = await dispatchOrder(o, c);
    setBusy(false);
    if (updated) {
      onDone?.(updated);
      onClose();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (courier) void go(courier);
      }}
    >
      <ModalClose onClose={onClose} />
      <header className="dispatch-head type-domicilio">
        <span className="dispatch-art">
          <Art name="domicilio" />
        </span>
        <div className="grow">
          <h2 id="dispatch-title" className="display">
            {reassign ? 'Reasignar' : 'Despachar'} turno #{o.turn}
          </h2>
          <p>
            <MapPin size={14} /> {o.address}
            {o.addressRef && <small> · {o.addressRef}</small>}
          </p>
        </div>
      </header>
      <div className="band thin" />

      <div className="dispatch-body">
        <p className={`dispatch-money ${o.paid ? 'paid' : ''}`}>
          {o.paid ? (
            <>
              <Check /> Ya está pagado · el repartidor no cobra nada
            </>
          ) : (
            <>
              El repartidor debe cobrar <b className="num">{money(o.total)}</b>
            </>
          )}
        </p>

        <h3>¿Quién lo lleva?</h3>
        {!couriers ? (
          <div className="spinner" />
        ) : couriers.length === 0 ? (
          <p className="dispatch-empty muted">
            No hay repartidores activos. Créalos en <b>Menú y ajustes → Usuarios</b> con el rol <b>Repartidor</b>.
          </p>
        ) : (
          <div className="courier-grid">
            {couriers.map((c) => (
              <button type="button" key={c.id} className={`courier ${picked === c.id ? 'on' : ''}`} onClick={() => setPicked(c.id)} onDoubleClick={() => void go(c)}>
                <span className="uavatar">{initials(c.name)}</span>
                <span className="grow">
                  <b>{c.name}</b>
                  <small>{c.id === o.courierId ? 'Lo lleva ahora' : c.active ? `${c.active} en camino` : 'Libre'}</small>
                </span>
                {picked === c.id && (
                  <motion.span layoutId="courier-check" className="courier-check">
                    <Check />
                  </motion.span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="dispatch-foot">
        {!reassign && (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void go(null)} title="Lo entregó alguien del local: se marca entregado de una vez">
            <UserX /> Sin repartidor
          </button>
        )}
        <div className="spacer" />
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn sea" disabled={!courier || busy || (reassign && courier.id === o.courierId)}>
          {busy ? <span className="spinner" /> : <Truck />}
          {courier ? `${reassign ? 'Pasar a' : 'Despachar con'} ${courier.name.split(' ')[0]}` : 'Elige un repartidor'}
        </button>
      </footer>
    </form>
  );
}
