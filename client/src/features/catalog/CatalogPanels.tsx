import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, ArrowUp, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Modal, ModalClose, Visual, ask, toast, toastError } from '../../shared/components/ui';
import { api } from '../../shared/lib/api';
import { refreshBootstrap, useLive } from '../../shared/lib/live';
import { money, plain } from '../../shared/lib/format';
import { ImagePicker } from './ImagePicker';
import type { Category, Extra, Sauce } from '../../shared/types';

async function run<T>(fn: () => Promise<T>, ok?: string) {
  try {
    const r = await fn();
    await refreshBootstrap();
    if (ok) toast(ok, { kind: 'success' });
    return r;
  } catch (err) {
    toastError(err);
    return null;
  }
}

async function reorder(entity: string, ids: number[], index: number, dir: -1 | 1) {
  const j = index + dir;
  if (j < 0 || j >= ids.length) return;
  const next = [...ids];
  [next[index], next[j]] = [next[j], next[index]];
  await run(() => api.post(`/${entity}/reorder`, { ids: next }));
}

/* ------------------------------------------------------------ categorías */

export function CategoriesPanel() {
  const { bootstrap } = useLive();
  const { categories, products } = bootstrap!.catalog;
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const ids = categories.map((c) => c.id);

  return (
    <div className="apanel">
      <header className="apanel-head">
        <div>
          <h2 className="display">Categorías</h2>
          <p className="muted">El orden aquí es el orden en la caja y en la cocina.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>
          <Plus /> Nueva categoría
        </button>
      </header>
      <div className="cat-list">
        <AnimatePresence initial={false}>
          {categories.map((c, i) => {
            const count = products.filter((p) => p.categoryId === c.id).length;
            return (
              <motion.div key={c.id} layout className={`cat-row ${c.active ? '' : 'off'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="cat-order">
                  <button className="btn sm icon ghost" disabled={i === 0} onClick={() => reorder('categories', ids, i, -1)} aria-label="Subir">
                    <ArrowUp />
                  </button>
                  <button className="btn sm icon ghost" disabled={i === categories.length - 1} onClick={() => reorder('categories', ids, i, 1)} aria-label="Bajar">
                    <ArrowDown />
                  </button>
                </div>
                <Visual className="cat-visual" image={c.image} imageFit={c.imageFit} icon={c.icon} />
                <div className="grow">
                  <b className="display cat-name">{c.name}</b>
                  <span className="muted">
                    {count} producto{count === 1 ? '' : 's'}
                  </span>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={c.active} onChange={(e) => run(() => api.put(`/categories/${c.id}`, { ...c, active: e.target.checked }))} />
                  <span>{c.active ? 'Visible' : 'Oculta'}</span>
                </label>
                <button className="btn sm outline" onClick={() => setEditing(c)}>
                  <Pencil /> Editar
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {editing && <CategoryEditor category={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryEditor({ category, onClose }: { category: Category | 'new'; onClose: () => void }) {
  const isNew = category === 'new';
  const [d, setD] = useState<Omit<Category, 'id' | 'sort'> & { id?: number }>(isNew ? { name: '', icon: 'salchipapa', image: null, imageFit: 'cover', active: true } : { ...category });
  const save = async () => {
    if (!d.name.trim()) return toast('Ponle nombre a la categoría', { kind: 'error' });
    const r = await run(() => (isNew ? api.post('/categories', d) : api.put(`/categories/${d.id}`, d)), isNew ? 'Categoría creada' : 'Categoría guardada');
    if (r) onClose();
  };
  const remove = async () => {
    if (isNew) return;
    const ok = await ask({ title: `¿Eliminar “${d.name}”?`, text: 'Solo se puede si no tiene productos.', confirm: 'Eliminar', danger: true, art: d.icon });
    if (ok && (await run(() => api.del(`/categories/${d.id}`), 'Categoría eliminada'))) onClose();
  };
  return (
    <Modal open onClose={onClose} className="ce">
      <ModalClose onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="ce-body">
          <h2 className="display">{isNew ? 'Nueva categoría' : 'Editar categoría'}</h2>
          <label className="field">
            <span>Nombre</span>
            <input className="input" autoFocus value={d.name} maxLength={40} placeholder="Ej: Salchipapas" onChange={(e) => setD({ ...d, name: e.target.value })} />
          </label>
          <ImagePicker image={d.image} imageFit={d.imageFit} icon={d.icon} label="Foto de la categoría" onChange={(p) => setD({ ...d, ...p })} />
        </div>
        <footer className="pe-foot">
          {!isNew && (
            <button type="button" className="btn danger" onClick={remove}>
              <Trash2 /> Eliminar
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            <Save /> Guardar
          </button>
        </footer>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------- salsas */

const SAUCE_COLORS = ['#E0452B', '#F6E7B8', '#F39A8B', '#FFC53D', '#7A3414', '#E2B21A', '#D5DDB0', '#EFE6CF', '#FFF6E6', '#C0291D', '#6DB33F', '#F38120'];

export function SaucesPanel() {
  const { bootstrap } = useLive();
  const { sauces } = bootstrap!.catalog;
  const [name, setName] = useState('');
  const [color, setColor] = useState(SAUCE_COLORS[0]);
  const ids = sauces.map((s) => s.id);

  const add = async () => {
    if (!name.trim()) return;
    if (await run(() => api.post('/sauces', { name, color }), `Salsa ${name} agregada`)) setName('');
  };

  return (
    <div className="apanel">
      <header className="apanel-head">
        <div>
          <h2 className="display">Salsas</h2>
          <p className="muted">En la caja se tocan una vez para ponerlas encima y dos veces para aparte.</p>
        </div>
      </header>

      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <ColorPick value={color} onChange={setColor} />
        <input className="input grow" value={name} placeholder="Nueva salsa (ej: Tamarindo)" maxLength={40} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary" disabled={!name.trim()}>
          <Plus /> Agregar
        </button>
      </form>

      <div className="sauce-grid">
        {sauces.map((s, i) => (
          <SauceCard key={s.id} sauce={s} first={i === 0} last={i === sauces.length - 1} onMove={(dir) => reorder('sauces', ids, i, dir)} />
        ))}
      </div>
    </div>
  );
}

function SauceCard({ sauce, first, last, onMove }: { sauce: Sauce; first: boolean; last: boolean; onMove: (d: -1 | 1) => void }) {
  const [name, setName] = useState(sauce.name);
  const save = (patch: Partial<Sauce>) => run(() => api.put(`/sauces/${sauce.id}`, { ...sauce, ...patch }));
  const remove = async () => {
    const ok = await ask({ title: `¿Eliminar la salsa ${sauce.name}?`, confirm: 'Eliminar', danger: true, art: 'salsa' });
    if (ok) await run(() => api.del(`/sauces/${sauce.id}`), 'Salsa eliminada');
  };
  return (
    <div className={`sauce-card ${sauce.active ? '' : 'off'}`} style={{ '--sauce': sauce.color } as CSSProperties}>
      <div className="sauce-card-top">
        <ColorPick value={sauce.color} onChange={(c) => save({ color: c })} />
        <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== sauce.name && save({ name })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      </div>
      <div className="sauce-card-bar">
        <label className="switch">
          <input type="checkbox" checked={sauce.active} onChange={(e) => save({ active: e.target.checked })} />
          <span>{sauce.active ? 'Disponible' : 'Agotada'}</span>
        </label>
        <div className="row" style={{ gap: 2 }}>
          <button className="btn sm icon ghost" disabled={first} onClick={() => onMove(-1)} aria-label="Antes">
            <ArrowUp />
          </button>
          <button className="btn sm icon ghost" disabled={last} onClick={() => onMove(1)} aria-label="Después">
            <ArrowDown />
          </button>
          <button className="btn sm icon ghost" onClick={remove} aria-label="Eliminar">
            <Trash2 />
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorPick({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="colorpick">
      <button type="button" className="colorpick-swatch" style={{ background: value }} onClick={() => setOpen(!open)} aria-label="Color" />
      <AnimatePresence>
        {open && (
          <motion.div className="colorpick-pop" initial={{ opacity: 0, scale: 0.9, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
            {SAUCE_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={value.toLowerCase() === c.toLowerCase() ? 'on' : ''}
                style={{ background: c }}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                aria-label={c}
              />
            ))}
            <label className="colorpick-custom" title="Otro color">
              <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} onBlur={() => setOpen(false)} />+
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------- adiciones */

export function ExtrasPanel() {
  const { bootstrap } = useLive();
  const { extras } = bootstrap!.catalog;
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const ids = extras.map((e) => e.id);

  const add = async () => {
    if (!name.trim()) return;
    if (await run(() => api.post('/extras', { name, price: Number(price) || 0 }), `${name} agregada`)) {
      setName('');
      setPrice('');
    }
  };

  return (
    <div className="apanel">
      <header className="apanel-head">
        <div>
          <h2 className="display">Adiciones</h2>
          <p className="muted">Extras con costo que se suman al precio del producto.</p>
        </div>
      </header>
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input className="input grow" value={name} placeholder="Nueva adición (ej: Extra tocineta)" maxLength={40} onChange={(e) => setName(e.target.value)} />
        <div className="input-money" style={{ width: 160 }}>
          <input className="input num" inputMode="numeric" value={price ? plain(Number(price)) : ''} placeholder="Precio" onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 7))} />
        </div>
        <button className="btn primary" disabled={!name.trim()}>
          <Plus /> Agregar
        </button>
      </form>
      <div className="extra-list">
        {extras.map((x, i) => (
          <ExtraRow key={x.id} extra={x} first={i === 0} last={i === extras.length - 1} onMove={(dir) => reorder('extras', ids, i, dir)} />
        ))}
      </div>
    </div>
  );
}

function ExtraRow({ extra, first, last, onMove }: { extra: Extra; first: boolean; last: boolean; onMove: (d: -1 | 1) => void }) {
  const [name, setName] = useState(extra.name);
  const [price, setPrice] = useState(String(extra.price));
  const save = (patch: Partial<Extra>) => run(() => api.put(`/extras/${extra.id}`, { ...extra, ...patch }));
  const remove = async () => {
    const ok = await ask({ title: `¿Eliminar “${extra.name}”?`, confirm: 'Eliminar', danger: true, art: 'queso' });
    if (ok) await run(() => api.del(`/extras/${extra.id}`), 'Adición eliminada');
  };
  const blur = (e: KeyboardEvent) => e.key === 'Enter' && (e.target as HTMLInputElement).blur();
  return (
    <div className={`extra-row ${extra.active ? '' : 'off'}`}>
      <span className="extra-row-plus">+</span>
      <input className="input grow" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== extra.name && save({ name })} onKeyDown={blur} />
      <div className="input-money" style={{ width: 150 }}>
        <input
          className="input num"
          inputMode="numeric"
          value={price ? plain(Number(price)) : ''}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 7))}
          onBlur={() => Number(price) !== extra.price && save({ price: Number(price) || 0 })}
          onKeyDown={blur}
        />
      </div>
      <span className="extra-row-price muted num">{money(extra.price)}</span>
      <label className="switch">
        <input type="checkbox" checked={extra.active} onChange={(e) => save({ active: e.target.checked })} />
      </label>
      <button className="btn sm icon ghost" disabled={first} onClick={() => onMove(-1)} aria-label="Subir">
        <ArrowUp />
      </button>
      <button className="btn sm icon ghost" disabled={last} onClick={() => onMove(1)} aria-label="Bajar">
        <ArrowDown />
      </button>
      <button className="btn sm icon ghost" onClick={remove} aria-label="Eliminar">
        <Trash2 />
      </button>
    </div>
  );
}
