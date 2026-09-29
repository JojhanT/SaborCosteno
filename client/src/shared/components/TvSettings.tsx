import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Home, LogOut, Maximize, Play, Settings2, X } from 'lucide-react';
import { navigate } from '../lib/router';
import { logout, useMe } from '../lib/session';
import { announce, spanishVoices, unlockAudio, useAudioReady, type VoicePrefs } from '../lib/voice';
import { toggleFullscreen } from './ui';

/** Con el control remoto del TV: las flechas y Re Pág / Av Pág mueven el panel. */
function scrollWithKeys(e: KeyboardEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const t = e.target as HTMLElement;
  if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type !== 'checkbox')) return;
  const step = { ArrowDown: 90, ArrowUp: -90, PageDown: el.clientHeight * 0.85, PageUp: -el.clientHeight * 0.85 }[e.key];
  if (step === undefined) return;
  e.preventDefault();
  el.scrollBy({ top: step, behavior: 'smooth' });
}

/** Botón de engranaje (se oculta solo) + panel lateral de ajustes para los TV. */
export function TvSettings({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const me = useMe();

  useEffect(() => {
    if (!open) return;
    bodyRef.current?.focus({ preventScroll: true });
    const onKey = (e: globalThis.KeyboardEvent) => (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button className="tv-settings-btn" onClick={() => setOpen(true)} aria-label="Ajustes de pantalla">
        <Settings2 />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
              <header className="drawer-head">
                <h2 className="display grow">{title}</h2>
                <button className="btn icon ghost" onClick={() => setOpen(false)} aria-label="Cerrar">
                  <X />
                </button>
              </header>
              <div className="drawer-body" ref={bodyRef} tabIndex={-1} onKeyDown={scrollWithKeys}>
                {children}
                <div className="drawer-section">
                  <h4>Pantalla</h4>
                  <div className="opt-grid">
                    <button className="opt" onClick={toggleFullscreen}>
                      <Maximize size={16} /> Pantalla completa
                    </button>
                    <button className="opt" onClick={() => navigate('/')}>
                      <Home size={16} /> Ir al inicio
                    </button>
                    <button className="opt" onClick={() => void logout()}>
                      <LogOut size={16} /> Cerrar sesión
                    </button>
                  </div>
                  {me?.user && (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Sesión de <b>{me.user.name}</b>
                      {me.session?.device ? ` · ${me.session.device}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function VoiceSettings({ prefs, onChange, sample }: { prefs: VoicePrefs; onChange: (p: Partial<VoicePrefs>) => void; sample: string }) {
  const ready = useAudioReady();
  const [voices, setVoices] = useState(spanishVoices);
  useEffect(() => {
    const t = setInterval(() => setVoices(spanishVoices()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="drawer-section">
      <h4>Voz</h4>
      <label className="switch">
        <input type="checkbox" checked={prefs.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
        Anunciar con voz
      </label>
      <label className="field">
        <span>Voz ({voices.length} en español)</span>
        <select className="input" value={prefs.voiceURI} onChange={(e) => onChange({ voiceURI: e.target.value })}>
          <option value="">Automática (la mejor disponible)</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} · {v.lang}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Velocidad · {prefs.rate.toFixed(2)}×</span>
        <input type="range" min={0.7} max={1.3} step={0.05} value={prefs.rate} onChange={(e) => onChange({ rate: Number(e.target.value) })} />
      </label>
      <label className="field">
        <span>Volumen · {Math.round(prefs.volume * 100)}%</span>
        <input type="range" min={0.2} max={1} step={0.05} value={prefs.volume} onChange={(e) => onChange({ volume: Number(e.target.value) })} />
      </label>
      <button
        className="btn outline"
        onClick={() => {
          if (!ready) unlockAudio();
          announce(sample, prefs, 'ready');
        }}
      >
        <Play /> Probar voz
      </button>
    </div>
  );
}
