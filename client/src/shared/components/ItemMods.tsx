import { Ban, Droplet, MessageSquareText, Plus, Split } from 'lucide-react';
import type { CartLine, ItemExtra, ItemSauce } from '../types';
import type { indexCatalog } from '../lib/pricing';

export interface Mods {
  removed: string[];
  aparte: string[];
  sauces: Pick<ItemSauce, 'name' | 'color' | 'mode'>[];
  extras: Pick<ItemExtra, 'name' | 'price'>[];
  note: string;
}

export function lineMods(line: CartLine, idx: ReturnType<typeof indexCatalog>): Mods {
  return {
    removed: line.removed,
    aparte: line.aparte,
    sauces: line.sauces.map((s) => ({ ...(idx.sauces.get(s.id) ?? { name: '¿salsa?', color: '#999' }), mode: s.mode })),
    extras: line.extras.map((id) => idx.extras.get(id)).filter((e): e is NonNullable<typeof e> => !!e),
    note: line.note,
  };
}

export const hasMods = (m: Mods) => m.removed.length + m.aparte.length + m.sauces.length + m.extras.length > 0 || !!m.note;

/**
 * Modificaciones de un producto.
 *  - `chips`: compacto, para la caja.
 *  - `kitchen`: grande y por renglones, para el TV de cocina.
 */
export function ItemMods({ mods, variant = 'chips' }: { mods: Mods; variant?: 'chips' | 'kitchen' }) {
  const sauceCon = mods.sauces.filter((s) => s.mode === 'con');
  const sauceAparte = mods.sauces.filter((s) => s.mode === 'aparte');

  if (variant === 'chips') {
    if (!hasMods(mods)) return null;
    return (
      <div className="mods-chips">
        {mods.removed.map((r) => (
          <span key={`r-${r}`} className="mchip m-sin">
            Sin {r.toLowerCase()}
          </span>
        ))}
        {mods.aparte.map((r) => (
          <span key={`a-${r}`} className="mchip m-aparte">
            {r} aparte
          </span>
        ))}
        {sauceCon.map((s) => (
          <span key={`s-${s.name}`} className="mchip m-salsa">
            <i className="dot" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        {sauceAparte.map((s) => (
          <span key={`sa-${s.name}`} className="mchip m-aparte">
            <i className="dot" style={{ background: s.color }} />
            {s.name} aparte
          </span>
        ))}
        {mods.extras.map((e) => (
          <span key={`e-${e.name}`} className="mchip m-extra">
            + {e.name}
          </span>
        ))}
        {mods.note && <span className="mchip m-note">“{mods.note}”</span>}
      </div>
    );
  }

  // cada elemento es una pastilla que se acomoda en varias líneas: con muchas
  // salsas o adiciones la tarjeta crece hacia abajo en vez de desbordarse
  return (
    <div className="kmods">
      {mods.removed.length > 0 && (
        <div className="kmod sin">
          <Ban />
          <span className="kmod-tag">SIN</span>
          <span className="kmod-list">
            {mods.removed.map((r) => (
              <span key={r} className="kmod-item">
                {r}
              </span>
            ))}
          </span>
        </div>
      )}
      {(mods.aparte.length > 0 || sauceAparte.length > 0) && (
        <div className="kmod aparte">
          <Split />
          <span className="kmod-tag">APARTE</span>
          <span className="kmod-list">
            {mods.aparte.map((r) => (
              <span key={`i-${r}`} className="kmod-item">
                {r}
              </span>
            ))}
            {sauceAparte.map((s) => (
              <span key={`s-${s.name}`} className="kmod-item">
                <i className="dot" style={{ background: s.color }} />
                Salsa {s.name.toLowerCase()}
              </span>
            ))}
          </span>
        </div>
      )}
      {sauceCon.length > 0 && (
        <div className="kmod salsa">
          <Droplet />
          <span className="kmod-list">
            {sauceCon.map((s) => (
              <span key={s.name} className="kmod-item">
                <i className="dot" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </span>
        </div>
      )}
      {mods.extras.length > 0 && (
        <div className="kmod extra">
          <Plus />
          <span className="kmod-tag">EXTRA</span>
          <span className="kmod-list">
            {mods.extras.map((e) => (
              <span key={e.name} className="kmod-item">
                {e.name}
              </span>
            ))}
          </span>
        </div>
      )}
      {mods.note && (
        <div className="kmod note">
          <MessageSquareText />
          <span>“{mods.note}”</span>
        </div>
      )}
    </div>
  );
}
