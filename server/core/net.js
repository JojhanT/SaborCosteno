import os from 'node:os';

export const PORT = Number(process.env.PORT) || 3000;

/** Dirección pública cuando corre en un servidor en internet (ej. https://pedidos.midominio.com). */
export const PUBLIC_URL = String(process.env.PUBLIC_URL ?? '').trim().replace(/\/+$/, '');

/**
 * Detrás de un proxy (Caddy, nginx) la IP real del cliente y si entró por HTTPS
 * llegan en las cabeceras X-Forwarded-*. TRUST_PROXY dice de quién creerlas:
 * un número de saltos, "loopback", "uniquelocal" o una lista de IPs. Sin definir,
 * no se cree a nadie (uso en la red del local).
 */
export function trustProxy() {
  const value = String(process.env.TRUST_PROXY ?? '').trim();
  if (!value || value === 'false' || value === '0') return false;
  if (value === 'true') return true;
  return /^\d+$/.test(value) ? Number(value) : value;
}

/** Direcciones para abrir la app desde los televisores y tablets (la pública, si la hay). */
export function lanUrls() {
  if (PUBLIC_URL) return [PUBLIC_URL];
  const found = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const addr of list ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (/vEthernet|VirtualBox|VMware|WSL|Hyper-V|Loopback|Docker/i.test(name)) continue;
      // 192.168.56.x es la red interna por defecto de VirtualBox
      const virtual = addr.address.startsWith('192.168.56.') || addr.address.startsWith('169.254.');
      const wifi = /wi-?fi|wlan|inal/i.test(name);
      found.push({ url: `http://${addr.address}:${PORT}`, score: (virtual ? 10 : 0) + (wifi ? 0 : 1) });
    }
  }
  return found.sort((a, b) => a.score - b.score).map((f) => f.url);
}
