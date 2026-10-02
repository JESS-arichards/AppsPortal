import { CoreValue } from '../types';
import { DEFAULT_CORE_VALUES } from '../../shared/defaults';

export const MAX_CORE_VALUES = 6;
export const MAX_ICON_TEXT_LENGTH = 4;
/** Pixel size uploaded icons are normalised to (rendered smaller; 2x+ for high-DPI screens). */
export const CORE_VALUE_ICON_PX = 64;
export const DEFAULT_CORE_VALUE_ICON = '◆';

export { DEFAULT_CORE_VALUES };

export const isImageIcon = (icon?: string | null): icon is string =>
  !!icon && /^data:image\/(png|jpeg|webp|gif);base64,/.test(icon);

/** Accepts the legacy string[] format as well as the current { text, icon }[] format. */
export const parseCoreValues = (json: string | null | undefined): CoreValue[] => {
  try {
    const raw = JSON.parse(json || '[]');
    if (!Array.isArray(raw)) return DEFAULT_CORE_VALUES;
    return raw
      .map((v: unknown): CoreValue | null => {
        if (typeof v === 'string') return { text: v, icon: null };
        if (v && typeof v === 'object' && typeof (v as CoreValue).text === 'string') {
          const icon = (v as CoreValue).icon;
          return { text: (v as CoreValue).text, icon: typeof icon === 'string' && icon ? icon : null };
        }
        return null;
      })
      .filter((v): v is CoreValue => v !== null);
  } catch {
    return DEFAULT_CORE_VALUES;
  }
};

/**
 * Scales any uploaded image to fit (contain) inside a transparent square PNG so every
 * icon renders at the same size on desktop and mobile, and stays small in the database.
 */
export const resizeIconImage = (file: File, size = CORE_VALUE_ICON_PX): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || size;
        const h = img.naturalHeight || size;
        const scale = Math.min(size / w, size / h);
        const dw = Math.max(1, Math.round(w * scale));
        const dh = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas is not supported in this browser');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected file could not be read as an image'));
    };
    img.src = url;
  });
