import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, Sparkles, X } from 'lucide-react';
import { Logo, Visual } from '../../shared/components/ui';
import { money } from '../../shared/lib/format';
import { fromPrice } from '../../shared/lib/pricing';
import { useDraft } from './draft';
import type { Catalog, Category, Product } from '../../shared/types';

type CatKey = number | 'all' | 'top';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const Menu = memo(function Menu({ catalog, onPick }: { catalog: Catalog; onPick: (p: Product, source: Element | null) => void }) {
  const [cat, setCat] = useState<CatKey>('all');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const draft = useDraft();

  const inCart = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of draft.lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
    return m;
  }, [draft.lines]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === '/' && !typing && !document.querySelector('.modal')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const categories = catalog.categories.filter((c) => c.active);
  const available = catalog.products.filter((p) => p.active && categories.some((c) => c.id === p.categoryId));
  const q = norm(query.trim());
  const filtered = available.filter((p) => {
    if (q) return norm(`${p.name} ${p.description} ${p.options.map((o) => o.name).join(' ')}`).includes(q);
    if (cat === 'all') return true;
    if (cat === 'top') return p.featured;
    return p.categoryId === cat;
  });

  const groups: { category: Category | null; products: Product[] }[] =
    cat === 'all' && !q
      ? categories.map((c) => ({ category: c, products: filtered.filter((p) => p.categoryId === c.id) })).filter((g) => g.products.length)
      : [{ category: null, products: filtered }];

  const current = typeof cat === 'number' ? categories.find((c) => c.id === cat) : null;
  const title = q ? `Resultados para “${query.trim()}”` : cat === 'top' ? 'Los más pedidos' : current ? current.name : 'Todo el menú';

  return (
    <div className="menu">
      <nav className="rail" aria-label="Categorías">
        <RailItem active={cat === 'all' && !q} onClick={() => (setCat('all'), setQuery(''))} label="Todo">
          <Logo kind="hat" className="rail-hat" />
        </RailItem>
        <RailItem active={cat === 'top' && !q} onClick={() => (setCat('top'), setQuery(''))} label="Top">
          <Sparkles className="rail-spark" />
        </RailItem>
        <div className="rail-sep" />
        {categories.map((c) => (
          <RailItem key={c.id} active={cat === c.id && !q} onClick={() => (setCat(c.id), setQuery(''))} label={c.name}>
            <Visual image={c.image} imageFit={c.imageFit} icon={c.icon} />
          </RailItem>
        ))}
      </nav>

      <section className="menu-main">
        <header className="menu-head">
          <div className="menu-title">
            <h1 className="display">{title}</h1>
            <span className="muted">
              {filtered.length} producto{filtered.length === 1 ? '' : 's'}
            </span>
          </div>
          <label className="search">
            <Search />
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto…" aria-label="Buscar producto" />
            {query ? (
              <button onClick={() => setQuery('')} aria-label="Limpiar">
                <X />
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </label>
        </header>

        <div className="menu-scroll">
          <AnimatePresence mode="popLayout">
            {groups.map((g) => (
              <motion.div key={`${String(cat)}-${g.category?.id ?? 'flat'}-${q}`} className="menu-group" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                {g.category && (
                  <h2 className="menu-group-title">
                    <span className="menu-group-icon">
                      <Visual image={g.category.image} imageFit={g.category.imageFit} icon={g.category.icon} />
                    </span>
                    {g.category.name}
                    <i />
                  </h2>
                )}
                <div className="pgrid">
                  {g.products.map((p, i) => (
                    <ProductCard key={p.id} product={p} count={inCart.get(p.id) ?? 0} index={i} onPick={onPick} />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="empty">
              <div className="art-wrap">
                <Logo kind="hat" />
              </div>
              <h3>{available.length ? 'Nada por aquí' : 'Aún no hay productos'}</h3>
              <p>{available.length ? 'Prueba con otra palabra o categoría.' : 'Agrega productos desde Menú y ajustes.'}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
});

function RailItem({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button className={`rail-item ${active ? 'on' : ''}`} onClick={onClick} title={label}>
      {active && <motion.span layoutId="rail-active" className="rail-active" transition={{ type: 'spring', damping: 26, stiffness: 380 }} />}
      <span className="rail-icon">{children}</span>
      <span className="rail-label">{label}</span>
    </button>
  );
}

const ProductCard = memo(function ProductCard({ product, count, index, onPick }: { product: Product; count: number; index: number; onPick: (p: Product, el: Element | null) => void }) {
  const visualRef = useRef<HTMLDivElement>(null);
  const { price, from } = fromPrice(product);
  const photo = !!product.image;
  return (
    <motion.button
      className={`pcard ${photo ? 'with-photo' : ''} ${count ? 'in-cart' : ''}`}
      onClick={() => onPick(product, visualRef.current)}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index, 12) * 0.025, type: 'spring', damping: 24, stiffness: 260 }}
      whileTap={{ scale: 0.96 }}
    >
      <div className="pcard-visual" ref={visualRef}>
        <Visual image={product.image} imageFit={product.imageFit} icon={product.icon} alt={product.name} />
      </div>
      {product.featured && (
        <span className="pcard-badge">
          <Sparkles /> Top
        </span>
      )}
      <AnimatePresence>
        {count > 0 && (
          <motion.span key="count" className="pcard-count num" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', damping: 14, stiffness: 400 }}>
            {count}
          </motion.span>
        )}
      </AnimatePresence>
      <div className="pcard-info">
        <div className="pcard-name">{product.name}</div>
        <div className="pcard-meta">
          <span className="pcard-price num">
            {from && <small>desde </small>}
            {money(price)}
          </span>
          {product.options.length > 1 && (
            <span className="pcard-opts">
              {product.options.length} {product.optionsLabel.toLowerCase() === 'tamaño' ? 'tamaños' : 'opciones'}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
});
