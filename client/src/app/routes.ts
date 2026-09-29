import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { can, type Me, type Permission } from '../shared/lib/session';
import type { Role, Settings } from '../shared/types';

/*
 * Pantallas de la app y quién puede abrir cada una. El servidor vuelve a
 * revisar cada permiso: esto solo decide qué se muestra.
 */

export interface Screen {
  path: string;
  title: string;
  permission: Permission;
  /** Además del permiso, la pantalla puede estar apagada en Ajustes. */
  enabled?: (s: Settings) => boolean;
  component: LazyExoticComponent<ComponentType>;
}

export const SCREENS: Screen[] = [
  { path: '/caja', title: 'Caja', permission: 'orders.manage', component: lazy(() => import('../features/pos/Pos')) },
  { path: '/cocina', title: 'Cocina', permission: 'screens.kitchen', component: lazy(() => import('../features/kitchen/Kitchen')) },
  { path: '/reparto', title: 'Reparto', permission: 'delivery.view', component: lazy(() => import('../features/delivery/Delivery')) },
  { path: '/turnos', title: 'Turnos', permission: 'screens.turns', enabled: (s) => s.turnsScreenEnabled, component: lazy(() => import('../features/turns/Turns')) },
  { path: '/admin', title: 'Administración', permission: 'catalog.manage', component: lazy(() => import('../features/admin/Admin')) },
  { path: '/galeria', title: 'Ilustraciones', permission: 'catalog.manage', component: lazy(() => import('../features/catalog/Gallery')) },
];

export const findScreen = (path: string) => SCREENS.find((s) => s.path === path);

export const canOpen = (screen: Screen, me: Me, settings: Settings | undefined) => can(me, screen.permission) && (!screen.enabled || (!!settings && screen.enabled(settings)));

/** Pantallas del inicio (sin las de uso interno como la galería). */
export const homeScreens = (me: Me, settings: Settings | undefined) => SCREENS.filter((s) => s.path !== '/galeria' && canOpen(s, me, settings));

const PRIMARY: Partial<Record<Role, string>> = { cajero: '/caja', cocinero: '/cocina', repartidor: '/reparto' };

/** A dónde va cada quien al iniciar sesión: el administrador al inicio, los demás a su pantalla. */
export const landingPath = (me: Me) => (me.user && PRIMARY[me.user.role]) || '/';

/** El inicio solo tiene sentido si hay más de una pantalla para elegir. */
export const skipsHome = (me: Me, settings: Settings | undefined) => me.user?.role !== 'admin' && homeScreens(me, settings).length <= 1;
