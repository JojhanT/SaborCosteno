import { HttpError } from './http-error.js';

/** Cabeceras básicas: nada de iframes ajenos ni adivinar tipos de archivo. */
export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

/**
 * Freno a peticiones desde otras páginas (CSRF): los cambios solo se aceptan
 * en JSON y, si el navegador dice de dónde vienen, deben venir de esta misma app.
 */
export function sameOriginOnly(req, _res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.get('origin');
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {
      /* origen inválido */
    }
    if (host !== req.get('host')) throw new HttpError(403, 'Petición rechazada: no viene de esta aplicación');
  }
  if (req.method !== 'DELETE' && !req.is('application/json')) throw new HttpError(415, 'Formato no válido');
  next();
}
