import { useSyncExternalStore } from 'react';

/*
 * Actualizaciones de la app: cuando se compila una versión nueva, las pestañas
 * abiertas siguen con la anterior. Si intentan cargar una pantalla que ya no
 * existe, se recargan solas (una vez) en lugar de quedar en blanco.
 */

const KEY = 'sabor.reloadedAt';

/** Recarga la página, pero nunca dos veces seguidas (evita ciclos). */
export function reloadOnce() {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 15000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sin almacenamiento: se recarga igual */
  }
  window.location.reload();
  return true;
}

export const isChunkError = (err: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically|Loading chunk|MIME type/i.test(String((err as Error)?.message ?? err));

let baseline: string | null = null;
let available = false;
const listeners = new Set<() => void>();

/** Los TV se actualizan solos; en la caja se muestra un aviso para no interrumpir. */
export function checkBuild(id?: string) {
  if (!id || id === 'dev') return;
  if (baseline === null) {
    baseline = id;
    return;
  }
  if (id === baseline || available) return;
  available = true;
  listeners.forEach((l) => l());
  if (['/cocina', '/turnos'].includes(window.location.pathname.replace(/\/+$/, ''))) setTimeout(() => window.location.reload(), 1500);
}

export function useUpdateAvailable() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => available,
  );
}
