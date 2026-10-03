import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChefHat, Minus, Pencil, Plus, StickyNote, Trash2, Undo2, Wallet, X } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { AnimatedNumber, Logo, Visual, ask, toast, toastError } from '../../shared/components/ui';
import { ItemMods, lineMods } from '../../shared/components/ItemMods';
import { money, plain } from '../../shared/lib/format';
import { indexCatalog, linePrice } from '../../shared/lib/pricing';
import { api } from '../../shared/lib/api';
import { useLive } from '../../shared/lib/live';
import { useCan } from '../../shared/lib/session';
import { draftActions, draftPayload, useDraft } from './draft';
import { PaymentModal } from './PaymentModal';
import type { CartLine, Order, OrderType, PaymentMethod } from '../../shared/types';

const TYPES: { key: OrderType; label: string; art: string }[] = [
  { key: 'mesa', label: 'Mesa', art: 'mesa' },
  { key: 'llevar', label: 'Para llevar', art: 'llevar' },
  { key: 'domicilio', label: 'Domicilio', art: 'domicilio' },
];

export const Cart = memo(function Cart({ onEditLine }: { onEditLine: (line: CartLine) => void }) {
  const { bootstrap, orders, nextTurn } = useLive();
  const settings = bootstrap!.settings;
  const catalog = bootstrap!.catalog;
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const draft = useDraft();
  const canCharge = useCan('orders.charge');
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [flash, setFlash] = useState<{ order: Order; edited: boolean } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const fee = draft.type === 'domicilio' ? (draft.deliveryFee ?? settings.defaultDeliveryFee) : 0;
  const subtotal = draft.lines.reduce((s, l) => {
    const p = idx.products.get(l.productId);
    return s + (p ? linePrice(p, l, idx.extras) : 0);
  }, 0);
  const total = subtotal + fee;
  const units = draft.lines.reduce((s, l) => s + l.qty, 0);
  const editing = draft.editingId != null;
  const paidTotalChanged = editing && draft.editingPaid && total !== draft.editingTotal;

  const occupied = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const o of orders) if (o.type === 'mesa' && o.tableNumber && o.id !== draft.editingId) m.set(o.tableNumber, [...(m.get(o.tableNumber) ?? []), o.turn]);
    return m;
  }, [orders, draft.editingId]);

  const validate = () => {
    if (!draft.lines.length) return 'items';
    if (!draft.type) return 'type';
    if (draft.type === 'mesa' && !draft.tableNumber) return 'table';
    if (draft.type === 'domicilio' && !draft.address.trim()) return 'address';
    return null;
  };

  useEffect(() => {
    if (problem && validate() !== problem) setProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const MESSAGES: Record<string, string> = {
    items: 'Agrega al menos un producto',
    type: '¿Es para mesa, para llevar o domicilio?',
    table: 'Selecciona el número de mesa',
    address: 'Falta la dirección del domicilio',
  };

  const guard = () => {
    const p = validate();
    if (p) {
      setProblem(null);
      requestAnimationFrame(() => setProblem(p));
      if (p === 'table') setTablesOpen(true);
      toast(MESSAGES[p], { kind: 'error' });
      return false;
    }
    return true;
  };

  const send = async (payment?: { method: PaymentMethod; received: number | null }) => {
    if (!guard() || busy) return;
    setBusy(true);
    try {
      const body = { ...draftPayload(draft, settings.defaultDeliveryFee), ...(payment ? { payment } : {}) };
      const order = editing ? await api.put<Order>(`/orders/${draft.editingId}`, body) : await api.post<Order>('/orders', body);
      setPaying(false);
      draftActions.reset();
      setTablesOpen(true);
      setNoteOpen(false);
      setFlash({ order, edited: editing });
      setTimeout(() => setFlash(null), 1900);
      if (editing) toast(`Turno #${order.turn} actualizado`, { text: order.status === 'recibido' ? 'La cocina ya ve los cambios' : undefined, art: 'cocina' });
      else if (order.paid && order.change > 0) toast(`Cambio: ${money(order.change)}`, { text: `Turno #${order.turn} cobrado y enviado a cocina`, art: 'efectivo', ms: 6000 });
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!draft.lines.length && !editing) return draftActions.reset();
    const ok = await ask({
      title: editing ? '¿Descartar la edición?' : '¿Vaciar el pedido?',
      text: editing ? 'El pedido original queda como estaba.' : 'Se quitarán todos los productos.',
      confirm: editing ? 'Descartar' : 'Vaciar',
      danger: true,
      art: 'llevar',
    });
    if (ok) {
      draftActions.reset();
      setTablesOpen(true);
    }
  };

  return (
    <aside className={`cart ${editing ? 'is-editing' : ''}`}>
      <header className="cart-head">
        <div className="cart-turn">
          <span>{editing ? 'Editando' : 'Nuevo pedido'}</span>
          <b className="display num">#{editing ? draft.editingTurn : nextTurn}</b>
        </div>
        <div className="spacer" />
        {(draft.lines.length > 0 || editing || draft.type) && (
          <button className="btn sm ghost" onClick={discard}>
            {editing ? <Undo2 /> : <Trash2 />}
            {editing ? 'Descartar' : 'Vaciar'}
          </button>
        )}
      </header>

      <div className="cart-scroll">
        <div className={`svc ${problem === 'type' ? 'problem' : ''}`}>
          {TYPES.map((t) => (
            <button key={t.key} className={`svc-tile type-${t.key} ${draft.type === t.key ? 'on' : ''}`} onClick={() => draftActions.setType(t.key)}>
              <span className="svc-art">
                <Art name={t.art} />
              </span>
              <span className="svc-label">{t.label}</span>
              {draft.type === t.key && <motion.span layoutId="svc-on" className="svc-ring" transition={{ type: 'spring', damping: 26, stiffness: 360 }} />}
            </button>
          ))}
        </div>

        <AnimatePresence initial={false} mode="wait">
          {draft.type === 'mesa' && (
            <motion.section key="mesa" className="svc-detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              {tablesOpen || !draft.tableNumber ? (
                <div className={`tables ${problem === 'table' ? 'problem' : ''}`}>
                  {Array.from({ length: settings.tables }, (_, i) => i + 1).map((n) => {
                    const busyTurns = occupied.get(n);
                    return (
                      <button
                        key={n}
                        className={`table-btn ${draft.tableNumber === n ? 'on' : ''} ${busyTurns ? 'busy' : ''}`}
                        onClick={() => {
                          draftActions.set({ tableNumber: n });
                          setTablesOpen(false);
                        }}
                        title={busyTurns ? `Ocupada · turno ${busyTurns.join(', ')}` : `Mesa ${n}`}
                      >
                        <b className="num">{n}</b>
                        {busyTurns && <i />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <button className="svc-summary" onClick={() => setTablesOpen(true)}>
                  <span className="svc-summary-num display num">{draft.tableNumber}</span>
                  <span className="grow">
                    <b>Mesa {draft.tableNumber}</b>
                    {occupied.get(draft.tableNumber) && <small>Ya tiene el turno #{occupied.get(draft.tableNumber)!.join(', #')}</small>}
                  </span>
                  <Pencil />
                </button>
              )}
            </motion.section>
          )}

          {draft.type === 'llevar' && (
            <motion.section key="llevar" className="svc-detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <label className="field">
                <span>Nombre del cliente (opcional)</span>
                <input className="input" value={draft.customerName} placeholder="Para llamarlo cuando esté listo" onChange={(e) => draftActions.set({ customerName: e.target.value })} />
              </label>
            </motion.section>
          )}

          {draft.type === 'domicilio' && (
            <motion.section key="domicilio" className="svc-detail delivery" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="delivery-grid">
                <label className="field">
                  <span>Cliente</span>
                  <input className="input" value={draft.customerName} placeholder="Nombre" onChange={(e) => draftActions.set({ customerName: e.target.value })} />
                </label>
                <label className="field">
                  <span>Teléfono</span>
                  <input className="input" value={draft.phone} inputMode="tel" placeholder="300 000 0000" onChange={(e) => draftActions.set({ phone: e.target.value })} />
                </label>
                <label className={`field span2 ${problem === 'address' ? 'problem' : ''}`}>
                  <span>Dirección *</span>
                  <input className="input" value={draft.address} placeholder="Calle 00 # 00 - 00" onChange={(e) => draftActions.set({ address: e.target.value })} />
                </label>
                <label className="field span2">
                  <span>Barrio / referencia</span>
                  <input className="input" value={draft.addressRef} placeholder="Barrio, casa, apto, punto de referencia" onChange={(e) => draftActions.set({ addressRef: e.target.value })} />
                </label>
              </div>
              <div className="fee">
                <span className="fee-label">
                  <Art name="domicilio" /> Valor del domicilio
                </span>
                <div className="fee-opts">
                  {settings.deliveryFeePresets.map((v) => (
                    <button key={v} className={`fee-btn ${fee === v ? 'on' : ''}`} onClick={() => draftActions.set({ deliveryFee: v })}>
                      {money(v)}
                    </button>
                  ))}
                  <div className="input-money fee-custom">
                    <input
                      className="input num"
                      inputMode="numeric"
                      placeholder="Otro"
                      value={settings.deliveryFeePresets.includes(fee) ? '' : plain(fee)}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '');
                        draftActions.set({ deliveryFee: v ? Math.min(Number(v), 999999) : null });
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <div className={`cart-lines ${problem === 'items' ? 'problem' : ''}`} data-cart-target>
          <AnimatePresence initial={false}>
            {draft.lines.map((line) => {
              const product = idx.products.get(line.productId);
              if (!product) return null;
              const mods = lineMods(line, idx);
              return (
                <motion.div
                  key={line.key}
                  layout
                  className="cline"
                  initial={{ opacity: 0, x: 40, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                >
                  <button className="cline-main" onClick={() => onEditLine(line)} title="Editar">
                    <Visual className="cline-thumb" image={product.image} imageFit={product.imageFit} icon={product.icon} />
                    <span className="cline-text">
                      <span className="cline-title">
                        {product.name}
                        {line.option && <em>{line.option}</em>}
                      </span>
                      <ItemMods mods={mods} />
                    </span>
                  </button>
                  <div className="cline-side">
                    <b className="num">{money(linePrice(product, line, idx.extras))}</b>
                    <div className="qty">
                      <button onClick={() => draftActions.setQty(line.key, line.qty - 1)} aria-label="Menos">
                        {line.qty === 1 ? <X /> : <Minus />}
                      </button>
                      <span className="num">{line.qty}</span>
                      <button onClick={() => draftActions.setQty(line.key, line.qty + 1)} aria-label="Más">
                        <Plus />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {draft.lines.length === 0 && (
            <div className="cart-empty">
              <div className="cart-empty-art">
                <Art name="salchipapa" />
              </div>
              <b>Toca un producto para empezar</b>
              <span>Las salsas, ingredientes y adiciones se eligen al agregarlo.</span>
            </div>
          )}
        </div>

        {draft.lines.length > 0 &&
          (noteOpen || draft.note ? (
            <label className="field cart-note">
              <span>Nota general del pedido</span>
              <textarea className="input" rows={2} value={draft.note} autoFocus={noteOpen && !draft.note} placeholder="Ej: el cliente espera afuera, entregar todo junto…" onChange={(e) => draftActions.set({ note: e.target.value })} />
            </label>
          ) : (
            <button className="btn sm ghost cart-note-btn" onClick={() => setNoteOpen(true)}>
              <StickyNote /> Agregar nota al pedido
            </button>
          ))}
      </div>

      <footer className="cart-foot">
        <div className="totals">
          <div className="totals-row">
            <span>
              Subtotal · {units} producto{units === 1 ? '' : 's'}
            </span>
            <span className="num">{money(subtotal)}</span>
          </div>
          {draft.type === 'domicilio' && (
            <div className="totals-row">
              <span>Domicilio</span>
              <span className="num">{money(fee)}</span>
            </div>
          )}
          <div className="totals-total">
            <span>Total</span>
            <b className="display num">
              <AnimatedNumber value={total} format={money} />
            </b>
          </div>
        </div>
        {paidTotalChanged && <p className="cart-warn">Este pedido ya fue cobrado: el total no puede cambiar. Lo adicional va en un pedido nuevo.</p>}
        {editing ? (
          <button className="btn primary lg block" disabled={busy || paidTotalChanged} onClick={() => send()}>
            {busy ? <span className="spinner" /> : <ChefHat />}
            Guardar cambios
          </button>
        ) : canCharge ? (
          <div className="cart-actions">
            <button className="btn outline lg" disabled={busy} onClick={() => send()} title="El cliente paga después">
              <ChefHat />
              <span>
                Enviar
                <small>cobrar después</small>
              </span>
            </button>
            <button className="btn primary lg" disabled={busy} onClick={() => guard() && setPaying(true)}>
              <Wallet />
              <span>
                Cobrar y enviar
                <small className="num">{money(total)}</small>
              </span>
            </button>
          </div>
        ) : (
          // quien toma pedidos no cobra: el cliente paga en la caja
          <button className="btn primary lg block" disabled={busy} onClick={() => send()}>
            {busy ? <span className="spinner" /> : <ChefHat />}
            <span>
              Enviar a cocina
              <small className="num">{money(total)} · se cobra en la caja</small>
            </span>
          </button>
        )}
      </footer>

      <PaymentModal open={paying} total={total} title={`Cobrar turno #${nextTurn}`} subtitle="Al confirmar, el pedido sale a cocina" confirmLabel="Cobrar y enviar a cocina" busy={busy} onClose={() => setPaying(false)} onConfirm={(p) => send(p)} />

      <AnimatePresence>
        {flash && (
          <motion.div className="cart-flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ y: -80, rotate: -20, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={{ type: 'spring', damping: 11, stiffness: 180 }}>
              <Logo kind="hat" className="cart-flash-hat" />
            </motion.div>
            <motion.b className="display num" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 260, delay: 0.1 }}>
              #{flash.order.turn}
            </motion.b>
            <span>{flash.edited ? 'Pedido actualizado' : '¡Enviado a cocina!'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
});
