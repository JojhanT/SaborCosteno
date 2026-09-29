import { HttpError } from '../../core/http-error.js';

/*
 * Roles del personal y qué puede hacer cada uno. Es la única fuente de verdad:
 * el cliente recibe la lista de permisos del usuario en /auth/me.
 *   admin      → todo
 *   cajero     → caja, pedidos y contabilidad
 *   cocinero   → pantalla de cocina y marcar pedidos como listos
 *   repartidor → sus domicilios asignados y marcarlos como entregados
 */

export const ROLES = ['admin', 'cajero', 'cocinero', 'repartidor'];

export const ROLE_LABEL = { admin: 'Administrador', cajero: 'Cajero', cocinero: 'Cocinero', repartidor: 'Repartidor' };

const PERMISSIONS = {
  'orders.manage': ['admin', 'cajero'], // tomar, editar, cobrar y cancelar pedidos
  'orders.kitchen': ['admin', 'cajero', 'cocinero'], // marcar listo / devolver a cocina
  'orders.dispatch': ['admin', 'cajero'], // asignar domicilios a un repartidor
  'orders.deliver': ['admin', 'cajero', 'repartidor'], // marcar un domicilio como entregado
  'reports.view': ['admin', 'cajero'], // historial y cuadre del día
  'catalog.manage': ['admin'],
  'settings.manage': ['admin'],
  'users.manage': ['admin'],
  'screens.kitchen': ['admin', 'cocinero'],
  'screens.turns': ['admin', 'cajero', 'cocinero'],
  'delivery.view': ['admin', 'repartidor'],
};

export const can = (user, permission) => !!user && user.active !== 0 && (PERMISSIONS[permission]?.includes(user.role) ?? false);

export const permissionsOf = (user) => (user ? Object.keys(PERMISSIONS).filter((p) => can(user, p)) : []);

/** Middleware: exige al menos uno de los permisos indicados. */
export const requirePermission =
  (...permissions) =>
  (req, _res, next) => {
    if (permissions.some((p) => can(req.user, p))) return next();
    throw new HttpError(403, 'Tu usuario no tiene permiso para esto');
  };
