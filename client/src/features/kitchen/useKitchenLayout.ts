import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/*
 * Cómo se acomodan las tarjetas de la cocina (la pantalla nunca hace scroll).
 *
 * Las tarjetas van en columnas CSS. Una tarjeta más alta que la columna se
 * parte y sigue en la siguiente ("Sigue →"). Para decidirlo sin depender de
 * cómo el navegador partió las cosas, cada tarjeta se dibuja también en una
 * capa invisible del ancho de una columna, sin columnas: esa es su altura
 * "natural". Con eso:
 *   - se sabe de forma exacta cuáles no caben (y se vuelve a calcular si cambia
 *     el ancho, el alto, el tamaño de letra, las fuentes o el pedido);
 *   - si una tarjeta en pantalla no mide lo mismo que su copia natural, el
 *     navegador se quedó con una medida vieja: se vuelve a acomodar sola.
 */

const PAD = 16; // .k-grid padding
const GAP = 16; // .k-grid column-gap
const MIN_COL = 160; // una columna nunca queda más angosta que esto
const TOLERANCE = 6; // px de diferencia que se aceptan (redondeos)
const MAX_REMOUNTS = 2;

interface Natural {
  height: number;
  fresh: boolean;
  /** Productos tan altos que conviene dejarlos partir entre columnas. */
  bigItems: number[];
}

export interface HiddenTurn {
  turn: number;
  /** Se ve el comienzo, pero el final quedó fuera de la pantalla. */
  partial: boolean;
}

export function useKitchenLayout({
  gridRef,
  measureRef,
  queueKey,
  columns,
  scale,
}: {
  gridRef: RefObject<HTMLDivElement | null>;
  measureRef: RefObject<HTMLDivElement | null>;
  /** Cambia cuando cambian los pedidos en cola o su contenido. */
  queueKey: string;
  columns: number;
  scale: number;
}) {
  /* ---- tamaño real (con decimales) del área de tarjetas, sin el relleno ---- */
  const [box, setBox] = useState({ width: 0, height: 0 });
  // antes del primer dibujo, para no acomodar nada con un tamaño provisional
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      const next = { width: Math.max(0, r.width - PAD * 2), height: Math.max(0, r.height - PAD * 2) };
      setBox((prev) => (Math.abs(prev.width - next.width) < 0.01 && Math.abs(prev.height - next.height) < 0.01 ? prev : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridRef]);

  const width = box.width || 1568;
  const wanted = columns || Math.max(1, Math.min(6, Math.floor((width + PAD * 2) / (400 * scale))));
  // con columnas elegidas a mano en una pantalla angosta, se usan menos para no bajar de MIN_COL
  const cols = Math.max(1, Math.min(wanted, Math.floor((width + GAP) / (MIN_COL + GAP))));
  // exactamente el ancho que calcula el navegador para cada columna
  const colWidth = (width - GAP * (cols - 1)) / cols;
  const maxHeight = box.height;
  // columnas angostas: se quita el ícono del encabezado para que quepa «PARA LLEVAR» junto al cronómetro
  const narrow = colWidth < 408 * scale;

  /* ---- altura natural de cada tarjeta (capa invisible) ---- */
  const [natural, setNatural] = useState<Map<number, Natural>>(() => new Map());
  useLayoutEffect(() => {
    const layer = measureRef.current;
    if (!layer) return;
    const read = () => {
      const next = new Map<number, Natural>();
      layer.querySelectorAll<HTMLElement>('[data-measure]').forEach((card) => {
        // con decimales: en la capa no hay animación ni transform que la deforme
        const height = card.getBoundingClientRect().height;
        const bigItems = [...card.querySelectorAll<HTMLElement>('[data-item]')].filter((i) => i.getBoundingClientRect().height > box.height / 2).map((i) => Number(i.dataset.item));
        next.set(Number(card.dataset.measure), { height, fresh: card.classList.contains('fresh'), bigItems });
      });
      setNatural((prev) => {
        const same =
          prev.size === next.size &&
          [...next].every(([id, n]) => {
            const p = prev.get(id);
            return p && Math.abs(p.height - n.height) < 0.01 && p.fresh === n.fresh && p.bigItems.join() === n.bigItems.join();
          });
        return same ? prev : next;
      });
    };
    read();
    // cualquier cambio de tamaño de una copia (fuentes que llegan, se quita el "¡Nuevo!"…) se vuelve a leer
    const ro = new ResizeObserver(read);
    layer.querySelectorAll('[data-measure]').forEach((card) => ro.observe(card));
    void document.fonts?.ready.then(read);
    return () => ro.disconnect();
  }, [measureRef, queueKey, colWidth, scale, narrow, box.height]);

  const ready = box.height > 0;
  // margen menor que una unidad de dibujo del navegador: solo absorbe el ruido de los decimales
  const isTall = (id: number) => ready && (natural.get(id)?.height ?? 0) > maxHeight + 0.01;
  const bigItems = (id: number) => natural.get(id)?.bigItems;

  /* ---- turnos que no caben (+N en espera) y tarjetas con medida vieja ---- */
  const [hidden, setHidden] = useState<HiddenTurn[]>([]);
  const [remounts, setRemounts] = useState<Map<number, number>>(() => new Map());
  const attempts = useRef(new Map<string, number>());
  const signature = `${cols}|${Math.round(colWidth)}|${Math.round(box.height)}|${scale}|${queueKey}`;

  useLayoutEffect(() => {
    const el = gridRef.current;
    const layer = measureRef.current;
    if (!el || !layer) return;
    // la altura natural se lee de la capa en este mismo momento (el estado puede ir un paso atrás)
    const naturalOf = (card: HTMLElement) => layer.querySelector<HTMLElement>(`[data-measure="${card.dataset.id}"]`);
    const timerText = (card: HTMLElement) => card.querySelector('.kcard-timer')?.textContent ?? '';
    const differs = (card: HTMLElement) => {
      const copy = naturalOf(card);
      if (!copy) return false;
      // solo se comparan tarjetas que muestran lo mismo que su copia en este instante
      if (copy.classList.contains('fresh') !== card.classList.contains('fresh')) return false;
      if (timerText(copy) !== timerText(card)) return false;
      if (card.querySelector('.kcard-done:disabled')) return false; // tocaron «Listo» y está enviando
      // y con el mismo ancho (offsetWidth no cuenta la animación de entrada, que escala la tarjeta)
      if (Math.abs(copy.offsetWidth - card.offsetWidth) > 1) return false;
      return Math.abs(card.offsetHeight - copy.offsetHeight) > TOLERANCE;
    };
    const check = () => {
      if (!ready) return;
      const limit = el.getBoundingClientRect().right + 2;
      const out: HiddenTurn[] = [];
      const stale: HTMLElement[] = [];
      el.querySelectorAll<HTMLElement>('[data-turn]').forEach((card) => {
        // una tarjeta partida tiene un rectángulo por columna: se mira el primero y el último
        const rects = card.getClientRects();
        const first = rects[0];
        const last = rects[rects.length - 1];
        if (first && first.left >= limit - 10) out.push({ turn: Number(card.dataset.turn), partial: false });
        else if (last && last.left >= limit - 10) out.push({ turn: Number(card.dataset.turn), partial: true });
        if (!card.classList.contains('tall') && differs(card)) stale.push(card);
      });
      setHidden((prev) => (prev.length === out.length && prev.every((h, i) => h.turn === out[i].turn && h.partial === out[i].partial) ? prev : out));
      if (!stale.length) return;

      // primero se obliga al navegador a volver a acomodar la tarjeta: se le cambia el ancho
      // un pixel y se le devuelve (no se alcanza a ver y no reinicia la animación de entrada)
      for (const card of stale) {
        card.style.width = 'calc(100% - 1px)';
        void card.offsetHeight;
        card.style.width = '';
        void card.offsetHeight;
      }
      const still = stale.filter(differs);
      if (!still.length) return;

      // si sigue mal, se vuelve a crear desde cero (con un límite para no entrar en un ciclo)
      const bump: number[] = [];
      for (const card of still) {
        const id = Number(card.dataset.id);
        const key = `${id}|${signature}`;
        const n = attempts.current.get(key) ?? 0;
        if (n >= MAX_REMOUNTS) continue;
        attempts.current.set(key, n + 1);
        bump.push(id);
        console.warn(`[cocina] turno #${card.dataset.turn}: medía ${card.offsetHeight}px y debía medir ${naturalOf(card)?.offsetHeight}px; se vuelve a dibujar`);
      }
      if (bump.length) setRemounts((prev) => new Map([...prev, ...bump.map((id) => [id, (prev.get(id) ?? 0) + 1] as [number, number])]));
    };
    check();
    void document.fonts?.ready.then(check);
    const t = setTimeout(check, 400);
    // red de seguridad: si el navegador deja una medida vieja sin que nada cambie, se corrige sola
    const every = setInterval(check, 4000);
    return () => {
      clearTimeout(t);
      clearInterval(every);
    };
  }, [gridRef, measureRef, signature, natural, remounts, ready]);

  return { cols, colWidth, narrow, isTall, bigItems, hidden, remountKey: (id: number) => remounts.get(id) ?? 0 };
}
