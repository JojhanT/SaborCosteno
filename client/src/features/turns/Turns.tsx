import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { Clock, Logo, SoundGate, useIdleCursor, useWakeLock } from '../../shared/components/ui';
import { TvSettings, VoiceSettings } from '../../shared/components/TvSettings';
import { useLive, useLiveEvents } from '../../shared/lib/live';
import { usePrefs } from '../../shared/lib/storage';
import { announce, DEFAULT_VOICE, fillTemplate, type VoicePrefs } from '../../shared/lib/voice';
import type { LiveEvent, OrderType } from '../../shared/types';
import './turns.css';

interface TurnPrefs {
  voice: VoicePrefs;
  announceNew: boolean;
  announceReady: boolean;
  takeover: boolean;
}
const DEFAULTS: TurnPrefs = { voice: DEFAULT_VOICE, announceNew: true, announceReady: true, takeover: true };

// Pantalla pública: solo números de turno, nunca datos del cliente.
const TYPE_SAY: Record<OrderType, string> = { mesa: 'mesa', llevar: 'para llevar', domicilio: 'domicilio' };

interface Call {
  key: string;
  turn: number;
  type: OrderType;
  recall: boolean;
}

export default function Turns() {
  const { orders, bootstrap } = useLive();
  const settings = bootstrap!.settings;
  const [prefs, setPrefs] = usePrefs<TurnPrefs>('sabor.turns', DEFAULTS);
  const idle = useIdleCursor();
  useWakeLock();

  const visible = orders.filter((o) => settings.showDeliveryOnTurns || o.type !== 'domicilio');
  const preparing = visible.filter((o) => o.status === 'recibido').sort((a, b) => a.createdAt - b.createdAt);
  const ready = visible.filter((o) => o.status === 'listo').sort((a, b) => (b.readyAt ?? 0) - (a.readyAt ?? 0));
  const [featured, ...others] = ready;
  // los domicilios no se muestran (el cliente no está en el local), pero se cuenta cuántos hay
  const hiddenDeliveries = settings.showDeliveryOnTurns ? 0 : orders.filter((o) => o.type === 'domicilio' && o.status === 'recibido').length;

  /* ------------------------------------------ llamados a pantalla completa */
  const [calls, setCalls] = useState<Call[]>([]);
  const current = calls[0];
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCalls((c) => c.slice(1)), 6500);
    return () => clearTimeout(t);
  }, [current]);

  useLiveEvents((e: LiveEvent) => {
    if (!e.turn || !e.type) return;
    if (e.type === 'domicilio' && !settings.showDeliveryOnTurns) return;
    // el nombre queda vacío aunque la plantilla de voz lo pida
    const vars = { turno: e.turn, tipo: TYPE_SAY[e.type], mesa: e.tableNumber, nombre: '' };
    if (e.kind === 'created' && prefs.announceNew) {
      announce(fillTemplate(settings.voiceNew, vars), prefs.voice, 'new');
    }
    const isReady = e.kind === 'status' && e.status === 'listo';
    const isCall = e.kind === 'call' && e.status === 'listo';
    if (isReady || isCall) {
      if (prefs.takeover) setCalls((c) => [...c.filter((x) => x.turn !== e.turn), { key: e.id, turn: e.turn!, type: e.type!, recall: isCall }].slice(-5));
      if (prefs.announceReady) announce(fillTemplate(settings.voiceReady, vars), prefs.voice, isCall ? 'call' : 'ready');
    }
  });

  const marquee = useMemo(() => (settings.turnsMarquee.length ? settings.turnsMarquee : ['¡Ajá!']), [settings.turnsMarquee]);

  return (
    <div className={`turns ${idle ? 'idle' : ''}`}>
      <div className="t-bg" />
      <header className="t-top">
        <Logo kind="sabor" tone="cream" className="t-logo" />
        <div className="t-top-mid">
          <span className="t-top-title display">Turnos</span>
          <span className="t-top-sub">Estate pendiente de tu número</span>
        </div>
        <div className="t-clock display">
          <Clock />
        </div>
      </header>

      <main className="t-main">
        <section className="t-panel t-prep">
          <header className="t-panel-head">
            <span className="t-panel-art">
              <Art name="cocina" />
            </span>
            <div>
              <h2 className="display">En preparación</h2>
              <p>Ya estamos cocinando</p>
            </div>
            <b className="t-count display num">{preparing.length}</b>
          </header>
          <div className="t-prep-grid">
            <AnimatePresence mode="popLayout">
              {preparing.slice(0, 15).map((o) => (
                <motion.div
                  key={o.id}
                  layout
                  className={`t-chip type-${o.type}`}
                  initial={{ opacity: 0, scale: 0.5, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.25 } }}
                  transition={{ type: 'spring', damping: 18, stiffness: 220 }}
                >
                  <b className="display num">{o.turn}</b>
                  <i className="t-chip-cook" />
                </motion.div>
              ))}
            </AnimatePresence>
            {preparing.length > 15 && <div className="t-more">+{preparing.length - 15} más</div>}
            {preparing.length === 0 && <p className="t-none">{hiddenDeliveries ? 'Sin turnos en espera' : 'Sin pedidos en cocina'}</p>}
          </div>
          {hiddenDeliveries > 0 && (
            <div className="t-delivery-note">
              <span className="t-delivery-art">
                <Art name="domicilio" />
              </span>
              <span>
                <b className="num">{hiddenDeliveries}</b> domicilio{hiddenDeliveries === 1 ? '' : 's'} en preparación
              </span>
            </div>
          )}
        </section>

        <section className="t-panel t-ready">
          <header className="t-panel-head">
            <span className="t-panel-art">
              <Art name="campana" />
            </span>
            <div>
              <h2 className="display">¡Listo! Pasa a recoger</h2>
              <p>Acércate a la caja con tu turno</p>
            </div>
            <b className="t-count display num">{ready.length}</b>
          </header>

          <div className="t-ready-body">
            <AnimatePresence mode="popLayout">
              {featured ? (
                <motion.div
                  key={featured.id}
                  layout
                  className={`t-hero type-${featured.type}`}
                  initial={{ opacity: 0, scale: 0.6, rotate: -4 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 160 }}
                >
                  <div className="t-hero-rays" />
                  <span className="t-hero-kicker">
                    <Sparkles /> Turno
                  </span>
                  <b className="t-hero-num display num">{featured.turn}</b>
                </motion.div>
              ) : (
                <motion.div key="empty" className="t-hero-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Logo kind="hat" className="t-empty-hat" />
                  <p className="display">Aquí aparecerá tu número cuando esté listo</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="t-ready-grid">
              <AnimatePresence mode="popLayout">
                {others.slice(0, 8).map((o) => (
                  <motion.div
                    key={o.id}
                    layout
                    className={`t-ready-chip type-${o.type}`}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.25 } }}
                    transition={{ type: 'spring', damping: 18, stiffness: 220 }}
                  >
                    <b className="display num">{o.turn}</b>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </main>

      <footer className="t-foot">
        <div className="band" />
        <div className="t-marquee">
          <div className="t-marquee-track" style={{ animationDuration: `${Math.max(24, marquee.join(' ').length * 0.28)}s` }}>
            {[0, 1].map((copy) => (
              <div key={copy} className="t-marquee-group" aria-hidden={copy === 1}>
                {marquee.map((m, i) => (
                  <span key={i} className="t-marquee-item">
                    <Logo kind="hat" className="t-marquee-hat" />
                    {m}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </footer>

      <AnimatePresence>{current && <Takeover key={current.key} call={current} />}</AnimatePresence>

      <TvSettings title="Pantalla de turnos">
        <div className="drawer-section">
          <h4>Anuncios</h4>
          <label className="switch">
            <input type="checkbox" checked={prefs.announceReady} onChange={(e) => setPrefs({ announceReady: e.target.checked })} />
            Anunciar pedidos listos
          </label>
          <label className="switch">
            <input type="checkbox" checked={prefs.announceNew} onChange={(e) => setPrefs({ announceNew: e.target.checked })} />
            Anunciar pedidos que llegan
          </label>
          <label className="switch">
            <input type="checkbox" checked={prefs.takeover} onChange={(e) => setPrefs({ takeover: e.target.checked })} />
            Mostrar el turno listo en grande
          </label>
        </div>
        <VoiceSettings prefs={prefs.voice} onChange={(p) => setPrefs({ voice: { ...prefs.voice, ...p } })} sample={fillTemplate(settings.voiceReady, { turno: 24 })} />
      </TvSettings>
      <SoundGate />
    </div>
  );
}

function Takeover({ call }: { call: Call }) {
  const confetti = useRef(
    Array.from({ length: 26 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      dur: 2.4 + Math.random() * 2,
      size: 8 + Math.random() * 12,
      color: ['#F38120', '#FFC53D', '#FFF1DC', '#2EC4B6', '#C96C39'][i % 5],
      rot: Math.random() * 360,
    })),
  ).current;
  return (
    <motion.div className={`takeover type-${call.type}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}>
      <div className="takeover-rays" />
      {confetti.map((c, i) => (
        <i
          key={i}
          className="confetti"
          style={{ left: `${c.left}%`, width: c.size, height: c.size * 0.45, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, rotate: `${c.rot}deg` }}
        />
      ))}
      <motion.div className="takeover-hat" initial={{ y: -500, rotate: -30 }} animate={{ y: 0, rotate: [-30, 8, -4, 0] }} transition={{ type: 'spring', damping: 9, stiffness: 90, delay: 0.1 }}>
        <Logo kind="hat" />
      </motion.div>
      <motion.span className="takeover-kicker display" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        {call.recall ? 'Te estamos esperando' : 'Turno'}
      </motion.span>
      <motion.b className="takeover-num display num" initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 10, stiffness: 140, delay: 0.25 }}>
        {call.turn}
      </motion.b>
      <motion.span className="takeover-msg display" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        ¡Tu pedido está listo!
      </motion.span>
      <Logo kind="aja" className="takeover-aja" />
    </motion.div>
  );
}
