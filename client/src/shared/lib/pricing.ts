import type { CartLine, Catalog, Extra, Product } from '../types';

/** Mismo cálculo que hace el servidor (el servidor siempre tiene la última palabra). */
export function basePrice(product: Product, option: string | null) {
  const opt = product.options.find((o) => o.name === option);
  return opt?.price ?? product.price;
}

export function unitPrice(product: Product, line: Pick<CartLine, 'option' | 'extras'>, extras: Map<number, Extra>) {
  const add = product.allowExtras ? line.extras.reduce((s, id) => s + (extras.get(id)?.price ?? 0), 0) : 0;
  return basePrice(product, line.option) + add;
}

export function linePrice(product: Product, line: CartLine, extras: Map<number, Extra>) {
  return unitPrice(product, line, extras) * line.qty;
}

/** Precio que se muestra en la tarjeta: el menor de sus opciones. */
export function fromPrice(product: Product) {
  const prices = product.options.map((o) => o.price ?? product.price);
  if (!prices.length) return { price: product.price, from: false };
  const min = Math.min(...prices);
  return { price: min, from: prices.some((p) => p !== min) };
}

export function needsCustomizing(product: Product) {
  return product.options.length > 0 || product.ingredients.length > 0 || product.allowSauces || product.allowExtras;
}

export function indexCatalog(catalog: Catalog | undefined) {
  return {
    products: new Map((catalog?.products ?? []).map((p) => [p.id, p])),
    extras: new Map((catalog?.extras ?? []).map((e) => [e.id, e])),
    sauces: new Map((catalog?.sauces ?? []).map((s) => [s.id, s])),
    categories: new Map((catalog?.categories ?? []).map((c) => [c.id, c])),
  };
}
