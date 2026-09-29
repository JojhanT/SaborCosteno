import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X, Volume2 } from 'lucide-react';
import { Art } from './Art';
import { useLive, useNow } from '../lib/live';
import { clock } from '../lib/format';
import { unlockAudio, useAudioReady } from '../lib/voice';
import type { ImageFit } from '../types';

/* --------------------------------------------------------------- visual */

/** Foto del producto si existe; si no, su ilustración. */
export function Visual({ image, imageFit = 'cover', icon, className = '', alt = '' }: { image?: string | null; imageFit?: ImageFit; icon: string; className?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  return (
    <div className={`visual ${image && !failed ? `has-photo photo-${imageFit}` : 'has-art'} ${className}`}>
      {image && !failed ? <img src={image} alt={alt} className={`fit-${imageFit}`} loading="lazy" draggable={false} onError={() => setFailed(true)} /> : <Art name={icon} />}
    </div>
  );
}

export function Logo({ kind = 'sabor', tone = 'cream', className = '' }: { kind?: 'sabor' | 'sc' | 'hat' | 'aja'; tone?: 'cream' | 'color'; className?: string }) {
  const src = kind === 'hat' || kind === 'aja' ? `/brand/${kind}.png` : `/brand/${kind}-${tone}.png`;
  return <img src={src} alt={kind === 'hat' ? '' : 'Sabor Costeño ¡ajá!'} className={`logo logo-${kind} ${className}`} draggable={false} />;
}

/* ---------------------------------------------------------------- modal */

export function Modal({ open, onClose, children, className = '', labelledBy }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; labelledBy?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className={`modal ${className}`}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ModalClose({ onClose }: { onClose: () => void }) {
  return (
    <button className="modal-x" onClick={onClose} aria-label="Cerrar">
      <X />
    </button>
  );
}

/* --------------------------------------------------------------- toasts */

type ToastKind = 'success' | 'error' | 'info';
interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  text?: string;
  art?: string;
  action?: ToastAction;
}
let toasts: ToastItem[] = [];
let toastId = 0;
const toastListeners = new Set<() => void>();
const emitToasts = () => toastListeners.forEach((l) => l());
const dismiss = (id: number) => {
  toasts = toasts.filter((t) => t.id !== id);
  emitToasts();
};

/** Aviso flotante. Con `action` muestra un botón (por ejemplo "Deshacer"). */
export function toast(title: string, opts: { kind?: ToastKind; text?: string; art?: string; ms?: number; action?: ToastAction } = {}) {
  const item: ToastItem = { id: ++toastId, kind: opts.kind ?? 'success', title, text: opts.text, art: opts.art, action: opts.action };
  toasts = [...toasts.slice(-3), item];
  emitToasts();
  setTimeout(() => dismiss(item.id), opts.ms ?? (item.kind === 'error' ? 5200 : item.action ? 6000 : 3200));
}
export const toastError = (err: unknown) => toast(err instanceof Error ? err.message : 'Algo salió mal', { kind: 'error' });

export function Toaster() {
  const list = useSyncExternalStore(
    (fn) => {
      toastListeners.add(fn);
      return () => toastListeners.delete(fn);
    },
    () => toasts,
  );
  return createPortal(
    <div className="toaster" aria-live="polite">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={`toast toast-${t.kind}`}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          >
            <div className="toast-icon">{t.art ? <Art name={t.art} /> : t.kind === 'error' ? <AlertTriangle /> : t.kind === 'info' ? <Info /> : <CheckCircle2 />}</div>
            <div className="grow">
              <strong>{t.title}</strong>
              {t.text && <p>{t.text}</p>}
            </div>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  dismiss(t.id);
                  t.action!.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------- diálogo */

interface ConfirmState {
  title: string;
  text?: string;
  confirm?: string;
  danger?: boolean;
  art?: string;
  input?: string;
  resolve: (v: string | false) => void;
}
let confirmState: ConfirmState | null = null;
const confirmListeners = new Set<() => void>();
const emitConfirm = () => confirmListeners.forEach((l) => l());

/** Confirmación con estilo. Si se pasa `input`, devuelve lo escrito. */
export function ask(opts: Omit<ConfirmState, 'resolve'>): Promise<string | false> {
  return new Promise((resolve) => {
    confirmState = { ...opts, resolve };
    emitConfirm();
  });
}

export function DialogHost() {
  const state = useSyncExternalStore(
    (fn) => {
      confirmListeners.add(fn);
      return () => confirmListeners.delete(fn);
    },
    () => confirmState,
  );
  const [value, setValue] = useState('');
  useEffect(() => setValue(''), [state]);
  const close = (v: string | false) => {
    state?.resolve(v);
    confirmState = null;
    emitConfirm();
  };
  return (
    <Modal open={!!state} onClose={() => close(false)} className="confirm">
      {state && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            close(state.input !== undefined ? value || ' ' : 'ok');
          }}
        >
          {state.art && (
            <div className="confirm-art">
              <Art name={state.art} />
            </div>
          )}
          <h2 className="display">{state.title}</h2>
          {state.text && <p className="muted">{state.text}</p>}
          {state.input !== undefined && <input className="input" autoFocus placeholder={state.input} value={value} onChange={(e) => setValue(e.target.value)} />}
          <div className="row confirm-actions">
            <button type="button" className="btn ghost" onClick={() => close(false)}>
              Volver
            </button>
            <button type="submit" className={`btn ${state.danger ? 'danger' : 'primary'}`} autoFocus={state.input === undefined}>
              {state.confirm ?? 'Confirmar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------ número animado */

export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 420);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = a + (b - a) * eased;
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(Math.round(shown))}</>;
}

/* ------------------------------------------------------- estado / hora */

export function LivePill({ compact = false }: { compact?: boolean }) {
  const { connected } = useLive();
  return (
    <div className={`live-pill ${connected ? '' : 'off'}`} title={connected ? 'Conectado en tiempo real' : 'Reconectando…'}>
      <span className={`live-dot ${connected ? '' : 'off'}`} />
      {!compact && <span>{connected ? 'En vivo' : 'Reconectando…'}</span>}
    </div>
  );
}

export function Clock({ seconds = false }: { seconds?: boolean }) {
  const now = useNow(seconds ? 1000 : 5000);
  return <span className="clock num">{clock(now, seconds)}</span>;
}

/** Botón flotante para habilitar audio en los TV (política de los navegadores). */
export function SoundGate() {
  const ready = useAudioReady();
  return (
    <AnimatePresence>
      {!ready && (
        <motion.button className="sound-gate" onClick={unlockAudio} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
          <span className="sound-gate-icon">
            <Volume2 />
          </span>
          <span>
            <strong>Toca para activar el sonido</strong>
            <small>Voz y campanas de los turnos</small>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** Oculta el cursor en pantallas de TV cuando no se mueve el mouse. */
export function useIdleCursor(ms = 3000) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), ms);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('pointerdown', wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('pointerdown', wake);
    };
  }, [ms]);
  return idle;
}

/** Evita que el TV se apague (solo funciona en localhost/https). */
export function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        lock = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        lock = null;
      }
    };
    void request();
    const onVis = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, []);
}

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}
