import { normalizeUrl, extractHostname, getFaviconUrl, getDefaultThumbnailUrl } from './urlHelper';

export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  faviconUrl?: string;
  siteName?: string;
}

// In-memory cache to avoid duplicate fetches during the same session
const metadataCache = new Map<string, LinkMetadata>();

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .trim();
}

/**
 * Deterministic metadata extraction for popular platforms (instant, no CORS, 100% reliable)
 */
export function extractQuickMetadata(rawUrl: string): Partial<LinkMetadata> {
  const url = normalizeUrl(rawUrl);
  const hostname = extractHostname(url);

  // 1. YouTube video
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      imageUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      faviconUrl: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128',
      siteName: 'YouTube',
    };
  }

  // 2. GitHub repository
  const ghMatch = url.match(/https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\/|$)/i);
  if (ghMatch && ghMatch[1] && ghMatch[2] && !['features', 'topics', 'trending', 'collections', 'events', 'settings'].includes(ghMatch[1])) {
    const user = ghMatch[1];
    const repo = ghMatch[2].replace(/\.git$/, '');
    return {
      imageUrl: `https://opengraph.githubassets.com/1/${user}/${repo}`,
      faviconUrl: 'https://github.githubassets.com/favicons/favicon.svg',
      siteName: 'GitHub',
    };
  }

  // 3. Vimeo
  const vimeoMatch = url.match(/https?:\/\/(?:www\.)?vimeo\.com\/([0-9]+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      imageUrl: `https://vumbnail.com/${vimeoMatch[1]}.jpg`,
      faviconUrl: 'https://www.google.com/s2/favicons?domain=vimeo.com&sz=128',
      siteName: 'Vimeo',
    };
  }

  return {
    faviconUrl: getFaviconUrl(url),
    siteName: hostname,
  };
}

/**
 * Fetch OpenGraph metadata, thumbnail, and favicon for any URL
 */
export async function fetchLinkMetadata(rawUrl: string): Promise<LinkMetadata> {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized || !/^https?:\/\//i.test(normalized)) {
    throw new Error('Invalid URL provided');
  }

  if (metadataCache.has(normalized)) {
    return metadataCache.get(normalized)!;
  }

  const quick = extractQuickMetadata(normalized);
  let metadata: LinkMetadata = {
    url: normalized,
    faviconUrl: quick.faviconUrl || getFaviconUrl(normalized),
    imageUrl: quick.imageUrl,
    siteName: quick.siteName,
  };

  // If we already have a direct thumbnail (e.g. YouTube or GitHub OpenGraph), try getting title if missing
  const needsThumbnail = !metadata.imageUrl;

  // Tier 1: Local server-side OG endpoint (/api/og)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`/api/og?url=${encodeURIComponent(normalized)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && !data.error) {
        metadata = {
          url: normalized,
          title: data.title ? decodeHtmlEntities(data.title) : metadata.title,
          description: data.description ? decodeHtmlEntities(data.description) : metadata.description,
          imageUrl: data.imageUrl || metadata.imageUrl,
          faviconUrl: data.faviconUrl || metadata.faviconUrl,
          siteName: data.siteName || metadata.siteName,
        };

        if (metadata.imageUrl) {
          metadataCache.set(normalized, metadata);
          return metadata;
        }
      }
    }
  } catch (err) {
    // Local /api/og timed out or failed; continue to tier 2
  }

  // Tier 2: Public Microlink API (free, reliable fallback for open graph parsing)
  if (needsThumbnail || !metadata.title) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(
        `https://api.microlink.io?url=${encodeURIComponent(normalized)}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          const d = json.data;
          metadata = {
            url: normalized,
            title: d.title ? decodeHtmlEntities(d.title) : metadata.title,
            description: d.description ? decodeHtmlEntities(d.description) : metadata.description,
            imageUrl: d.image?.url || metadata.imageUrl,
            faviconUrl: d.logo?.url || metadata.faviconUrl || getFaviconUrl(normalized),
            siteName: d.publisher || metadata.siteName,
          };
        }
      }
    } catch (err) {
      // Fallback silently
    }
  }

  // Tier 3: Wikipedia REST API (for wikipedia links)
  if (!metadata.imageUrl && normalized.includes('wikipedia.org/wiki/')) {
    try {
      const articleTitle = normalized.split('/wiki/')[1]?.split(/[?#]/)[0];
      if (articleTitle) {
        const wikiRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${articleTitle}`
        );
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (wikiData.thumbnail?.source) {
            metadata.imageUrl = wikiData.thumbnail.source;
          }
          if (wikiData.title && !metadata.title) {
            metadata.title = wikiData.title;
          }
          if (wikiData.extract && !metadata.description) {
            metadata.description = wikiData.extract;
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  // Tier 4: Guaranteed fallback thumbnail preview
  if (!metadata.imageUrl) {
    metadata.imageUrl = getDefaultThumbnailUrl(normalized);
  }

  metadataCache.set(normalized, metadata);
  return metadata;
}
