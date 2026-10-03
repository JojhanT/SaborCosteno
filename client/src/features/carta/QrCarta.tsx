import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Printer, QrCode as QrIcon } from 'lucide-react';
import { useLive } from '../../shared/lib/live';
import { Modal, ModalClose, toast } from '../../shared/components/ui';

/*
 * El QR que se imprime y se deja en el local. Lleva el logo en el centro: se puede
 * porque el código guarda información repetida para sobrevivir a manchas y dobleces,
 * así que se genera con corrección de errores alta (nivel H, aguanta perder ~30%) y
 * el logo se queda por debajo del 22% del ancho para no comerse ese margen.
 */

const LOGO = 0.2; // proporción del ancho que ocupa el logo
const TINTA = '#2a1103';
const FONDO = '#fff1dc';

/**
 * Dibuja el QR con el logo encima. El tamaño se pasa en píxeles reales: dibujar
 * grande y encoger por CSS deja los módulos con moiré, así que cada uso pide el suyo.
 */
async function pintar(canvas: HTMLCanvasElement, url: string, lado: number) {
  await QRCode.toCanvas(canvas, url, {
    width: lado,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: TINTA, light: FONDO },
  });
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const logo = new Image();
  logo.src = '/brand/sc-color.png';
  await logo.decode().catch(() => undefined);
  if (!logo.naturalWidth) return;

  const tam = canvas.width * LOGO;
  const x = (canvas.width - tam) / 2;
  const margen = tam * 0.12;
  // recuadro del color de fondo para que el logo no se confunda con los módulos
  ctx.fillStyle = FONDO;
  ctx.beginPath();
  ctx.roundRect(x - margen, x - margen, tam + margen * 2, tam + margen * 2, tam * 0.18);
  ctx.fill();
  ctx.drawImage(logo, x, x, tam, tam);
}

export function QrCarta() {
  const { bootstrap } = useLive();
  const base = bootstrap?.lan?.[0] ?? window.location.origin;
  const url = `${base.replace(/\/+$/, '')}/carta`;
  const [abierto, setAbierto] = useState(false);
  const mini = useRef<HTMLCanvasElement>(null);

  // la miniatura se dibuja a su tamaño real: nada de encoger por CSS
  useEffect(() => {
    if (mini.current) void pintar(mini.current, url, 220);
  }, [url]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Dirección copiada', { text: url, kind: 'info' });
    } catch {
      toast(url, { kind: 'info', text: 'Cópiala a mano' });
    }
  };

  return (
    <section className="scard qr-card">
      <header>
        <span className="scard-art">
          <QrIcon />
        </span>
        <h3 className="display">Código QR de la carta</h3>
      </header>
      <p className="muted qr-texto">
        Imprímelo y déjalo en las mesas o en la vitrina. Quien lo escanee ve la carta con los precios de hoy: si cambias el menú se actualiza sola, sin volver a imprimir el código.
      </p>

      <button className="qr-mini" onClick={() => setAbierto(true)} title="Ver en grande">
        <canvas ref={mini} aria-label="Código QR de la carta" />
        <span>Ver en grande</span>
      </button>

      <div className="qr-acciones">
        <button className="btn sm ghost" onClick={copiar}>
          <Copy /> Copiar dirección
        </button>
        <button className="btn sm primary" onClick={() => setAbierto(true)}>
          <Printer /> Imprimir o descargar
        </button>
      </div>

      <QrModal open={abierto} url={url} onClose={() => setAbierto(false)} />
    </section>
  );
}

function QrModal({ open, url, onClose }: { open: boolean; url: string; onClose: () => void }) {
  const grande = useRef<HTMLCanvasElement>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!open) return;
    setListo(false);
    let vivo = true;
    // 1024 px: tamaño generoso para imprimir en pendones y adhesivos
    void pintar(grande.current!, url, 1024).then(() => vivo && setListo(true));
    return () => {
      vivo = false;
    };
  }, [open, url]);

  const descargar = useCallback(() => {
    grande.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'carta-qr.png';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Código QR descargado', { text: 'carta-qr.png, listo para imprimir', art: 'turnos' });
    }, 'image/png');
  }, []);

  return (
    <Modal open={open} onClose={onClose} className="qr-modal" labelledBy="qr-title">
      <ModalClose onClose={onClose} />
      <div className="qr-hoja">
        <h2 id="qr-title" className="display">
          Escanea y mira la carta
        </h2>
        <canvas ref={grande} className="qr-grande" aria-label="Código QR de la carta" />
        <p className="qr-pie">{url.replace(/^https?:\/\//, '')}</p>
      </div>

      <div className="qr-modal-acciones">
        <button className="btn ghost" onClick={onClose}>
          Cerrar
        </button>
        <button className="btn outline" onClick={() => window.print()} disabled={!listo}>
          <Printer /> Imprimir
        </button>
        <button className="btn primary" onClick={descargar} disabled={!listo}>
          <Download /> Descargar PNG
        </button>
      </div>
    </Modal>
  );
}
