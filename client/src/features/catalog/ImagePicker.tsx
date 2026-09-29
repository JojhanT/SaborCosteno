import { useRef, useState } from 'react';
import { Crop, ImagePlus, Maximize2, Trash2, UploadCloud } from 'lucide-react';
import { Art, FOOD_ART } from '../../shared/components/Art';
import { Visual, toastError } from '../../shared/components/ui';
import { uploadImage } from '../../shared/lib/image';
import type { ImageFit } from '../../shared/types';

interface Props {
  image: string | null;
  imageFit: ImageFit;
  icon: string;
  onChange: (patch: { image?: string | null; imageFit?: ImageFit; icon?: string }) => void;
  label?: string;
}

/** Subir foto (arrastrar, pegar o elegir) + ilustración de respaldo. */
export function ImagePicker({ image, imageFit, icon, onChange, label = 'Foto del producto' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const handle = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const { url, fit } = await uploadImage(file);
      onChange({ image: url, imageFit: fit });
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="imgpick">
      <div
        className={`imgpick-drop ${over ? 'over' : ''} ${image ? 'has' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files?.[0]);
        }}
        onPaste={(e) => void handle([...e.clipboardData.files][0])}
        tabIndex={0}
        role="button"
        aria-label={label}
      >
        <Visual image={image} imageFit={imageFit} icon={icon} />
        <div className="imgpick-overlay">
          {busy ? (
            <span className="spinner" />
          ) : (
            <>
              <UploadCloud />
              <b>{image ? 'Cambiar foto' : 'Subir foto'}</b>
              <small>Arrastra, pega o haz clic · JPG, PNG o WEBP</small>
            </>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void handle(e.target.files?.[0])} />
      </div>

      {image ? (
        <div className="imgpick-tools">
          <div className="seg sm">
            <button type="button" className={imageFit === 'cover' ? 'on' : ''} onClick={() => onChange({ imageFit: 'cover' })} title="La foto llena toda la tarjeta">
              {imageFit === 'cover' && <span className="seg-pill" />}
              <Crop />
              <span>Llenar</span>
            </button>
            <button type="button" className={imageFit === 'contain' ? 'on' : ''} onClick={() => onChange({ imageFit: 'contain' })} title="Ideal para fotos sin fondo (PNG)">
              {imageFit === 'contain' && <span className="seg-pill" />}
              <Maximize2 />
              <span>Completa</span>
            </button>
          </div>
          <button type="button" className="btn sm danger" onClick={() => onChange({ image: null })}>
            <Trash2 /> Quitar foto
          </button>
        </div>
      ) : (
        <p className="imgpick-hint">
          <ImagePlus /> Sin foto se muestra la ilustración que elijas abajo.
        </p>
      )}

      <div className="imgpick-icons">
        <span className="imgpick-icons-label">{image ? 'Ilustración de respaldo' : 'Ilustración'}</span>
        <div className="icon-grid">
          {FOOD_ART.map((a) => (
            <button type="button" key={a.key} className={`icon-opt ${icon === a.key ? 'on' : ''}`} onClick={() => onChange({ icon: a.key })} title={a.label}>
              <Art name={a.key} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
