import { useEffect, useRef, useSyncExternalStore } from 'react';
import { api, ApiError } from './api';
import { onUnauthorized } from './session';
import { checkBuild } from './update';
import type { Bootstrap, LiveEvent, Order } from '../types';

/*
 * Estado en vivo compartido por todas las vistas: una sola conexión SSE por
 * pestaña. El servidor manda siempre el estado completo de pedidos activos,
 * así una pantalla que se reconecta nunca queda desactualizada.
 */

interface LiveState {
  connected: boolean;
  ready: boolean;
  orders: Order[];
  nextTurn: number;
  offset: number;
  bootstrap: Bootstrap | null;
}

let state: LiveState = { connected: false, ready: false, orders: [], nextTurn: 1, offset: 0, bootstrap: null };
const listeners = new Set<() => void>();
const eventListeners = new Set<(e: LiveEvent, orders: Order[]) => void>();
let source: EventSource | null = null;
let lastMessage = 0;
let wasDisconnected = false;
let watchdog: ReturnType<typeof setInterval> | undefined;
let running = false;

function set(patch: Partial<LiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export async function refreshBootstrap() {
  try {
    const b = await api.get<Bootstrap>('/bootstrap');
    set({ bootstrap: b, nextTurn: b.nextTurn, offset: b.serverTime - Date.now() });
  } catch (err) {
    if (running && !(err instanceof ApiError && (err.status === 401 || err.status === 403))) setTimeout(refreshBootstrap, 3000);
  }
}

function connect() {
  source?.close();
  const es = new EventSource('/api/stream');
  source = es;
  lastMessage = Date.now();
  es.addEventListener('open', () => {
    lastMessage = Date.now();
    if (wasDisconnected) void refreshBootstrap();
    wasDisconnected = false;
    set({ connected: true });
  });
  es.addEventListener('error', () => {
    wasDisconnected = true;
    set({ connected: false });
  });
  es.addEventListener('orders', (msg) => {
    lastMessage = Date.now();
    const data = JSON.parse((msg as MessageEvent).data) as { orders: Order[]; nextTurn: number; serverTime: number; event: LiveEvent | null };
    set({ orders: data.orders, nextTurn: data.nextTurn, offset: data.serverTime - Date.now(), connected: true, ready: true });
    if (data.event) eventListeners.forEach((fn) => fn(data.event!, data.orders));
  });
  es.addEventListener('ping', (msg) => {
    lastMessage = Date.now();
    const data = JSON.parse((msg as MessageEvent).data) as { serverTime: number; build?: string };
    state.offset = data.serverTime - Date.now();
    checkBuild(data.build);
  });
  es.addEventListener('hello', (msg) => {
    lastMessage = Date.now();
    checkBuild((JSON.parse((msg as MessageEvent).data) as { build?: string }).build);
  });
  es.addEventListener('catalog', () => void refreshBootstrap());
  es.addEventListener('settings', () => void refreshBootstrap());
  // el administrador desconectó este equipo
  es.addEventListener('logout', () => {
    stopLive();
    onUnauthorized();
  });
}

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    const me = await res.json();
    return !!me.session;
  } catch {
    return true; // servidor caído: se sigue intentando
  }
}

export function startLive() {
  if (running) return;
  running = true;
  connect();
  void refreshBootstrap();
  // vigilante: si el servidor se reinicia o la conexión queda "zombi", reconecta
  watchdog = setInterval(async () => {
    if (!source || source.readyState === EventSource.CLOSED || Date.now() - lastMessage > 40000) {
      wasDisconnected = true;
      set({ connected: false });
      if (!(await checkSession())) {
        stopLive();
        onUnauthorized();
        return;
      }
      if (running) connect();
    }
  }, 5000);
}

export function stopLive() {
  running = false;
  clearInterval(watchdog);
  source?.close();
  source = null;
  set({ connected: false, ready: false, orders: [], bootstrap: null });
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useLive() {
  return useSyncExternalStore(subscribe, () => state);
}

export const serverNow = () => Date.now() + state.offset;

/** Escucha eventos (pedido creado, listo, llamado...) para voz y animaciones. */
export function useLiveEvents(fn: (e: LiveEvent, orders: Order[]) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const handler = (e: LiveEvent, orders: Order[]) => ref.current(e, orders);
    eventListeners.add(handler);
    return () => void eventListeners.delete(handler);
  }, []);
}

/*
 * Hora del servidor que se actualiza sola (los TV pueden tener el reloj mal).
 * Un solo reloj por intervalo para toda la pantalla: todos los cronómetros
 * cambian en el mismo instante y muestran lo mismo.
 */
interface SharedClock {
  now: number;
  subscribe: (fn: () => void) => () => void;
  read: () => number;
}
const clocks = new Map<number, SharedClock>();

function clockFor(interval: number) {
  let c = clocks.get(interval);
  if (c) return c;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  const clock: SharedClock = {
    now: serverNow(),
    // la misma función siempre: React no se vuelve a suscribir en cada render
    subscribe(fn) {
      listeners.add(fn);
      if (!timer) {
        // estaba quieto: se pone en hora al arrancar (una sola vez, no en cada render)
        clock.now = serverNow();
        timer = setInterval(() => {
          clock.now = serverNow();
          listeners.forEach((l) => l());
        }, interval);
      }
      return () => {
        listeners.delete(fn);
        if (!listeners.size) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    read: () => clock.now,
  };
  clocks.set(interval, clock);
  return clock;
}

export function useNow(interval = 1000) {
  const c = clockFor(interval);
  return useSyncExternalStore(c.subscribe, c.read);
}
