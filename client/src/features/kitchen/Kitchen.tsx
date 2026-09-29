import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, Flame, PencilLine, StickyNote, Timer, Wallet } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { Clock, LivePill, Logo, SoundGate, Visual, toast, toastError, useIdleCursor, useWakeLock } from '../../shared/components/ui';
import { TvSettings, VoiceSettings } from '../../shared/components/TvSettings';
import { ItemMods } from '../../shared/components/ItemMods';
import { useLive, useLiveEvents, useNow } from '../../shared/lib/live';
import { usePrefs } from '../../shared/lib/storage';
import { announce, DEFAULT_VOICE, fillTemplate, type VoicePrefs } from '../../shared/lib/voice';
import { TYPE_ART, clock, elapsed, minutesText, orderPlace } from '../../shared/lib/format';
import { api } from '../../shared/lib/api';
import { useCan } from '../../shared/lib/session';
import type { Order, OrderType } from '../../shared/types';
import { useKitchenLayout } from './useKitchenLayout';
import './kitchen.css';

interface KitchenPrefs {
  columns: number; // 0 = automático
  scale: number;
  categories: number[] | null;
  voice: VoicePrefs;
  readItems: boolean;
  /** Botón «Listo» en cada tarjeta (para pantallas táctiles o con mouse). */
  doneButton: boolean;
}

const DEFAULTS: KitchenPrefs = { columns: 0, scale: 1, categories: null, voice: DEFAULT_VOICE, readItems: false, doneButton: true };

/** Marca el pedido listo: sale de la cocina y la caja recibe el aviso. */
async function markReady(o: Order) {
  try {
    await api.post(`/orders/${o.id}/status`, { status: 'listo' });
    toast(`Turno #${o.turn} listo`, {
      text: `${orderPlace(o, true)} · ya le avisamos a la caja`,
      art: 'campana',
      action: {
        label: 'Deshacer',
        onClick: () => void api.post(`/orders/${o.id}/status`, { status: 'recibido' }).catch(toastError),
      },
    });
  } catch (err) {
    toastError(err);
  }
}

const TYPE_SPEECH: Record<OrderType, (o: { tableNumber: number | null }) => string> = {
  mesa: (o) => `mesa ${o.tableNumber}`,
  llevar: () => 'para llevar',
  domicilio: () => 'domicilio',
};

export default function Kitchen() {
  const { orders, bootstrap } = useLive();
  const settings = bootstrap!.settings;
  const catalog = bootstrap!.catalog;
  const [prefs, setPrefs] = usePrefs<KitchenPrefs>('sabor.kitchen', DEFAULTS);
  const idle = useIdleCursor();
  const canMark = useCan('orders.kitchen');
  const showDone = canMark && prefs.doneButton;
  const onDone = useCallback((o: Order) => markReady(o), []);
  useWakeLock();

  const catOrder = useMemo(() => new Map(catalog.categories.map((c, i) => [c.id, i])), [catalog.categories]);
  const allowed = prefs.categories ? new Set(prefs.categories) : null;

  const queue = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'recibido')
        .map((o) => ({
          ...o,
          items: o.items.filter((i) => !allowed || allowed.has(i.categoryId)).sort((a, b) => (catOrder.get(a.categoryId) ?? 99) - (catOrder.get(b.categoryId) ?? 99)),
        }))
        .filter((o) => o.items.length > 0)
        .sort((a, b) => a.createdAt - b.createdAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, prefs.categories, catOrder],
  );

  /* ---- anuncios para los cocineros ---- */
  useLiveEvents((e) => {
    if (!e.turn || !e.type) return;
    const matters = !allowed || e.items.some((i) => allowed.has(i.categoryId));
    if (!matters) return;
    const tipo = TYPE_SPEECH[e.type](e);
    if (e.kind === 'created' || (e.kind === 'status' && e.status === 'recibido' && e.prevStatus !== 'recibido') || (e.kind === 'updated' && e.backToKitchen)) {
      let text = fillTemplate(settings.voiceKitchen, { turno: e.turn, tipo, mesa: e.tableNumber, nombre: e.customerName });
      if (prefs.readItems) text += '. ' + e.items.map((i) => `${i.qty} ${i.name}${i.optionName ? ` ${i.optionName}` : ''}`).join(', ');
      announce(text, prefs.voice, 'kitchen');
    } else if (e.kind === 'updated' && e.itemsChanged && e.status === 'recibido') {
      announce(`Atención: el turno ${e.turn} fue modificado.`, prefs.voice, 'new');
    } else if (e.kind === 'cancelled' && e.prevStatus === 'recibido') {
      announce(`El turno ${e.turn} fue cancelado.`, prefs.voice, 'new');
    }
  });

  /* ---- columnas que caben sin mover la pantalla ---- */
  const gridRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const queueKey = queue.map((o) => `${o.id}:${o.updatedAt}:${o.items.length}`).join(',');
  const layout = useKitchenLayout({ gridRef, measureRef, queueKey, columns: prefs.columns, scale: prefs.scale });
  const { cols, narrow, hidden } = layout;
  const noop = useCallback(async () => {}, []);

  const toggleCat = (id: number) => {
    const current = prefs.categories ?? catalog.categories.map((c) => c.id);
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    setPrefs({ categories: next.length === catalog.categories.length ? null : next });
  };

  return (
    <div className={`kitchen ${idle ? 'idle' : ''} ${narrow ? 'narrow' : ''}`} style={{ '--k': prefs.scale, '--cols': cols } as CSSProperties}>
      <header className="k-top">
        <Logo kind="sc" tone="cream" className="k-logo" />
        <div className="k-title">
          <h1 className="display">Cocina</h1>
          <LivePill />
        </div>
        <KitchenStats queue={queue} lateMinutes={settings.kitchenLateMinutes} />
        <div className="k-clock display">
          <Clock />
        </div>
      </header>

      <main className="k-main">
        <div className="k-grid" ref={gridRef}>
          {queue.map((o) => (
            <KitchenCard
              key={`${o.id}-${layout.remountKey(o.id)}`}
              order={o}
              warn={settings.kitchenWarnMinutes}
              late={settings.kitchenLateMinutes}
              tall={layout.isTall(o.id)}
              bigItems={layout.bigItems(o.id)}
              onDone={showDone ? onDone : undefined}
            />
          ))}
        </div>
        {/* copia invisible de cada tarjeta, sin columnas: da su altura natural */}
        <div className="k-measure" ref={measureRef} aria-hidden="true" inert style={{ width: layout.colWidth }}>
          {queue.map((o) => (
            <KitchenCard key={o.id} order={o} warn={settings.kitchenWarnMinutes} late={settings.kitchenLateMinutes} tall={false} measuring onDone={showDone ? noop : undefined} />
          ))}
        </div>
        {queue.length === 0 && (
          <div className="k-empty">
            <Logo kind="hat" className="k-empty-hat" />
            <h2 className="display">¡Cocina al día!</h2>
            <p>Los pedidos nuevos aparecen aquí solos.</p>
          </div>
        )}
      </main>

      <footer className={`k-foot ${hidden.length ? 'has-queue' : ''}`}>
        {hidden.length > 0 ? (
          <div className="k-waiting">
            <span className="k-waiting-label">
              +{hidden.length} en espera
            </span>
            {hidden.map((h) => (
              <span key={h.turn} className={`k-waiting-turn display num ${h.partial ? 'partial' : ''}`} title={h.partial ? 'Se ve el comienzo; el resto no cupo en la pantalla' : undefined}>
                #{h.turn}
                {h.partial && <small> sigue</small>}
              </span>
            ))}
          </div>
        ) : (
          <div className="band" />
        )}
      </footer>

      <TvSettings title="Pantalla de cocina">
        <div className="drawer-section">
          <h4>Columnas</h4>
          <div className="opt-grid">
            {[0, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} className={`opt ${prefs.columns === n ? 'on' : ''}`} onClick={() => setPrefs({ columns: n })}>
                {n === 0 ? `Auto (${cols})` : n}
              </button>
            ))}
          </div>
        </div>
        <div className="drawer-section">
          <h4>Tamaño de letra</h4>
          <div className="opt-grid">
            {[
              [0.85, 'Pequeña'],
              [1, 'Normal'],
              [1.15, 'Grande'],
              [1.3, 'Enorme'],
            ].map(([v, label]) => (
              <button key={v} className={`opt ${prefs.scale === v ? 'on' : ''}`} onClick={() => setPrefs({ scale: v as number })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="drawer-section">
          <h4>Qué muestra este TV</h4>
          <div className="opt-grid">
            {catalog.categories.map((c) => (
              <button key={c.id} className={`opt ${!prefs.categories || prefs.categories.includes(c.id) ? 'on' : ''}`} onClick={() => toggleCat(c.id)}>
                <Art name={c.icon} /> {c.name}
              </button>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Útil si tienes un TV para la freidora y otro para bebidas.
          </p>
        </div>
        <VoiceSettings prefs={prefs.voice} onChange={(p) => setPrefs({ voice: { ...prefs.voice, ...p } })} sample={fillTemplate(settings.voiceKitchen, { turno: 25, tipo: 'mesa 4' })} />
        <label className="switch">
          <input type="checkbox" checked={prefs.readItems} onChange={(e) => setPrefs({ readItems: e.target.checked })} />
          Leer también los productos
        </label>
        {canMark && (
          <div className="drawer-section">
            <h4>Marcar listos</h4>
            <label className="switch">
              <input type="checkbox" checked={prefs.doneButton} onChange={(e) => setPrefs({ doneButton: e.target.checked })} />
              Botón «Listo» en cada pedido
            </label>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Al tocarlo, el pedido sale de la cocina y la caja recibe el aviso. Apágalo en un TV que nadie toca.
            </p>
          </div>
        )}
      </TvSettings>
      <SoundGate />
    </div>
  );
}

function KitchenStats({ queue, lateMinutes }: { queue: Order[]; lateMinutes: number }) {
  const now = useNow(5000);
  const oldest = queue[0];
  const lateCount = queue.filter((o) => now - o.createdAt >= lateMinutes * 60000).length;
  return (
    <div className="k-stats">
      <div className="k-stat">
        <b className="display num">{queue.length}</b>
        <span>
          pedido{queue.length === 1 ? '' : 's'}
          <br />
          en cola
        </span>
      </div>
      {oldest && (
        <div className="k-stat">
          <b className="display num">{minutesText(now - oldest.createdAt)}</b>
          <span>
            el más
            <br />
            antiguo
          </span>
        </div>
      )}
      {lateCount > 0 && (
        <div className="k-stat late">
          <Flame />
          <b className="display num">{lateCount}</b>
          <span>atrasado{lateCount === 1 ? '' : 's'}</span>
        </div>
      )}
    </div>
  );
}

function KitchenTimer({ since }: { since: number }) {
  const now = useNow(1000);
  return (
    <div className="kcard-timer num">
      <Timer />
      {elapsed(now - since)}
    </div>
  );
}

const KitchenCard = memo(function KitchenCard({
  order: o,
  warn,
  late,
  tall,
  bigItems,
  measuring = false,
  onDone,
}: {
  order: Order;
  warn: number;
  late: number;
  tall: boolean;
  /** Productos tan altos que pueden partirse entre columnas (los demás van enteros). */
  bigItems?: number[];
  /** Copia invisible que solo sirve para medir la altura natural. */
  measuring?: boolean;
  onDone?: (o: Order) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  // el color de demora solo necesita revisarse cada pocos segundos
  const now = useNow(5000);
  const age = now - o.createdAt;
  const mins = age / 60000;
  const heat = mins >= late ? 'late' : mins >= warn ? 'warn' : 'ok';
  const fresh = age < 25000;
  const edited = o.editCount > 0;
  const units = o.items.reduce((s, i) => s + i.qty, 0);

  return (
    <article
      className={`kcard type-${o.type} heat-${heat} ${fresh ? 'fresh' : ''} ${edited ? 'edited' : ''} ${tall ? 'tall' : ''}`}
      {...(measuring ? { 'data-measure': o.id } : { 'data-turn': o.turn, 'data-id': o.id })}
    >
      <header className="kcard-head">
        <div className="kcard-turn">
          <span>Turno</span>
          <b className="display num">{o.turn}</b>
        </div>
        <div className="kcard-place">
          <span className="kcard-place-art">
            <Art name={TYPE_ART[o.type]} />
          </span>
          <span className="kcard-place-text">
            <b className="display">{o.type === 'mesa' ? `Mesa ${o.tableNumber}` : o.type === 'llevar' ? 'Para llevar' : 'Domicilio'}</b>
            {(o.customerName || o.type === 'domicilio') && <small>{o.type === 'domicilio' ? o.addressRef || o.address : o.customerName}</small>}
          </span>
        </div>
        <KitchenTimer since={o.createdAt} />
      </header>

      {(fresh || edited || tall) && (
        <div className="kcard-flags">
          {fresh && <span className="kflag new">¡Nuevo!</span>}
          {tall && <span className="kflag more">Sigue →</span>}
          {edited && (
            <span className="kflag edit">
              <PencilLine /> Modificado
            </span>
          )}
        </div>
      )}

      <ul className="kcard-items">
        {o.items.map((i) => {
          const added = edited && i.createdAt > o.createdAt + 2000;
          return (
            <li key={i.id} className={`kitem ${added ? 'added' : ''} ${bigItems?.includes(i.id) ? 'big' : ''}`} data-item={i.id}>
              <span className="kitem-qty display num">{i.qty}</span>
              <Visual className="kitem-thumb" image={i.image} imageFit={i.imageFit} icon={i.icon} />
              <div className="kitem-body">
                <div className="kitem-name">
                  {i.name}
                  {i.optionName && <span className="kitem-opt">{i.optionName}</span>}
                  {added && <span className="kitem-added">AGREGADO</span>}
                </div>
                <ItemMods mods={i} variant="kitchen" />
              </div>
            </li>
          );
        })}
      </ul>

      {o.note && (
        <div className="kcard-note">
          <StickyNote />
          <span>{o.note}</span>
        </div>
      )}

      <footer className="kcard-foot">
        <span>
          {units} producto{units === 1 ? '' : 's'} · {clock(o.createdAt)}
        </span>
        {o.paid && (
          <span className="kcard-paid">
            <Wallet /> Pagado
          </span>
        )}
        {onDone && (
          <button
            className="kcard-done"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onDone(o);
              setBusy(false);
            }}
          >
            {busy ? <span className="spinner" /> : <Check />} Listo
          </button>
        )}
      </footer>
    </article>
  );
});
