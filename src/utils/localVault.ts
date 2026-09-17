import { Category, SavedLink } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';
import { STARTER_LINKS } from './starterData';
import { getFaviconUrl } from './urlHelper';

const LINKS_STORAGE_KEY = 'link_vault_local_links';
const CATEGORIES_STORAGE_KEY = 'link_vault_local_categories';

export function getLocalCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => {
          if (typeof a.order === 'number' && typeof b.order === 'number') {
            return a.order - b.order;
          }
          return 0;
        });
      }
    }
  } catch (e) {
    console.warn('Failed to read local categories', e);
  }
  return DEFAULT_CATEGORIES;
}

export function saveLocalCategories(categories: Category[]): void {
  try {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch (e) {
    console.warn('Failed to save local categories', e);
  }
}

export function getLocalLinks(): SavedLink[] {
  try {
    const raw = localStorage.getItem(LINKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Enrich any existing starter links with thumbnails if missing
        return parsed.map((item) => {
          const starter = STARTER_LINKS.find((s) => s.url === item.url);
          return {
            ...item,
            imageUrl: item.imageUrl || starter?.imageUrl,
            faviconUrl: item.faviconUrl || starter?.faviconUrl || getFaviconUrl(item.url),
          };
        });
      }
    }
  } catch (e) {
    console.warn('Failed to read local links', e);
  }

  // Initialize with starter links if first time
  const initialLinks: SavedLink[] = STARTER_LINKS.map((sample, idx) => ({
    ...sample,
    id: `local_starter_${idx + 1}`,
  }));
  saveLocalLinks(initialLinks);
  return initialLinks;
}

export function saveLocalLinks(links: SavedLink[]): void {
  try {
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
  } catch (e) {
    console.warn('Failed to save local links', e);
  }
}
