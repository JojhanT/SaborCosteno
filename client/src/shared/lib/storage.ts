import { useCallback, useState } from 'react';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento bloqueado: solo dura la sesión */
  }
}

/** Preferencias por pantalla (cada TV recuerda las suyas). */
export function usePrefs<T extends object>(key: string, defaults: T) {
  const [value, setValue] = useState<T>(() => load(key, defaults));
  const update = useCallback(
    (patch: Partial<T>) =>
      setValue((prev) => {
        const next = { ...prev, ...patch };
        save(key, next);
        return next;
      }),
    [key],
  );
  return [value, update] as const;
}
