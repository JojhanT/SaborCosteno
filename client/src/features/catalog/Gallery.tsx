import { Art, FOOD_ART } from '../../shared/components/Art';

const UI_ART = ['mesa', 'llevar', 'domicilio', 'efectivo', 'tarjeta', 'movil', 'banco', 'caja', 'cocina', 'turnos', 'menu', 'campana'];

/** Muestrario de ilustraciones (útil para escoger íconos). */
export default function Gallery() {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
        {[...FOOD_ART.map((a) => a.key), ...UI_ART].map((key) => (
          <div key={key} style={{ background: 'radial-gradient(circle at 50% 40%, #4a260f, #25130a)', borderRadius: 18, padding: 14, textAlign: 'center' }}>
            <div style={{ width: '100%', aspectRatio: '1', padding: 10 }}>
              <Art name={key} accent={key === 'movil' ? '#C21A7E' : undefined} />
            </div>
            <div style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{key}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
