import express from 'express';
import { q } from './core/db.js';
import { HttpError } from './core/http-error.js';
import { sameOriginOnly } from './core/security.js';
import { setStreamValidator, streamHandler } from './core/events.js';
import { lanUrls, PUBLIC_URL } from './core/net.js';
import { authenticate, authRouter } from './features/auth/auth.routes.js';
import { can } from './features/auth/permissions.js';
import { validateSessionId } from './features/auth/sessions.js';
import { usersRouter } from './features/users/users.routes.js';
import { settingsRouter } from './features/settings/settings.routes.js';
import { publicSettings, businessDay } from './features/settings/settings.service.js';
import { catalogRouter } from './features/catalog/catalog.routes.js';
import { getCatalog } from './features/catalog/catalog.service.js';
import { uploadsRouter } from './features/uploads/uploads.routes.js';
import { ordersRouter } from './features/orders/orders.routes.js';
import { deliveryRouter } from './features/delivery/delivery.routes.js';
import { nextTurn } from './features/orders/orders.service.js';

/** API de la app: cada feature aporta sus rutas y sus permisos. */
export const api = express.Router();

api.use(sameOriginOnly);
// para Docker y monitores: responde si el servidor y la base están bien
api.get('/health', async (_req, res) => {
  await q.get('SELECT 1');
  res.json({ ok: true });
});
// sin sesión solo se puede usar /auth (iniciar sesión, configuración inicial)
api.use(authRouter);
api.use(authenticate);

// las conexiones en vivo se revisan cada minuto (sesión vencida o usuario desactivado)
setStreamValidator((client) => validateSessionId(client.sessionId));

api.get('/bootstrap', async (req, res) => {
  const [settings, catalog, turn, day] = await Promise.all([publicSettings(), getCatalog({ withCost: can(req.user, 'catalog.manage') }), nextTurn(), businessDay()]);
  res.json({
    settings,
    catalog,
    lan: lanUrls(),
    online: !!PUBLIC_URL,
    serverTime: Date.now(),
    nextTurn: turn,
    businessDay: day,
  });
});

api.get('/stream', streamHandler);

api.use(usersRouter);
api.use(settingsRouter);
api.use(catalogRouter);
api.use(uploadsRouter);
api.use(ordersRouter);
api.use(deliveryRouter);

api.use((_req, _res) => {
  throw new HttpError(404, 'Ruta no encontrada');
});
