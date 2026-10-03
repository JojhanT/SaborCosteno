import { useEffect, useState } from 'react';
// lucide ya no trae iconos de marcas (Instagram, Facebook), así que van neutros
import { AtSign, Clock, Globe, MapPin, Phone } from 'lucide-react';
import { Art } from '../../shared/components/Art';
import { Logo, Visual } from '../../shared/components/ui';
import { Splash } from '../../shared/components/Splash';
import { money } from '../../shared/lib/format';
import './carta.css';

/*
 * La carta que ve el cliente al escanear el QR del local. Es la única pantalla sin
 * sesión: sale del catálogo en vivo, así que al cambiar un precio en el administrador
 * ya está actualizada, sin volver a imprimir nada.
 */

interface Categoria {
  id: number;
  name: string;
  icon: string;
  image: string | null;
  imageFit: 'cover' | 'contain';
}

interface Producto {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  optionsLabel: string;
  options: { name: string; price: number | null }[];
  ingredients: string[];
  icon: string;
  image: string | null;
  imageFit: 'cover' | 'contain';
  featured: boolean;
}

interface Negocio {
  businessName: string;
  slogan: string;
  address: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  hours: string;
}

interface Datos {
  negocio: Negocio;
  categorias: Categoria[];
  productos: Producto[];
  salsas: { id: number; name: string; color: string }[];
  adiciones: { id: number; name: string; price: number }[];
}

const soloDigitos = (s: string) => s.replace(/\D/g, '');
const sinArroba = (s: string) => s.trim().replace(/^@/, '');

/**
 * Las opciones de un producto pueden ser dos cosas distintas y se muestran distinto:
 * tamaños que cambian el precio (cada uno con el suyo) o elecciones que no lo cambian,
 * como el tipo de pan (van como lista, con el precio del producto una sola vez).
 */
function Opciones({ producto: p }: { producto: Producto }) {
  if (p.options.length === 0) return <b className="num carta-precio">{money(p.price)}</b>;

  const etiqueta = p.optionsLabel?.trim() || 'Opción';
  const cambianPrecio = p.options.some((o) => o.price != null);

  if (!cambianPrecio) {
    return (
      <div className="carta-eleccion">
        <b className="num carta-precio">{money(p.price)}</b>
        <p>
          <span className="carta-etiqueta">{etiqueta}:</span> {p.options.map((o) => o.name).join(' · ')}
        </p>
      </div>
    );
  }

  return (
    <div className="carta-opciones">
      <span className="carta-etiqueta">{etiqueta}</span>
      <div className="carta-tamanos">
        {p.options.map((o) => (
          <span key={o.name} className="carta-tamano">
            <small>{o.name}</small>
            <b className="num">{money(o.price ?? p.price)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Carta() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.body.classList.add('carta-body');
    fetch('/api/carta')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no disponible'))))
      .then(setDatos)
      .catch(() => setError(true));
    return () => document.body.classList.remove('carta-body');
  }, []);

  useEffect(() => {
    if (datos) document.title = `Carta · ${datos.negocio.businessName}`;
  }, [datos]);

  if (error) {
    return (
      <div className="carta-aviso">
        <Logo kind="hat" className="carta-aviso-hat" />
        <h1 className="display">No pudimos cargar la carta</h1>
        <p>Revisa tu conexión y vuelve a intentar.</p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!datos) return <Splash text="Cargando la carta…" />;

  const { negocio, categorias, productos, salsas, adiciones } = datos;
  const conProductos = categorias.map((c) => ({ categoria: c, items: productos.filter((p) => p.categoryId === c.id) })).filter((g) => g.items.length > 0);
  const wa = soloDigitos(negocio.whatsapp);
  // cada categoría toma un color de la marca, como las secciones del menú impreso
  const TONOS = ['orange', 'gold', 'sea', 'terra'];

  return (
    <div className="carta">
      <header className="carta-top">
        <Logo kind="sabor" tone="cream" className="carta-logo" />
        {negocio.slogan && <p className="carta-lema">{negocio.slogan}</p>}
        <div className="band thin" />
      </header>

      {conProductos.length === 0 ? (
        <p className="carta-vacia">Estamos preparando la carta. Vuelve pronto.</p>
      ) : (
        <main className="carta-cuerpo">
          {conProductos.map(({ categoria, items }, i) => (
            <section key={categoria.id} className={`carta-cat tono-${TONOS[i % TONOS.length]}`}>
              <header className="carta-cat-top">
                <span className="carta-cat-art">
                  <Art name={categoria.icon} />
                </span>
                <h2 className="display">{categoria.name}</h2>
              </header>

              <ul className="carta-items">
                {items.map((p) => (
                  <li key={p.id} className={`carta-item ${p.featured ? 'destacado' : ''}`}>
                    <Visual className="carta-foto" image={p.image} imageFit={p.imageFit} icon={p.icon} alt={p.name} />

                    <div className="carta-texto">
                      <h3>
                        {p.name}
                        {p.featured && <span className="carta-estrella">la que más piden</span>}
                      </h3>
                      {p.description && <p className="carta-desc">{p.description}</p>}
                      {p.ingredients.length > 0 && <p className="carta-ingr">{p.ingredients.join(' · ')}</p>}

                      <Opciones producto={p} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {(salsas.length > 0 || adiciones.length > 0) && (
            <section className="carta-extras">
              {salsas.length > 0 && (
                <div>
                  <h2 className="display">Salsas</h2>
                  <p className="carta-desc">Van incluidas, pídelas como quieras.</p>
                  <ul className="carta-salsas">
                    {salsas.map((s) => (
                      <li key={s.id}>
                        <i style={{ background: s.color }} />
                        {s.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {adiciones.length > 0 && (
                <div>
                  <h2 className="display">Adiciones</h2>
                  <p className="carta-desc">Para armarlo a tu gusto.</p>
                  <ul className="carta-adiciones">
                    {adiciones.map((a) => (
                      <li key={a.id}>
                        <span>{a.name}</span>
                        <b className="num">{money(a.price)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </main>
      )}

      <footer className="carta-pie">
        <div className="band thin" />
        <h2 className="display">{negocio.businessName}</h2>
        <div className="carta-datos">
          {negocio.address && (
            <span>
              <MapPin /> {negocio.address}
            </span>
          )}
          {negocio.hours && (
            <span>
              <Clock /> {negocio.hours}
            </span>
          )}
          {negocio.phone && (
            <a href={`tel:${soloDigitos(negocio.phone)}`}>
              <Phone /> {negocio.phone}
            </a>
          )}
          {wa && (
            <a href={`https://wa.me/${wa.length <= 10 ? `57${wa}` : wa}`} target="_blank" rel="noreferrer">
              <Art name="domicilio" /> WhatsApp {negocio.whatsapp}
            </a>
          )}
          {negocio.instagram && (
            <a href={`https://instagram.com/${sinArroba(negocio.instagram)}`} target="_blank" rel="noreferrer">
              <AtSign /> {sinArroba(negocio.instagram)} en Instagram
            </a>
          )}
          {negocio.facebook && (
            <a href={`https://facebook.com/${sinArroba(negocio.facebook)}`} target="_blank" rel="noreferrer">
              <Globe /> {sinArroba(negocio.facebook)} en Facebook
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
