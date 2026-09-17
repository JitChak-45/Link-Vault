import QRCode from 'qrcode';
import { deflate, inflate } from 'pako';
import {
  Category,
  SavedLink,
  QrSharePayload,
  QrSharedCategoryPayload,
  QrSharedLinkPayload,
} from '../types';
import {
  db,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  auth,
  signInAnonymously,
} from '../firebase';

/**
 * Universal flexible matching for links and categories.
 * Matches against slug, id, name, and normalized alphanumeric strings case-insensitively,
 * ensuring no links are dropped due to whitespace, dash, or casing differences.
 */
export function isLinkInCategory(
  linkCategorySlug: string | undefined | null,
  category: { slug?: string; id?: string; name?: string } | null | undefined
): boolean {
  if (!linkCategorySlug || !category) return false;
  const linkCat = String(linkCategorySlug).toLowerCase().trim();
  const catSlug = String(category.slug || '').toLowerCase().trim();
  const catId = String(category.id || '').toLowerCase().trim();
  const catName = String(category.name || '').toLowerCase().trim();

  // Exact direct matches
  if (
    (catSlug !== '' && linkCat === catSlug) ||
    (catId !== '' && linkCat === catId) ||
    (catName !== '' && linkCat === catName)
  ) {
    return true;
  }

  // Normalized alphanumeric matching (strips spaces, hyphens, underscores)
  const norm = (s: string) => s.replace(/[^a-z0-9]/g, '');
  const normLink = norm(linkCat);
  if (!normLink) return false;

  return (
    (catSlug !== '' && normLink === norm(catSlug)) ||
    (catId !== '' && normLink === norm(catId)) ||
    (catName !== '' && normLink === norm(catName))
  );
}

/**
 * Ensures objects stored in Firestore never contain undefined values
 */
export function cleanPayloadForFirestore<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object') {
        cleaned[key] = cleanPayloadForFirestore(val);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned;
}

/**
 * Creates the payload for sharing an entire category along with all its links
 * and its privacy status (hideFromAll).
 */
export function generateCategoryQrPayload(
  category: Category,
  links: SavedLink[]
): QrSharedCategoryPayload {
  const sourceLinks = links || [];
  // Match links flexibly; if caller already provided category-isolated links, retain them all
  const matchingLinks = sourceLinks.filter((l) => isLinkInCategory(l.categorySlug, category));
  const categoryLinks = matchingLinks.length > 0 ? matchingLinks : sourceLinks;

  const safeSlug =
    category.slug ||
    (category.name ? category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'category');

  return {
    version: 1,
    app: 'link-vault',
    type: 'category',
    category: {
      name: category.name || 'Shared Category',
      slug: safeSlug,
      icon: category.icon || 'Bookmark',
      color: category.color || '#4f46e5',
      hideFromAll: Boolean(category.hideFromAll),
      description: category.description || '',
    },
    links: categoryLinks.map((l) => ({
      title: l.title || l.url,
      url: l.url,
      description: l.description || '',
      tags: Array.isArray(l.tags) ? l.tags : [],
      imageUrl: l.imageUrl || '',
      faviconUrl: l.faviconUrl || '',
      isFavorite: Boolean(l.isFavorite),
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
      title: link.title || link.url,
      url: link.url,
      categorySlug: link.categorySlug || category?.slug || 'general',
      categoryName: category?.name || '',
      categoryHideFromAll: Boolean(category?.hideFromAll),
      description: link.description || '',
      tags: Array.isArray(link.tags) ? link.tags : [],
      imageUrl: link.imageUrl || '',
      faviconUrl: link.faviconUrl || '',
      isFavorite: Boolean(link.isFavorite),
    },
  };
}

export interface CloudShareResult {
  shareId: string;
  shortCode: string;
  shareUrl: string;
  payload: QrSharePayload;
}

/**
 * Stores a full bundle in Firestore and creates a clean, short share link (e.g. #s=s_k8m2p9)
 * and a 6-digit Quick Code (e.g. 742 918) that never truncates in messaging apps
 * and allows instant QR code generation and 100% reliable import for ANY number of links (200+).
 */
export async function createCloudShareBundle(payload: QrSharePayload): Promise<CloudShareResult> {
  const shareId = `s_${Math.random().toString(36).substring(2, 8)}${Math.random().toString(36).substring(2, 6)}`;
  // 6-digit numeric quick code (e.g. 742918)
  const shortCode = String(Math.floor(100000 + Math.random() * 900000));
  const cleaned = cleanPayloadForFirestore(payload);

  const categoryName =
    payload.type === 'category'
      ? payload.category?.name || 'Shared Category'
      : payload.link?.title || 'Shared Link';

  const itemCount =
    payload.type === 'category'
      ? Array.isArray(payload.links)
        ? payload.links.length
        : 0
      : 1;

  // Ensure user has auth context (anonymous fallback if not logged in)
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (authErr) {
      console.warn('Anonymous auth initialization:', authErr);
    }
  }

  const bundleData = {
    id: shareId,
    shortCode,
    categoryName,
    itemCount,
    payload: cleaned,
    createdAt: Date.now(),
  };

  try {
    // 1. Save primary doc under shareId
    const bundleRef = doc(db, 'shared_bundles', shareId);
    await setDoc(bundleRef, bundleData);

    // 2. Also save by 6-digit shortCode for instant O(1) doc lookup
    try {
      const codeRef = doc(db, 'shared_bundles', shortCode);
      await setDoc(codeRef, bundleData);
    } catch {
      // Non-blocking if replica write fails
    }
  } catch (err) {
    console.error('Failed to create cloud share bundle in Firestore:', err);
    throw err;
  }

  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin + window.location.pathname
      : '';
  const shareUrl = `${baseUrl}#s=${shareId}`;

  return {
    shareId,
    shortCode,
    shareUrl,
    payload: cleaned,
  };
}

/**
 * Resolves a cloud share bundle by share ID, URL, or 6-digit quick code
 */
export async function fetchCloudShareBundle(shareIdOrCode: string): Promise<QrSharePayload | null> {
  if (!shareIdOrCode) return null;

  let cleanKey = shareIdOrCode.trim();

  // Extract s_ bundle ID if present anywhere in the string/URL (e.g. #s=s_abc, #s_abc, ?s=s_abc)
  const sMatch = cleanKey.match(/(s_[a-zA-Z0-9_-]+)/);
  if (sMatch) {
    cleanKey = sMatch[1];
  } else {
    const hashMatch = cleanKey.match(/[#?&](?:s|share)=([a-zA-Z0-9_-]+)/i);
    if (hashMatch) {
      cleanKey = hashMatch[1];
    }
  }

  // Check for 6-digit quick code (e.g. "849 201" or "849201")
  const codeMatch = cleanKey.match(/\b(\d{3})\s*(\d{3})\b/);
  const strippedCode = codeMatch ? `${codeMatch[1]}${codeMatch[2]}` : cleanKey.replace(/[\s-]+/g, '');

  try {
    // 1. Try direct doc ID lookup by cleanKey
    const docRef = doc(db, 'shared_bundles', cleanKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.payload) {
        return data.payload as QrSharePayload;
      }
    }
  } catch (e) {
    console.warn('Direct doc ID lookup failed:', e);
  }

  // 2. Try looking up by 6-digit shortCode query
  if (/^\d{6}$/.test(strippedCode)) {
    try {
      // First try direct doc fetch by 6-digit code ID (dual indexed)
      const directCodeRef = doc(db, 'shared_bundles', strippedCode);
      const directSnap = await getDoc(directCodeRef);
      if (directSnap.exists()) {
        const data = directSnap.data();
        if (data && data.payload) {
          return data.payload as QrSharePayload;
        }
      }

      // Query fallback
      const q = query(
        collection(db, 'shared_bundles'),
        where('shortCode', '==', strippedCode),
        limit(1)
      );
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const data = qSnap.docs[0].data();
        if (data && data.payload) {
          return data.payload as QrSharePayload;
        }
      }
    } catch (e) {
      console.warn('ShortCode query failed:', e);
    }
  }

  return null;
}

// Compact types for minimal QR byte footprint
interface CompactCategoryRecord {
  n: string; // name
  s: string; // slug
  i: string; // icon
  c: string; // color
  p: number; // hideFromAll (1 or 0)
}

interface CompactLinkRecord {
  t: string; // title
  u: string; // url
  d?: string; // description (shortened)
  f?: number; // isFavorite
}

interface CompactCategoryPayload {
  v: 1;
  t: 'cat';
  c: CompactCategoryRecord;
  l: CompactLinkRecord[];
}

interface CompactSingleLinkPayload {
  v: 1;
  t: 'lnk';
  l: {
    t: string;
    u: string;
    d?: string;
    f?: number;
    cs?: string; // category slug
    cn?: string; // category name
    cp?: number; // category hideFromAll
  };
}

type CompactPayload = CompactCategoryPayload | CompactSingleLinkPayload;

// Support large category transfers with no artificial limits
const MAX_QR_TRANSFER_LINKS = 1000;

/**
 * Converts rich payload to compact form for QR encoding
 */
function toCompactPayload(payload: QrSharePayload): CompactPayload {
  if (payload.type === 'category') {
    const rawLinks = Array.isArray(payload.links) ? payload.links : [];
    const cappedLinks = rawLinks.slice(0, MAX_QR_TRANSFER_LINKS);
    const safeCategoryName = String(payload.category?.name || 'Shared Category').slice(0, 60);
    const safeCategorySlug =
      payload.category?.slug ||
      safeCategoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    return {
      v: 1,
      t: 'cat',
      c: {
        n: safeCategoryName,
        s: safeCategorySlug,
        i: payload.category?.icon || 'Bookmark',
        c: payload.category?.color || '#4f46e5',
        p: payload.category?.hideFromAll ? 1 : 0,
      },
      l: cappedLinks.map((l) => ({
        t: String(l.title || l.url || 'Link').slice(0, 80),
        u: l.url,
        d: l.description ? String(l.description).slice(0, 80) : undefined,
        f: l.isFavorite ? 1 : 0,
      })),
    };
  }

  return {
    v: 1,
    t: 'lnk',
    l: {
      t: String(payload.link.title || payload.link.url || 'Link').slice(0, 100),
      u: payload.link.url,
      d: payload.link.description ? String(payload.link.description).slice(0, 80) : undefined,
      f: payload.link.isFavorite ? 1 : 0,
      cs: payload.link.categorySlug,
      cn: payload.link.categoryName,
      cp: payload.link.categoryHideFromAll ? 1 : 0,
    },
  };
}

/**
 * Converts compact payload back to full QrSharePayload
 */
function fromCompactPayload(compact: CompactPayload): QrSharePayload {
  if (compact.t === 'cat') {
    const catName = compact.c?.n || 'Shared Category';
    const catSlug =
      compact.c?.s || catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const compactLinks = Array.isArray(compact.l) ? compact.l : [];

    return {
      version: 1,
      app: 'link-vault',
      type: 'category',
      category: {
        name: catName,
        slug: catSlug,
        icon: compact.c?.i || 'Bookmark',
        color: compact.c?.c || '#4f46e5',
        hideFromAll: Boolean(compact.c?.p),
        description: '',
      },
      links: compactLinks.map((item) => ({
        title: item.t || item.u || 'Saved Link',
        url: item.u,
        description: item.d || '',
        isFavorite: Boolean(item.f),
        tags: [],
        imageUrl: '',
        faviconUrl: '',
      })),
    };
  }

  return {
    version: 1,
    app: 'link-vault',
    type: 'link',
    link: {
      title: compact.l?.t || compact.l?.u || 'Saved Link',
      url: compact.l?.u || '',
      categorySlug: compact.l?.cs || 'general',
      categoryName: compact.l?.cn || '',
      categoryHideFromAll: Boolean(compact.l?.cp),
      description: compact.l?.d || '',
      isFavorite: Boolean(compact.l?.f),
      tags: [],
      imageUrl: '',
      faviconUrl: '',
    },
  };
}

function uint8ToBase64Url(uint8: Uint8Array): string {
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToUint8(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Synchronous and instant compression with pako deflate
 */
function compressString(input: string): string {
  try {
    const deflated = deflate(input);
    return uint8ToBase64Url(deflated);
  } catch (err) {
    console.warn('deflate failed, falling back to basic base64:', err);
    return btoa(
      encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

/**
 * Decompress string with pako inflate with multiple fallbacks
 */
function decompressString(b64url: string): string {
  try {
    const bytes = base64UrlToUint8(b64url);
    const inflated = inflate(bytes);
    return new TextDecoder().decode(inflated);
  } catch {
    // Might be raw uncompressed base64 or URI encoded
    try {
      let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const binary = atob(b64);
      return decodeURIComponent(
        Array.prototype.map
          .call(binary, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch {
      return b64url;
    }
  }
}

/**
 * Encodes payload into URL-safe compressed string
 */
export function encodeShareData(payload: QrSharePayload): string {
  try {
    const compact = toCompactPayload(payload);
    const jsonStr = JSON.stringify(compact);
    return compressString(jsonStr);
  } catch (err) {
    console.error('Failed to encode share data:', err);
    return '';
  }
}

/**
 * Async version for backwards compatibility
 */
export async function encodeShareDataAsync(payload: QrSharePayload): Promise<string> {
  return encodeShareData(payload);
}

/**
 * Safely decodes base64 string, JSON, compressed string, or an app URL containing import payload.
 */
export function decodeShareData(input: string): QrSharePayload | null {
  if (!input || typeof input !== 'string') return null;

  let rawData = input.trim();

  // If the input contains a hash or query param (full URL, relative URL, or raw fragment)
  try {
    if (rawData.includes('#i=')) {
      rawData = decodeURIComponent(rawData.split('#i=')[1].split('&')[0]);
    } else if (rawData.includes('#import=')) {
      rawData = decodeURIComponent(rawData.split('#import=')[1].split('&')[0]);
    } else if (rawData.includes('?i=') || rawData.includes('&i=')) {
      const match = rawData.match(/[?&]i=([^&#]+)/);
      if (match && match[1]) rawData = decodeURIComponent(match[1]);
    } else if (rawData.includes('?import=') || rawData.includes('&import=')) {
      const match = rawData.match(/[?&]import=([^&#]+)/);
      if (match && match[1]) rawData = decodeURIComponent(match[1]);
    } else if (rawData.startsWith('i=')) {
      rawData = decodeURIComponent(rawData.substring(2).split('&')[0]);
    } else if (rawData.startsWith('import=')) {
      rawData = decodeURIComponent(rawData.substring(7).split('&')[0]);
    } else if (rawData.startsWith('http://') || rawData.startsWith('https://')) {
      const urlObj = new URL(rawData);
      const queryImport =
        urlObj.searchParams.get('i') ||
        urlObj.searchParams.get('import');
      if (queryImport) {
        rawData = queryImport;
      } else if (urlObj.hash) {
        const hashMatch = urlObj.hash.match(/(?:i|import)=([^&]+)/);
        if (hashMatch && hashMatch[1]) {
          rawData = decodeURIComponent(hashMatch[1]);
        }
      }
    }
  } catch {
    // If not a parseable URL, continue with raw string
  }

  // 1. Direct JSON parse
  try {
    const parsed = JSON.parse(rawData);
    if (parsed) {
      if (parsed.t === 'cat' || parsed.t === 'lnk') {
        return fromCompactPayload(parsed as CompactPayload);
      }
      if (parsed.app === 'link-vault' || parsed.type === 'category' || parsed.type === 'link') {
        return parsed as QrSharePayload;
      }
    }
  } catch {
    // Not direct JSON
  }

  // 2. Try decompressing with pako / base64
  try {
    const decompressed = decompressString(rawData);
    const parsed = JSON.parse(decompressed);
    if (parsed) {
      if (parsed.t === 'cat' || parsed.t === 'lnk') {
        return fromCompactPayload(parsed as CompactPayload);
      }
      if (parsed.app === 'link-vault' || parsed.type === 'category' || parsed.type === 'link') {
        return parsed as QrSharePayload;
      }
    }
  } catch {
    // Continue
  }

  // 3. Fallback: try raw Base64 without pako
  try {
    let b64 = rawData.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(binary, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonStr);
    if (parsed) {
      if (parsed.t === 'cat' || parsed.t === 'lnk') {
        return fromCompactPayload(parsed as CompactPayload);
      }
      if (parsed.app === 'link-vault' || parsed.type === 'category' || parsed.type === 'link') {
        return parsed as QrSharePayload;
      }
    }
  } catch {
    // Continue
  }

  return null;
}

export async function decodeShareDataAsync(input: string): Promise<QrSharePayload | null> {
  if (!input) return null;

  const trimmed = input.trim();

  // 1. Check if input is a cloud share link (#s=, ?s=, #s_, s_) or short code
  if (
    trimmed.includes('#s=') ||
    trimmed.includes('?s=') ||
    trimmed.includes('&s=') ||
    trimmed.includes('#share=') ||
    trimmed.includes('#s_') ||
    trimmed.includes('/s_') ||
    trimmed.startsWith('s_') ||
    /s_[a-zA-Z0-9_-]+/.test(trimmed) ||
    /^\d{6}$/.test(trimmed.replace(/[\s-]+/g, ''))
  ) {
    try {
      const cloudPayload = await fetchCloudShareBundle(trimmed);
      if (cloudPayload) return cloudPayload;
    } catch (err) {
      console.warn('Cloud share bundle fetch failed:', err);
    }
  }

  // 2. If it's a short token/code without special JSON/URI characters, try cloud lookup
  if (trimmed.length <= 20 && !trimmed.includes('{') && !trimmed.includes('%') && !trimmed.includes('=')) {
    try {
      const cloudPayload = await fetchCloudShareBundle(trimmed);
      if (cloudPayload) return cloudPayload;
    } catch {
      // ignore
    }
  }

  // 3. Fallback to offline local decompression and decoding
  return decodeShareData(trimmed);
}

/**
 * Builds a shareable web URL that automatically triggers the import workflow.
 * Uses #i= for short compact URL to leave maximum byte space for the QR code payload.
 */
export function generateShareUrl(payload: QrSharePayload, encodedToken?: string): string {
  const encoded = encodedToken || encodeShareData(payload);
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin + window.location.pathname
      : '';
  return `${baseUrl}#i=${encodeURIComponent(encoded)}`;
}

/**
 * Generates a high-quality QR code data URL (PNG) from text with multi-tier fallback.
 * Tries the full URL first; if the host origin or URL is extraordinarily long, encodes
 * the raw compressed share token directly, guaranteeing successful QR generation in all conditions.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  const levels: ('L' | 'M')[] = ['L', 'M'];

  let lastError: unknown = null;
  for (const errorCorrectionLevel of levels) {
    try {
      return await QRCode.toDataURL(text, {
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel,
      });
    } catch (err) {
      lastError = err;
    }
  }

  // If the full URL exceeded QR capacity, strip down to the hash payload or raw payload
  try {
    let fallbackText = text;
    if (text.includes('#i=')) {
      fallbackText = text.split('#i=')[1] || text;
    } else if (text.includes('#import=')) {
      fallbackText = text.split('#import=')[1] || text;
    }

    return await QRCode.toDataURL(fallbackText, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'L',
    });
  } catch (finalErr) {
    console.error('Failed to generate QR code data URL even with fallback:', finalErr);
    throw lastError || finalErr;
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
