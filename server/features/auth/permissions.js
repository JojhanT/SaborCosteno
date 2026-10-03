import { HttpError } from '../../core/http-error.js';

/*
 * Roles del personal y qué puede hacer cada uno. Es la única fuente de verdad:
 * el cliente recibe la lista de permisos del usuario en /auth/me.
 *   admin      → todo
 *   mesero     → arma los pedidos, cocina, despacha y entrega; no toca plata
 *   cajero     → cobra, anula cobros y ve la contabilidad; no toca los pedidos
 *   cocinero   → pantalla de cocina y marcar pedidos como listos
 *   repartidor → sus domicilios asignados y marcarlos como entregados
 */

export const ROLES = ['admin', 'mesero', 'cajero', 'cocinero', 'repartidor'];

export const ROLE_LABEL = { admin: 'Administrador', mesero: 'Mesero', cajero: 'Cajero', cocinero: 'Cocinero', repartidor: 'Repartidor' };

const PERMISSIONS = {
  'orders.manage': ['admin', 'mesero'], // tomar, editar y cancelar pedidos
  'orders.charge': ['admin', 'cajero'], // cobrar y anular cobros
  'orders.kitchen': ['admin', 'mesero', 'cocinero'], // marcar listo / devolver a cocina
  'orders.dispatch': ['admin', 'mesero'], // asignar domicilios a un repartidor
  // cerrar un domicilio en camino: además del permiso, tiene que ser el repartidor
  // asignado (el admin es la única excepción) — ver canCloseDelivery
  'orders.deliver': ['admin', 'repartidor'],
  'reports.view': ['admin', 'cajero'], // historial y cuadre del día
  'catalog.manage': ['admin'],
  'settings.manage': ['admin'],
  'users.manage': ['admin'],
  'screens.kitchen': ['admin', 'cocinero'],
  'screens.turns': ['admin', 'mesero', 'cajero', 'cocinero'],
  'delivery.view': ['admin', 'repartidor'],
};

export const can = (user, permission) => !!user && user.active !== 0 && (PERMISSIONS[permission]?.includes(user.role) ?? false);

export const permissionsOf = (user) => (user ? Object.keys(PERMISSIONS).filter((p) => can(user, p)) : []);

/**
 * Un domicilio que ya salió con un repartidor solo lo cierra ese repartidor: así el
 * registro dice de verdad quién lo entregó y quién recibió la plata. El administrador
 * es la salida de emergencia (en la bitácora queda que lo cerró él).
 */
export const canCloseDelivery = (user, order) => user?.role === 'admin' || (!!order.courier_id && order.courier_id === user?.id);

/** Middleware: exige al menos uno de los permisos indicados. */
export const requirePermission =
  (...permissions) =>
  (req, _res, next) => {
    if (permissions.some((p) => can(req.user, p))) return next();
    throw new HttpError(403, 'Tu usuario no tiene permiso para esto');
  };
