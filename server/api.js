import express from "express";
import { q } from "./core/db.js";
import { HttpError } from "./core/http-error.js";
import { sameOriginOnly } from "./core/security.js";
import { setStreamValidator, streamHandler } from "./core/events.js";
import { lanUrls, PUBLIC_URL } from "./core/net.js";
import { authenticate, authRouter } from "./features/auth/auth.routes.js";
import { can } from "./features/auth/permissions.js";
import { validateSessionId } from "./features/auth/sessions.js";
import { usersRouter } from "./features/users/users.routes.js";
import { settingsRouter } from "./features/settings/settings.routes.js";
import {
  publicSettings,
  businessCard,
  businessDay,
} from "./features/settings/settings.service.js";
import { catalogRouter } from "./features/catalog/catalog.routes.js";
import { getCatalog } from "./features/catalog/catalog.service.js";
import { uploadsRouter } from "./features/uploads/uploads.routes.js";
import { ordersRouter } from "./features/orders/orders.routes.js";
import { deliveryRouter } from "./features/delivery/delivery.routes.js";
import { nextTurn } from "./features/orders/orders.service.js";

/** API de la app: cada feature aporta sus rutas y sus permisos. */
export const api = express.Router();

api.use(sameOriginOnly);
// para Docker y monitores: responde si el servidor y la base están bien
api.get("/health", async (_req, res) => {
  await q.get("SELECT 1");
  res.json({ ok: true });
});
/*
 * La carta que abre el cliente con el QR: la única pantalla sin sesión además del
 * ingreso. Va aquí arriba, antes de `authenticate`, y manda solo el menú y los datos
 * del negocio — nunca el costo de preparación ni lo que no esté disponible.
 */
api.get("/carta", async (_req, res) => {
  const [negocio, catalogo] = await Promise.all([
    businessCard(),
    getCatalog({ withCost: false }),
  ]);
  const disponible = (x) => x.active;
  res.json({
    negocio,
    categorias: catalogo.categories.filter(disponible).map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      image: c.image,
      imageFit: c.imageFit,
    })),
    productos: catalogo.products.filter(disponible).map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      description: p.description,
      price: p.price,
      optionsLabel: p.optionsLabel,
      options: p.options,
      ingredients: p.ingredients,
      icon: p.icon,
      image: p.image,
      imageFit: p.imageFit,
      featured: p.featured,
    })),
    salsas: catalogo.sauces.filter(disponible).map((s) => ({ id: s.id, name: s.name, color: s.color })),
    adiciones: catalogo.extras.filter(disponible).map((e) => ({ id: e.id, name: e.name, price: e.price })),
  });
});

// sin sesión solo se puede usar /auth (iniciar sesión, configuración inicial)
api.use(authRouter);
api.use(authenticate);

// las conexiones en vivo se revisan cada minuto (sesión vencida o usuario desactivado)
setStreamValidator((client) => validateSessionId(client.sessionId));

api.get("/bootstrap", async (req, res) => {
  const [settings, catalog, turn, day] = await Promise.all([
    publicSettings(),
    getCatalog({ withCost: can(req.user, "catalog.manage") }),
    nextTurn(),
    businessDay(),
  ]);
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

api.get("/stream", streamHandler);

api.use(usersRouter);
api.use(settingsRouter);
api.use(catalogRouter);
api.use(uploadsRouter);
api.use(ordersRouter);
api.use(deliveryRouter);

api.use((_req, _res) => {
  throw new HttpError(404, "Ruta no encontrada");
});
