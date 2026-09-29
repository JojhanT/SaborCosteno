import { api } from './api';
import type { ImageFit } from '../types';

const MAX_SIDE = 1100;

/**
 * Reduce la foto en el navegador antes de subirla (las fotos del celular pesan
 * varios MB) y detecta si tiene fondo transparente para mostrarla "flotando".
 */
async function prepare(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // ¿fondo transparente? se revisa el borde de la imagen
  const data = g.getImageData(0, 0, w, h).data;
  let clear = 0;
  let total = 0;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 60));
  const alphaAt = (x: number, y: number) => data[(y * w + x) * 4 + 3];
  for (let x = 0; x < w; x += step) {
    total += 2;
    if (alphaAt(x, 0) < 200) clear++;
    if (alphaAt(x, h - 1) < 200) clear++;
  }
  for (let y = 0; y < h; y += step) {
    total += 2;
    if (alphaAt(0, y) < 200) clear++;
    if (alphaAt(w - 1, y) < 200) clear++;
  }
  const transparent = clear / total > 0.25;

  let dataUrl = canvas.toDataURL('image/webp', 0.86);
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88);
  return { dataUrl, transparent };
}

export async function uploadImage(file: File): Promise<{ url: string; fit: ImageFit }> {
  const { dataUrl, transparent } = await prepare(file);
  const { url } = await api.post<{ url: string }>('/uploads', { dataUrl });
  return { url, fit: transparent ? 'contain' : 'cover' };
}
