import { useState } from 'react';
import { Plus, Search, Sparkles, X } from 'lucide-react';
import { Logo, Visual, toast, toastError } from '../../shared/components/ui';
import { api } from '../../shared/lib/api';
import { refreshBootstrap, useLive } from '../../shared/lib/live';
import { money } from '../../shared/lib/format';
import { fromPrice } from '../../shared/lib/pricing';
import { ProductEditor } from './ProductEditor';
import type { Product } from '../../shared/types';

export function ProductsPanel() {
  const { bootstrap } = useLive();
  const catalog = bootstrap!.catalog;
  const [cat, setCat] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  const q = query.trim().toLowerCase();
  const list = catalog.products.filter((p) => (cat === 'all' || p.categoryId === cat) && (!q || p.name.toLowerCase().includes(q)));
  const withoutPhoto = catalog.products.filter((p) => !p.image).length;

  const toggle = async (p: Product, patch: Partial<Product>) => {
    try {
      await api.put(`/products/${p.id}`, { ...p, ...patch });
      await refreshBootstrap();
      if ('active' in patch) toast(patch.active ? `${p.name} disponible` : `${p.name} marcado como agotado`, { kind: 'info', art: p.icon });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="ap">
      <aside className="ap-cats">
        <button className={`ap-cat ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
          <span className="ap-cat-icon">
            <Logo kind="hat" />
          </span>
          <span className="grow">Todos</span>
          <b className="num">{catalog.products.length}</b>
        </button>
        {catalog.categories.map((c) => (
          <button key={c.id} className={`ap-cat ${cat === c.id ? 'on' : ''} ${c.active ? '' : 'off'}`} onClick={() => setCat(c.id)}>
            <span className="ap-cat-icon">
              <Visual image={c.image} imageFit={c.imageFit} icon={c.icon} />
            </span>
            <span className="grow ellipsis">{c.name}</span>
            <b className="num">{catalog.products.filter((p) => p.categoryId === c.id).length}</b>
          </button>
        ))}
      </aside>

      <section className="ap-main">
        <header className="ap-head">
          <label className="search">
            <Search />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto…" />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Limpiar">
                <X />
              </button>
            )}
          </label>
          {withoutPhoto > 0 && (
            <span className="chip gold">
              {withoutPhoto} sin foto · toca uno para subirla
            </span>
          )}
          <div className="spacer" />
          <button className="btn primary" onClick={() => setEditing('new')} disabled={!catalog.categories.length}>
            <Plus /> Nuevo producto
          </button>
        </header>

        <div className="ap-grid">
          <button className="ap-new" onClick={() => setEditing('new')} disabled={!catalog.categories.length}>
            <Plus />
            <b>Nuevo producto</b>
            <small>{catalog.categories.length ? 'Con foto, opciones e ingredientes' : 'Crea primero una categoría'}</small>
          </button>
          {list.map((p) => {
            const { price, from } = fromPrice(p);
            return (
              <article key={p.id} className={`pcard ap-card ${p.image ? 'with-photo' : ''} ${p.active ? '' : 'sold-out'}`}>
                <button className="ap-card-open" onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`}>
                  <div className="pcard-visual">
                    <Visual image={p.image} imageFit={p.imageFit} icon={p.icon} alt={p.name} />
                    {!p.image && <span className="ap-nophoto">Sin foto</span>}
                    {!p.active && <span className="ap-soldout display">Agotado</span>}
                  </div>
                  <div className="pcard-info">
                    <div className="pcard-name">{p.name}</div>
                    <div className="pcard-meta">
                      <span className="pcard-price num">
                        {from && <small>desde </small>}
                        {money(price)}
                      </span>
                      <span className="pcard-opts">{p.ingredients.length} ingred.</span>
                    </div>
                  </div>
                </button>
                <div className="ap-card-bar">
                  <label className="switch" title="Disponible en la caja">
                    <input type="checkbox" checked={p.active} onChange={(e) => toggle(p, { active: e.target.checked })} />
                    <span>{p.active ? 'Disponible' : 'Agotado'}</span>
                  </label>
                  <button className={`ap-star ${p.featured ? 'on' : ''}`} onClick={() => toggle(p, { featured: !p.featured })} title="Destacado">
                    <Sparkles />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {editing && <ProductEditor product={editing} catalog={catalog} defaultCategory={cat === 'all' ? (catalog.categories[0]?.id ?? 0) : cat} onClose={() => setEditing(null)} />}
    </div>
  );
}
