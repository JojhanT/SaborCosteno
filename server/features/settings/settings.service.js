import { q, tx } from '../../core/db.js';

export const DEFAULT_SETTINGS = {
  businessName: 'Sabor Costeño',
  slogan: '¡ajá!',
  tables: 12,
  timezone: 'America/Bogota',
  /** Hora en que arranca la jornada: pedidos antes de esta hora cuentan para el día anterior. */
  dayCutoffHour: 5,
  deliveryFeePresets: [2000, 3000, 4000, 5000, 6000],
  defaultDeliveryFee: 3000,
  /** Minutos para pasar el pedido a "demorado" (ámbar) y "atrasado" (rojo) en cocina. */
  kitchenWarnMinutes: 10,
  kitchenLateMinutes: 20,
  showDeliveryOnTurns: false,
  /** La pantalla de turnos para clientes queda oculta hasta que el administrador la active. */
  turnsScreenEnabled: false,
  turnsMarquee: [
    '¡Ajá! Bienvenidos a Sabor Costeño',
    'El verdadero sabor de la costa',
    'Pregunta por nuestra salchipapa familiar',
    'Pide a domicilio y te lo llevamos calientico',
  ],
  voiceNew: 'Turno {turno}, recibido. Ya lo estamos preparando.',
  voiceReady: 'Turno {turno}. ¡Tu pedido está listo!',
  voiceKitchen: 'Nuevo pedido. Turno {turno}, {tipo}.',
};

const NUMBER_KEYS = ['tables', 'dayCutoffHour', 'defaultDeliveryFee', 'kitchenWarnMinutes', 'kitchenLateMinutes'];
const BOOLEAN_KEYS = ['showDeliveryOnTurns', 'turnsScreenEnabled'];

export function getSettings() {
  const rows = q.all('SELECT key, value FROM settings');
  const stored = {};
  for (const row of rows) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      stored[row.key] = JSON.parse(row.value);
    } catch {
      /* valor corrupto: se ignora y se usa el predeterminado */
    }
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

export const publicSettings = () => getSettings();

export function updateSettings(patch) {
  const clean = {};
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    if (NUMBER_KEYS.includes(key)) {
      const n = Math.round(Number(value));
      if (!Number.isFinite(n) || n < 0) continue;
      clean[key] = n;
    } else if (key === 'deliveryFeePresets') {
      clean[key] = (Array.isArray(value) ? value : [])
        .map((v) => Math.round(Number(v)))
        .filter((v) => Number.isFinite(v) && v >= 0)
        .slice(0, 8);
    } else if (key === 'turnsMarquee') {
      clean[key] = (Array.isArray(value) ? value : [])
        .map((v) => String(v).trim())
        .filter(Boolean)
        .slice(0, 12);
    } else if (BOOLEAN_KEYS.includes(key)) {
      clean[key] = Boolean(value);
    } else {
      clean[key] = String(value ?? '').slice(0, 300);
    }
  }
  if (clean.tables != null) clean.tables = Math.min(Math.max(clean.tables, 1), 60);
  if (clean.dayCutoffHour != null) clean.dayCutoffHour = Math.min(clean.dayCutoffHour, 11);
  tx(() => {
    for (const [key, value] of Object.entries(clean)) {
      q.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
    }
  });
  return getSettings();
}

/** Día de operación (YYYY-MM-DD) en la zona horaria del negocio, respetando la hora de corte. */
export function businessDay(ts = Date.now(), settings = getSettings()) {
  const shifted = new Date(ts - settings.dayCutoffHour * 3_600_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: settings.timezone || 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}
