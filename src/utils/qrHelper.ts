import QRCode from 'qrcode';
import { Category, SavedLink, QrSharePayload, QrSharedCategoryPayload, QrSharedLinkPayload } from '../types';

/**
 * Creates the payload for sharing an entire category along with all its links
 * and its privacy status (hideFromAll).
 */
export function generateCategoryQrPayload(
  category: Category,
  links: SavedLink[]
): QrSharedCategoryPayload {
  const categoryLinks = links.filter((l) => l.categorySlug === category.slug);

  return {
    version: 1,
    app: 'link-vault',
    type: 'category',
    category: {
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      color: category.color,
      hideFromAll: Boolean(category.hideFromAll),
      description: category.description,
    },
    links: categoryLinks.map((l) => ({
      title: l.title,
      url: l.url,
      description: l.description,
      tags: l.tags || [],
      imageUrl: l.imageUrl,
      faviconUrl: l.faviconUrl,
      isFavorite: l.isFavorite,
    })),
  };
}

/**
 * Creates the payload for sharing an individual link.
 */
export function generateLinkQrPayload(
  link: SavedLink,
  category?: Category
): QrSharedLinkPayload {
  return {
    version: 1,
    app: 'link-vault',
    type: 'link',
    link: {
      title: link.title,
      url: link.url,
      categorySlug: link.categorySlug,
      categoryName: category?.name,
      categoryHideFromAll: Boolean(category?.hideFromAll),
      description: link.description,
      tags: link.tags || [],
      imageUrl: link.imageUrl,
      faviconUrl: link.faviconUrl,
      isFavorite: link.isFavorite,
    },
  };
}

/**
 * Safely encodes payload into a base64 string compatible with URLs.
 */
export function encodeShareData(payload: QrSharePayload): string {
  try {
    const json = JSON.stringify(payload);
    // Use encodeURIComponent then unescape for safe unicode base64
    const base64 = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
    return base64;
  } catch (err) {
    console.error('Failed to encode share data:', err);
    return '';
  }
}

/**
 * Safely decodes base64 string, JSON, or an app URL containing import payload.
 */
export function decodeShareData(input: string): QrSharePayload | null {
  if (!input || typeof input !== 'string') return null;

  let rawData = input.trim();

  // If the scanned text is a full URL, extract the query param or hash parameter
  try {
    if (rawData.startsWith('http://') || rawData.startsWith('https://')) {
      const urlObj = new URL(rawData);
      const queryImport = urlObj.searchParams.get('import');
      if (queryImport) {
        rawData = queryImport;
      } else if (urlObj.hash && urlObj.hash.includes('import=')) {
        const hashMatch = urlObj.hash.match(/import=([^&]+)/);
        if (hashMatch && hashMatch[1]) {
          rawData = decodeURIComponent(hashMatch[1]);
        }
      }
    }
  } catch {
    // If not a valid URL, continue with raw string
  }

  // First try direct JSON parse in case raw JSON was encoded
  try {
    const parsed = JSON.parse(rawData);
    if (parsed && parsed.app === 'link-vault') {
      return parsed as QrSharePayload;
    }
  } catch {
    // Not raw JSON, try Base64
  }

  // Try decoding Base64
  try {
    const binary = atob(rawData);
    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(binary, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonStr);
    if (parsed && (parsed.app === 'link-vault' || parsed.type === 'category' || parsed.type === 'link')) {
      return parsed as QrSharePayload;
    }
  } catch (err) {
    console.warn('Unable to decode share data:', err);
  }

  return null;
}

/**
 * Builds a shareable web URL that automatically triggers the import workflow.
 */
export function generateShareUrl(payload: QrSharePayload): string {
  const encoded = encodeShareData(payload);
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#import=${encodeURIComponent(encoded)}`;
}

/**
 * Generates a high-quality QR code data URL (PNG) from text.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR code data URL:', err);
    throw err;
  }
}

/**
 * Downloads a data URL as an image file.
 */
export function downloadQrCode(dataUrl: string, filename = 'link-vault-qr.png') {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
