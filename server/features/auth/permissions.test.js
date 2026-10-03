import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ROLE_LABEL, can, canCloseDelivery, permissionsOf } from './permissions.js';

/*
 * Quién puede hacer qué. Esta tabla es la decisión del negocio escrita como prueba:
 * si alguien cambia un permiso sin querer, aquí se cae.
 */

const user = (role, extra = {}) => ({ id: 1, role, active: 1, ...extra });

/** Lo que cada rol SÍ puede hacer. Todo lo que no esté aquí, no puede. */
const EXPECTED = {
  admin: [
    'orders.manage',
    'orders.charge',
    'orders.kitchen',
    'orders.dispatch',
    'orders.deliver',
    'reports.view',
    'catalog.manage',
    'settings.manage',
    'users.manage',
    'screens.kitchen',
    'screens.turns',
    'delivery.view',
  ],
  mesero: ['orders.manage', 'orders.kitchen', 'orders.dispatch', 'screens.turns'],
  cajero: ['orders.charge', 'reports.view', 'screens.turns'],
  cocinero: ['orders.kitchen', 'screens.kitchen', 'screens.turns'],
  repartidor: ['orders.deliver', 'delivery.view'],
};

describe('permisos por rol', () => {
  for (const [role, allowed] of Object.entries(EXPECTED)) {
    test(`${role} tiene exactamente los suyos`, () => {
      assert.deepEqual(permissionsOf(user(role)).sort(), [...allowed].sort());
    });
  }

  test('los roles declarados y la tabla de prueba son los mismos', () => {
    assert.deepEqual([...ROLES].sort(), Object.keys(EXPECTED).sort());
  });

  test('cada rol tiene su nombre para mostrar', () => {
    for (const role of ROLES) assert.ok(ROLE_LABEL[role], `falta la etiqueta de ${role}`);
  });
});

describe('la plata y los pedidos van separados', () => {
  test('el mesero toma pedidos pero no cobra', () => {
    const mesero = user('mesero');
    assert.ok(can(mesero, 'orders.manage'));
    assert.ok(!can(mesero, 'orders.charge'), 'el mesero no puede cobrar');
  });

  test('el cajero cobra pero no toca los pedidos', () => {
    const cajero = user('cajero');
    assert.ok(can(cajero, 'orders.charge'));
    assert.ok(!can(cajero, 'orders.manage'), 'el cajero no puede crear ni editar pedidos');
    assert.ok(!can(cajero, 'orders.kitchen'), 'el cajero no mueve pedidos en cocina');
  });

  test('el cajero sí ve la contabilidad y el mesero no', () => {
    assert.ok(can(user('cajero'), 'reports.view'));
    assert.ok(!can(user('mesero'), 'reports.view'));
  });

  test('solo el admin junta las dos cosas', () => {
    const both = ROLES.filter((r) => can(user(r), 'orders.manage') && can(user(r), 'orders.charge'));
    assert.deepEqual(both, ['admin']);
  });
});

describe('un usuario desactivado no puede nada', () => {
  for (const role of ROLES) {
    test(`${role} desactivado`, () => {
      assert.deepEqual(permissionsOf(user(role, { active: 0 })), []);
    });
  }

  test('sin usuario tampoco', () => {
    assert.deepEqual(permissionsOf(null), []);
    assert.ok(!can(null, 'orders.manage'));
    assert.ok(!can(undefined, 'orders.charge'));
  });
});

describe('el domicilio lo cierra quien lo lleva', () => {
  const enCamino = { courier_id: 7 };

  test('el repartidor asignado puede', () => {
    assert.ok(canCloseDelivery(user('repartidor', { id: 7 }), enCamino));
  });

  test('otro repartidor no', () => {
    assert.ok(!canCloseDelivery(user('repartidor', { id: 8 }), enCamino));
  });

  test('el mesero tampoco, aunque sea quien despachó', () => {
    assert.ok(!canCloseDelivery(user('mesero', { id: 3 }), enCamino));
  });

  test('el cajero tampoco', () => {
    assert.ok(!canCloseDelivery(user('cajero', { id: 4 }), enCamino));
  });

  test('el admin sí, para destrabarlo', () => {
    assert.ok(canCloseDelivery(user('admin', { id: 99 }), enCamino));
  });

  test('sin repartidor asignado solo el admin', () => {
    const sinRepartidor = { courier_id: null };
    assert.ok(canCloseDelivery(user('admin', { id: 99 }), sinRepartidor));
    assert.ok(!canCloseDelivery(user('repartidor', { id: 7 }), sinRepartidor));
  });

  test('sin sesión no', () => {
    assert.ok(!canCloseDelivery(null, enCamino));
  });
});
