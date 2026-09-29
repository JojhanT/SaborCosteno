import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Ban, Check, Minus, Plus, Split } from 'lucide-react';
import { Modal, ModalClose, Visual, AnimatedNumber } from '../../shared/components/ui';
import { money } from '../../shared/lib/format';
import { basePrice, unitPrice } from '../../shared/lib/pricing';
import { newKey } from './draft';
import type { CartLine, Catalog, Product, SauceMode } from '../../shared/types';

type IngState = 'normal' | 'sin' | 'aparte';

const NOTE_IDEAS = ['Bien tostada', 'Poco queso', 'Extra picante', 'Sin sal', 'Cortada en dos', 'Para niño'];

interface Props {
  product: Product;
  catalog: Catalog;
  initial?: CartLine | null;
  onClose: () => void;
  onSave: (line: CartLine, source: Element | null) => void;
}

export function ProductModal(props: Props) {
  return (
    <Modal open onClose={props.onClose} className="pm" labelledBy="pm-title">
      <ProductForm {...props} />
    </Modal>
  );
}

function ProductForm({ product, catalog, initial, onClose, onSave }: Props) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [option, setOption] = useState<string | null>(initial?.option ?? (product.options.length === 1 ? product.options[0].name : null));
  const [qty, setQty] = useState(initial?.qty ?? 1);
  const [ings, setIngs] = useState<Record<string, IngState>>(() => {
    const m: Record<string, IngState> = {};
    for (const i of product.ingredients) m[i] = initial?.removed.includes(i) ? 'sin' : initial?.aparte.includes(i) ? 'aparte' : 'normal';
    return m;
  });
  const [sauces, setSauces] = useState<Map<number, SauceMode>>(() => new Map((initial?.sauces ?? []).map((s) => [s.id, s.mode])));
  const [extras, setExtras] = useState<Set<number>>(() => new Set(initial?.extras ?? []));
  const [note, setNote] = useState(initial?.note ?? '');
  const [shake, setShake] = useState(0);

  const activeSauces = catalog.sauces.filter((s) => s.active || sauces.has(s.id));
  const activeExtras = catalog.extras.filter((e) => e.active || extras.has(e.id));
  const extrasMap = useMemo(() => new Map(catalog.extras.map((e) => [e.id, e])), [catalog.extras]);
  const category = catalog.categories.find((c) => c.id === product.categoryId);

  const line: CartLine = {
    key: initial?.key ?? newKey(),
    id: initial?.id,
    productId: product.id,
    qty,
    option,
    removed: product.ingredients.filter((i) => ings[i] === 'sin'),
    aparte: product.ingredients.filter((i) => ings[i] === 'aparte'),
    sauces: activeSauces.filter((s) => sauces.has(s.id)).map((s) => ({ id: s.id, mode: sauces.get(s.id)! })),
    extras: [...extras],
    note: note.trim(),
  };
  const unit = unitPrice(product, line, extrasMap);
  const missingOption = product.options.length > 0 && !option;
  const showPrices = product.options.some((o) => o.price != null);

  const cycleIng = (i: string) => setIngs((m) => ({ ...m, [i]: m[i] === 'normal' ? 'sin' : m[i] === 'sin' ? 'aparte' : 'normal' }));
  const cycleSauce = (id: number) =>
    setSauces((m) => {
      const next = new Map(m);
      const cur = next.get(id);
      if (!cur) next.set(id, 'con');
      else if (cur === 'con') next.set(id, 'aparte');
      else next.delete(id);
      return next;
    });
  const toggleExtra = (id: number) =>
    setExtras((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    if (missingOption) {
      setShake((n) => n + 1);
      return;
    }
    onSave(line, heroRef.current);
  };

  return (
    <form
      className="pm-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <ModalClose onClose={onClose} />
      <div className="pm-grid">
        <aside className="pm-hero">
          <div ref={heroRef} className="pm-hero-visual">
            <Visual image={product.image} imageFit={product.imageFit} icon={product.icon} alt={product.name} />
          </div>
          <div className="pm-hero-info">
            {category && <span className="chip orange">{category.name}</span>}
            <h2 id="pm-title" className="display">
              {product.name}
            </h2>
            {product.description && <p>{product.description}</p>}
          </div>
          <div className="band" />
        </aside>

        <div className="pm-body">
          {product.options.length > 0 && (
            <motion.section className="pm-sec" key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : undefined} transition={{ duration: 0.4 }}>
              <header>
                <h3>{product.optionsLabel}</h3>
                <span className={`pm-req ${missingOption ? 'need' : 'ok'}`}>{missingOption ? 'Elige una' : <Check />}</span>
              </header>
              <div className="pm-opts">
                {product.options.map((o) => {
                  const price = basePrice(product, o.name);
                  const on = option === o.name;
                  return (
                    <button type="button" key={o.name} className={`pm-opt ${on ? 'on' : ''}`} onClick={() => setOption(o.name)} onDoubleClick={() => onSave({ ...line, option: o.name }, heroRef.current)}>
                      <span className="pm-opt-name">{o.name}</span>
                      {showPrices && <span className="pm-opt-price num">{money(price)}</span>}
                      {on && (
                        <motion.span layoutId={`opt-check-${product.id}`} className="pm-opt-check">
                          <Check />
                        </motion.span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}

          {product.ingredients.length > 0 && (
            <section className="pm-sec">
              <header>
                <h3>Ingredientes</h3>
                <div className="pm-legend">
                  <span>
                    <i className="lg normal" /> Normal
                  </span>
                  <span>
                    <i className="lg sin" /> Sin
                  </span>
                  <span>
                    <i className="lg aparte" /> Aparte
                  </span>
                </div>
              </header>
              <div className="pm-chips">
                {product.ingredients.map((i) => (
                  <button type="button" key={i} className={`ing ing-${ings[i]}`} onClick={() => cycleIng(i)}>
                    <span className="ing-icon">{ings[i] === 'normal' ? <Check /> : ings[i] === 'sin' ? <Ban /> : <Split />}</span>
                    <span className="ing-name">{i}</span>
                    {ings[i] !== 'normal' && <span className="ing-tag">{ings[i] === 'sin' ? 'SIN' : 'APARTE'}</span>}
                  </button>
                ))}
              </div>
              <p className="pm-hint">Toca una vez para quitar, dos para ponerlo aparte.</p>
            </section>
          )}

          {product.allowSauces && activeSauces.length > 0 && (
            <section className="pm-sec">
              <header>
                <h3>Salsas</h3>
                <div className="row">
                  <button type="button" className="btn sm ghost" onClick={() => setSauces(new Map(activeSauces.map((s) => [s.id, 'con'])))}>
                    Todas
                  </button>
                  <button type="button" className="btn sm ghost" onClick={() => setSauces(new Map())}>
                    Ninguna
                  </button>
                </div>
              </header>
              <div className="pm-chips">
                {activeSauces.map((s) => {
                  const mode = sauces.get(s.id);
                  return (
                    <button type="button" key={s.id} className={`sauce ${mode ? `sauce-${mode}` : ''}`} style={{ '--sauce': s.color } as CSSProperties} onClick={() => cycleSauce(s.id)}>
                      <span className="sauce-drop" />
                      <span>{s.name}</span>
                      {mode === 'aparte' && <span className="ing-tag">APARTE</span>}
                    </button>
                  );
                })}
              </div>
              <p className="pm-hint">Toca una vez para ponerla encima, dos para aparte, tres para quitarla.</p>
            </section>
          )}

          {product.allowExtras && activeExtras.length > 0 && (
            <section className="pm-sec">
              <header>
                <h3>Adiciones</h3>
                {extras.size > 0 && <span className="chip green">+{money(line.extras.reduce((s, id) => s + (extrasMap.get(id)?.price ?? 0), 0))}</span>}
              </header>
              <div className="pm-extras">
                {activeExtras.map((e) => {
                  const on = extras.has(e.id);
                  return (
                    <button type="button" key={e.id} className={`extra ${on ? 'on' : ''}`} onClick={() => toggleExtra(e.id)}>
                      <span className="extra-check">{on ? <Check /> : <Plus />}</span>
                      <span className="extra-name">{e.name}</span>
                      <span className="extra-price num">+{money(e.price)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="pm-sec">
            <header>
              <h3>Nota para la cocina</h3>
            </header>
            <input className="input" value={note} maxLength={200} placeholder="Ej: bien tostadas, cortar en dos…" onChange={(e) => setNote(e.target.value)} />
            <div className="pm-ideas">
              {NOTE_IDEAS.map((n) => (
                <button type="button" key={n} className="chip" onClick={() => setNote((v) => (v ? `${v}, ${n.toLowerCase()}` : n))}>
                  {n}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <footer className="pm-foot">
        <div className="stepper">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Menos">
            <Minus />
          </button>
          <motion.b key={qty} initial={{ scale: 1.4, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="num display">
            {qty}
          </motion.b>
          <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Más">
            <Plus />
          </button>
        </div>
        <div className="pm-foot-sum muted num">
          {qty} × {money(unit)}
        </div>
        <button type="submit" className="btn primary lg pm-add">
          <span>{initial ? 'Guardar cambios' : missingOption ? `Elige ${product.optionsLabel.toLowerCase()}` : 'Agregar al pedido'}</span>
          <span className="pm-add-total num">
            <AnimatedNumber value={unit * qty} format={money} />
          </span>
        </button>
      </footer>
    </form>
  );
}
