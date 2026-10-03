import { useSyncExternalStore } from 'react';
import type { Role } from '../types';

export type { Role };

/** Permisos que manda el servidor en /auth/me (la lista vive en server/features/auth/permissions.js). */
export type Permission =
  | 'orders.manage'
  | 'orders.charge'
  | 'orders.kitchen'
  | 'orders.dispatch'
  | 'orders.deliver'
  | 'reports.view'
  | 'catalog.manage'
  | 'settings.manage'
  | 'users.manage'
  | 'screens.kitchen'
  | 'screens.turns'
  | 'delivery.view';

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  mustChange: boolean;
}

export interface Me {
  setupRequired: boolean;
  recovery: boolean;
  /** Está en el computador del sistema: crea el administrador sin código de instalación. */
  canSetup: boolean;
  user: SessionUser | null;
  session: { id: string; device: string } | null;
  permissions: Permission[];
}

let me: Me | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useMe() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => me,
  );
}

export const can = (m: Me | null, permission: Permission) => !!m?.permissions.includes(permission);

/** ¿El usuario actual puede hacer esto? (para mostrar u ocultar botones) */
export const useCan = (permission: Permission) => can(useMe(), permission);

async function post(url: string, body: unknown = {}) {
  let res: Response;
  try {
    res = await fetch(`/api${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Sin conexión con el servidor');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  return data;
}

export async function refreshMe() {
  try {
    const res = await fetch('/api/auth/me');
    me = (await res.json()) as Me;
  } catch {
    setTimeout(refreshMe, 3000);
    return me;
  }
  notify();
  return me;
}

/** La API respondió 401: la sesión venció o el administrador la cerró. */
export function onUnauthorized() {
  if (me?.user) {
    me = { ...me, user: null, session: null, permissions: [] };
    notify();
  }
  void refreshMe();
}

const DEVICE_KEY = 'sabor.device';
export function rememberedDevice() {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? '';
  } catch {
    return '';
  }
}
function rememberDevice(device: string) {
  try {
    localStorage.setItem(DEVICE_KEY, device);
  } catch {
    /* sin almacenamiento */
  }
}

export async function login(username: string, password: string, device: string) {
  await post('/auth/login', { username, password, device });
  rememberDevice(device);
  return refreshMe();
}

export async function setup(body: { name: string; username: string; password: string; device: string; code?: string }) {
  await post('/auth/setup', body);
  rememberDevice(body.device);
  return refreshMe();
}

export const logout = async () => (await post('/auth/logout').catch(() => null), refreshMe());

/** Devuelve cuántos equipos quedaron desconectados. */
export async function changePassword(current: string, next: string) {
  const r = (await post('/auth/password', { current, next })) as { closedSessions: number };
  await refreshMe();
  return r.closedSessions;
}

export const ROLE_LABEL: Record<Role, string> = { admin: 'Administrador', mesero: 'Mesero', cajero: 'Cajero', cocinero: 'Cocinero', repartidor: 'Repartidor' };

/** Ilustración, color y descripción de cada rol (login, inicio y usuarios). */
export const ROLE_INFO: Record<Role, { art: string; tone: string; text: string }> = {
  admin: { art: 'menu', tone: 'terra', text: 'Todo: menú, precios, ajustes y usuarios' },
  mesero: { art: 'llevar', tone: 'orange', text: 'Toma los pedidos y los entrega. No cobra' },
  cajero: { art: 'caja', tone: 'gold', text: 'Cobra y lleva la contabilidad. No toma pedidos' },
  cocinero: { art: 'cocina', tone: 'gold', text: 'Cocina: ve los pedidos y los marca listos' },
  repartidor: { art: 'domicilio', tone: 'sea', text: 'Sus domicilios: los ve y los marca entregados' },
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? ''))).toUpperCase();
}
