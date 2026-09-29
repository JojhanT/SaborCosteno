import { useSyncExternalStore } from 'react';
import type { CartLine, Order, OrderType } from '../../shared/types';

/*
 * Pedido en construcción. Vive fuera de React y se guarda en localStorage,
 * así un refresco accidental de la caja no borra lo que se estaba tomando.
 */

export interface Draft {
  editingId: number | null;
  editingTurn: number | null;
  editingPaid: boolean;
  editingTotal: number;
  type: OrderType | null;
  tableNumber: number | null;
  customerName: string;
  phone: string;
  address: string;
  addressRef: string;
  deliveryFee: number | null;
  note: string;
  lines: CartLine[];
}

const KEY = 'sabor.draft.v1';

const EMPTY: Draft = {
  editingId: null,
  editingTurn: null,
  editingPaid: false,
  editingTotal: 0,
  type: null,
  tableNumber: null,
  customerName: '',
  phone: '',
  address: '',
  addressRef: '',
  deliveryFee: null,
  note: '',
  lines: [],
};

function restore(): Draft {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* sin almacenamiento */
  }
  return EMPTY;
}

let draft: Draft = restore();
const listeners = new Set<() => void>();

function commit(next: Draft) {
  draft = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* sin almacenamiento */
  }
  listeners.forEach((l) => l());
}

export const newKey = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function useDraft() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => draft,
  );
}

export const draftActions = {
  set(patch: Partial<Draft>) {
    commit({ ...draft, ...patch });
  },
  setType(type: OrderType) {
    commit({ ...draft, type });
  },
  addLine(line: CartLine) {
    // si ya existe una línea idéntica, solo se suma la cantidad
    const same = draft.lines.find((l) => !l.id && sameChoice(l, line));
    if (same) {
      commit({ ...draft, lines: draft.lines.map((l) => (l === same ? { ...l, qty: Math.min(99, l.qty + line.qty) } : l)) });
    } else {
      commit({ ...draft, lines: [...draft.lines, line] });
    }
  },
  updateLine(key: string, line: CartLine) {
    commit({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...line, key, id: l.id } : l)) });
  },
  setQty(key: string, qty: number) {
    if (qty <= 0) return draftActions.removeLine(key);
    commit({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(99, qty) } : l)) });
  },
  removeLine(key: string) {
    commit({ ...draft, lines: draft.lines.filter((l) => l.key !== key) });
  },
  reset() {
    commit(EMPTY);
  },
  loadOrder(order: Order) {
    commit({
      editingId: order.id,
      editingTurn: order.turn,
      editingPaid: order.paid,
      editingTotal: order.total,
      type: order.type,
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      phone: order.phone,
      address: order.address,
      addressRef: order.addressRef,
      deliveryFee: order.type === 'domicilio' ? order.deliveryFee : null,
      note: order.note,
      lines: order.items.map((i) => ({
        key: newKey(),
        id: i.id,
        productId: i.productId,
        qty: i.qty,
        option: i.optionName || null,
        removed: i.removed,
        aparte: i.aparte,
        sauces: i.sauces.map((s) => ({ id: s.id, mode: s.mode })),
        extras: i.extras.map((e) => e.id),
        note: i.note,
      })),
    });
  },
};

function sameChoice(a: CartLine, b: CartLine) {
  const norm = (l: CartLine) =>
    JSON.stringify([l.productId, l.option, [...l.removed].sort(), [...l.aparte].sort(), [...l.sauces].sort((x, y) => x.id - y.id), [...l.extras].sort(), l.note.trim()]);
  return norm(a) === norm(b);
}

export function draftPayload(d: Draft, defaultFee: number) {
  return {
    type: d.type,
    tableNumber: d.tableNumber,
    customerName: d.customerName.trim(),
    phone: d.phone.trim(),
    address: d.address.trim(),
    addressRef: d.addressRef.trim(),
    deliveryFee: d.type === 'domicilio' ? (d.deliveryFee ?? defaultFee) : 0,
    note: d.note.trim(),
    items: d.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      qty: l.qty,
      option: l.option,
      removed: l.removed,
      aparte: l.aparte,
      sauces: l.sauces,
      extras: l.extras,
      note: l.note,
    })),
  };
}
