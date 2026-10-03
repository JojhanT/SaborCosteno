import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, QrCode as QrIcon } from 'lucide-react';
import { useLive } from '../../shared/lib/live';
import { toast } from '../../shared/components/ui';

/*
 * El QR que se imprime y se deja en el local. Lleva el logo en el centro: se puede
 * porque el código guarda información repetida para sobrevivir a manchas y dobleces,
 * así que se genera con corrección de errores alta (nivel H, aguanta perder ~30%) y
 * el logo se queda por debajo del 22% del ancho para no comerse ese margen.
 */

const LADO = 1024; // generoso: se imprime en pendones y adhesivos
const LOGO = 0.2; // proporción del ancho que ocupa el logo

export function QrCarta() {
  const { bootstrap } = useLive();
  const base = bootstrap?.lan?.[0] ?? window.location.origin;
  const url = `${base.replace(/\/+$/, '')}/carta`;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let vivo = true;

    (async () => {
      await QRCode.toCanvas(canvas, url, {
        width: LADO,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#2a1103', light: '#fff1dc' },
      });
      if (!vivo) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const logo = new Image();
      logo.src = '/brand/sc-color.png';
      await logo.decode().catch(() => undefined);
      if (!vivo) return;

      const lado = canvas.width * LOGO;
      const x = (canvas.width - lado) / 2;
      // recuadro del color de fondo para que el logo no se confunda con los módulos
      const margen = lado * 0.12;
      ctx.fillStyle = '#fff1dc';
      ctx.beginPath();
      ctx.roundRect(x - margen, x - margen, lado + margen * 2, lado + margen * 2, lado * 0.18);
      ctx.fill();
      if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, x, x, lado, lado);
      setListo(true);
    })();

    return () => {
      vivo = false;
    };
  }, [url]);

  const descargar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'carta-qr.png';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Código QR descargado', { text: 'Imprímelo y déjalo en las mesas', art: 'turnos' });
    }, 'image/png');
  }, []);

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
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Imprímelo y déjalo en las mesas o en la vitrina. Quien lo escanee ve la carta con los precios de hoy: cuando cambies algo del menú se actualiza sola, sin volver a imprimir el código.
      </p>

      <div className="qr-vista">
        <canvas ref={canvasRef} className="qr-canvas" aria-label="Código QR de la carta" />
      </div>

      <button className="chip qr-url" onClick={copiar} title="Copiar la dirección">
        {url}
      </button>

      <button className="btn primary block" onClick={descargar} disabled={!listo}>
        <Download /> Descargar para imprimir
      </button>
    </section>
  );
}
