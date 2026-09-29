import { useState, type KeyboardEvent } from 'react';
import { GripVertical, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { Modal, ModalClose, Visual, ask, toast, toastError } from '../../shared/components/ui';
import { api } from '../../shared/lib/api';
import { refreshBootstrap } from '../../shared/lib/live';
import { money, plain } from '../../shared/lib/format';
import { fromPrice } from '../../shared/lib/pricing';
import { ImagePicker } from './ImagePicker';
import type { Catalog, Product, ProductOption } from '../../shared/types';

type Draft = Omit<Product, 'id' | 'sort'> & { id?: number };

const blank = (categoryId: number): Draft => ({
  categoryId,
  name: '',
  description: '',
  price: 0,
  cost: null,
  icon: 'salchipapa',
  image: null,
  imageFit: 'cover',
  optionsLabel: 'Tamaño',
  options: [],
  ingredients: [],
  allowSauces: true,
  allowExtras: true,
  featured: false,
  active: true,
});

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 9);

export function ProductEditor({ product, catalog, defaultCategory, onClose }: { product: Product | 'new'; catalog: Catalog; defaultCategory: number; onClose: () => void }) {
  const [d, setD] = useState<Draft>(() => (product === 'new' ? blank(defaultCategory) : { ...product, options: product.options.map((o) => ({ ...o })), ingredients: [...product.ingredients] }));
  const [ingText, setIngText] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const isNew = product === 'new';

  const addIngredient = () => {
    const parts = ingText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const lower = new Set(d.ingredients.map((i) => i.toLowerCase()));
    set({ ingredients: [...d.ingredients, ...parts.filter((p) => !lower.has(p.toLowerCase()))] });
    setIngText('');
  };
  const onIngKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addIngredient();
    } else if (e.key === 'Backspace' && !ingText && d.ingredients.length) {
      set({ ingredients: d.ingredients.slice(0, -1) });
    }
  };
  const setOption = (i: number, patch: Partial<ProductOption>) => set({ options: d.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  const moveOption = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.options.length) return;
    const next = [...d.options];
    [next[i], next[j]] = [next[j], next[i]];
    set({ options: next });
  };

  const save = async () => {
    if (!d.name.trim()) return toast('Ponle nombre al producto', { kind: 'error' });
    setBusy(true);
    try {
      const body = { ...d, options: d.options.filter((o) => o.name.trim()) };
      if (isNew) await api.post('/products', body);
      else await api.put(`/products/${d.id}`, body);
      await refreshBootstrap();
      toast(isNew ? 'Producto creado' : 'Cambios guardados', { text: d.name, art: d.icon });
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (isNew) return onClose();
    const ok = await ask({ title: `¿Eliminar “${d.name}”?`, text: 'Dejará de aparecer en la caja. Los pedidos anteriores no se afectan.', confirm: 'Eliminar', danger: true, art: d.icon });
    if (!ok) return;
    try {
      await api.del(`/products/${d.id}`);
      await refreshBootstrap();
      toast('Producto eliminado', { kind: 'info' });
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  const preview: Product = { ...d, id: d.id ?? 0, sort: 0 };
  const { price, from } = fromPrice(preview);
  const margin = d.cost != null && price > 0 ? Math.round(((price - d.cost) / price) * 100) : null;

  return (
    <Modal open onClose={onClose} className="pe" labelledBy="pe-title">
      <ModalClose onClose={onClose} />
      <form
        className="pe-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="pe-grid">
          <aside className="pe-side">
            <ImagePicker image={d.image} imageFit={d.imageFit} icon={d.icon} onChange={set} />
            <div className="pe-preview">
              <span className="pe-preview-label">Así se verá en la caja</span>
              <div className={`pcard ${d.image ? 'with-photo' : ''}`}>
                <div className="pcard-visual">
                  <Visual image={d.image} imageFit={d.imageFit} icon={d.icon} />
                </div>
                {d.featured && (
                  <span className="pcard-badge">
                    <Sparkles /> Top
                  </span>
                )}
                <div className="pcard-info">
                  <div className="pcard-name">{d.name || 'Nombre del producto'}</div>
                  <div className="pcard-meta">
                    <span className="pcard-price num">
                      {from && <small>desde </small>}
                      {money(price)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="pe-body">
            <h2 id="pe-title" className="display">
              {isNew ? 'Nuevo producto' : 'Editar producto'}
            </h2>

            <div className="pe-row">
              <label className="field grow">
                <span>Nombre</span>
                <input className="input" autoFocus={isNew} value={d.name} maxLength={60} placeholder="Ej: Salchipapa Clásica" onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label className="field" style={{ width: 220 }}>
                <span>Categoría</span>
                <select className="input" value={d.categoryId} onChange={(e) => set({ categoryId: Number(e.target.value) })}>
                  {catalog.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span>Descripción corta (opcional)</span>
              <input className="input" value={d.description} maxLength={240} placeholder="Lo que la hace especial" onChange={(e) => set({ description: e.target.value })} />
            </label>

            <div className="pe-row">
              <label className="field grow">
                <span>{d.options.some((o) => o.price != null) ? 'Precio base (si la opción no tiene precio)' : 'Precio de venta'}</span>
                <div className="input-money">
                  <input className="input num" inputMode="numeric" value={d.price ? plain(d.price) : ''} placeholder="0" onChange={(e) => set({ price: Number(digits(e.target.value)) || 0 })} />
                </div>
              </label>
              <label className="field grow">
                <span>Costo (opcional · para ganancias)</span>
                <div className="input-money">
                  <input className="input num" inputMode="numeric" value={d.cost != null ? plain(d.cost) : ''} placeholder="—" onChange={(e) => set({ cost: digits(e.target.value) ? Number(digits(e.target.value)) : null })} />
                </div>
              </label>
              {margin != null && (
                <div className={`pe-margin ${margin < 30 ? 'low' : ''}`}>
                  <span>Margen</span>
                  <b className="num">{margin}%</b>
                </div>
              )}
            </div>

            <section className="pe-sec">
              <header>
                <h3>Opciones</h3>
                <span className="muted">Tamaños, sabores, rellenos… el cliente elige una</span>
              </header>
              {d.options.length > 0 && (
                <label className="field">
                  <span>Nombre del grupo</span>
                  <input className="input" value={d.optionsLabel} maxLength={30} placeholder="Tamaño, Sabor, Relleno…" onChange={(e) => set({ optionsLabel: e.target.value })} />
                </label>
              )}
              <div className="pe-options">
                {d.options.map((o, i) => (
                  <div key={i} className="pe-option">
                    <button type="button" className="pe-grip" onClick={() => moveOption(i, -1)} title="Subir">
                      <GripVertical />
                    </button>
                    <input className="input" value={o.name} placeholder="Ej: Mediana" onChange={(e) => setOption(i, { name: e.target.value })} />
                    <div className="input-money pe-option-price">
                      <input
                        className="input num"
                        inputMode="numeric"
                        placeholder="Mismo precio"
                        value={o.price != null ? plain(o.price) : ''}
                        onChange={(e) => setOption(i, { price: digits(e.target.value) ? Number(digits(e.target.value)) : null })}
                      />
                    </div>
                    <button type="button" className="btn sm icon ghost" onClick={() => set({ options: d.options.filter((_, idx) => idx !== i) })} aria-label="Quitar opción">
                      <X />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn sm outline" onClick={() => set({ options: [...d.options, { name: '', price: null }] })}>
                <Plus /> Agregar opción
              </button>
            </section>

            <section className="pe-sec">
              <header>
                <h3>Ingredientes</h3>
                <span className="muted">Vienen por defecto; en caja se pueden quitar o pedir aparte</span>
              </header>
              <div className="tag-input" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
                {d.ingredients.map((ing) => (
                  <span key={ing} className="tag">
                    {ing}
                    <button type="button" onClick={() => set({ ingredients: d.ingredients.filter((x) => x !== ing) })} aria-label={`Quitar ${ing}`}>
                      <X />
                    </button>
                  </span>
                ))}
                <input value={ingText} placeholder={d.ingredients.length ? 'Agregar…' : 'Escribe y presiona Enter (ej: Cebolla)'} onChange={(e) => setIngText(e.target.value)} onKeyDown={onIngKey} onBlur={addIngredient} />
              </div>
            </section>

            <section className="pe-toggles">
              <label className="switch">
                <input type="checkbox" checked={d.allowSauces} onChange={(e) => set({ allowSauces: e.target.checked })} />
                Lleva salsas
              </label>
              <label className="switch">
                <input type="checkbox" checked={d.allowExtras} onChange={(e) => set({ allowExtras: e.target.checked })} />
                Permite adiciones
              </label>
              <label className="switch">
                <input type="checkbox" checked={d.featured} onChange={(e) => set({ featured: e.target.checked })} />
                Destacado (Top)
              </label>
              <label className="switch">
                <input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} />
                Disponible
              </label>
            </section>
          </div>
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
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? <span className="spinner" /> : <Save />}
            {isNew ? 'Crear producto' : 'Guardar cambios'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
