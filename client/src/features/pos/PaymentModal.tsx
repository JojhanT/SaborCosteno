import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { Modal, ModalClose, AnimatedNumber } from '../../shared/components/ui';
import { METHODS, money, plain } from '../../shared/lib/format';
import type { PaymentMethod } from '../../shared/types';

interface Props {
  open: boolean;
  total: number;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payment: { method: PaymentMethod; received: number | null }) => void;
}

/** Billetes sugeridos por encima del total (lo que normalmente entrega el cliente). */
function suggestions(total: number) {
  const out = new Set<number>();
  for (const step of [1000, 5000, 10000, 20000, 50000]) {
    const v = Math.ceil(total / step) * step;
    if (v > total) out.add(v);
  }
  for (const bill of [20000, 50000, 100000]) if (bill > total) out.add(bill);
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

export function PaymentModal(props: Props) {
  return (
    <Modal open={props.open} onClose={props.onClose} className="pay" labelledBy="pay-title">
      <PaymentForm {...props} />
    </Modal>
  );
}

function PaymentForm({ total, title, subtitle, confirmLabel, busy, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [receivedText, setReceivedText] = useState('');
  const received = receivedText ? Number(receivedText.replace(/\D/g, '')) : null;
  const change = received != null ? received - total : 0;
  const short = method === 'efectivo' && received != null && received < total;
  const quick = useMemo(() => suggestions(total), [total]);

  const submit = () => {
    if (short || busy) return;
    onConfirm({ method, received: method === 'efectivo' ? (received ?? total) : null });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <ModalClose onClose={onClose} />
      <header className="pay-head">
        <div>
          <h2 id="pay-title" className="display">
            {title}
          </h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <div className="pay-total">
          <span>Total a cobrar</span>
          <b className="display num">{money(total)}</b>
        </div>
      </header>
      <div className="band thin" />

      <div className="pay-body">
        <div className="pay-methods">
          {METHODS.map((m) => (
            <button type="button" key={m.key} className={`pay-method ${method === m.key ? 'on' : ''}`} onClick={() => setMethod(m.key)}>
              <span className="pay-method-art">
                <Art name={m.art} accent={m.accent} />
              </span>
              <span>{m.label}</span>
              {method === m.key && (
                <motion.span layoutId="pay-check" className="pay-method-check">
                  <Check />
                </motion.span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence initial={false} mode="wait">
          {method === 'efectivo' ? (
            <motion.div key="cash" className="pay-cash" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="pay-cash-grid">
                <label className="field">
                  <span>¿Con cuánto paga?</span>
                  <div className="input-money pay-input">
                    <input
                      className="input num"
                      inputMode="numeric"
                      autoFocus
                      placeholder={plain(total)}
                      value={receivedText ? plain(Number(receivedText.replace(/\D/g, ''))) : ''}
                      onChange={(e) => setReceivedText(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    />
                  </div>
                </label>
                <div className={`pay-change ${short ? 'short' : change > 0 ? 'has' : ''}`}>
                  <span>{short ? 'Faltan' : 'Cambio'}</span>
                  <b className="display num">
                    <AnimatedNumber value={Math.abs(change)} format={money} />
                  </b>
                </div>
              </div>
              <div className="pay-quick">
                <button type="button" className={`pay-bill ${received === total || received == null ? 'on' : ''}`} onClick={() => setReceivedText('')}>
                  Exacto
                </button>
                {quick.map((v) => (
                  <button type="button" key={v} className={`pay-bill ${received === v ? 'on' : ''}`} onClick={() => setReceivedText(String(v))}>
                    {money(v)}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.p key="other" className="pay-note muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Verifica que el pago de <b>{money(total)}</b> haya llegado por {METHODS.find((m) => m.key === method)?.label}.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <footer className="pay-foot">
        <button type="button" className="btn ghost lg" onClick={onClose}>
          Volver
        </button>
        <button type="submit" className="btn success lg grow" disabled={short || busy}>
          {busy ? <span className="spinner" /> : <Check />}
          {confirmLabel ?? 'Confirmar pago'}
        </button>
      </footer>
    </form>
  );
}
