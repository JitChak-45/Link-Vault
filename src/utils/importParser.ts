import { Category, SavedLink } from '../types';
import { AVAILABLE_COLORS, AVAILABLE_ICONS } from '../constants';
import { normalizeUrl, normalizeUrlForComparison, extractHostname, getFaviconUrl } from './urlHelper';

export interface ParsedImportLink {
  tempId: string;
  title: string;
  url: string;
  categorySlug: string;
  categoryName: string;
  description?: string;
  tags: string[];
  isFavorite: boolean;
  isDuplicate: boolean;
  isValid: boolean;
  validationError?: string;
  selected: boolean;
}

export interface DetectedCategory {
  name: string;
  slug: string;
  isNew: boolean;
  count: number;
  icon: string;
  color: string;
}

export interface ParseResult {
  links: ParsedImportLink[];
  detectedCategories: DetectedCategory[];
  totalFound: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  format: 'json' | 'csv' | 'unknown';
}

/**
 * Slugifies a string for category slug use
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'imported';
}

/**
 * Smartly picks a color and icon for a new category name
 */
export function suggestCategoryVisuals(name: string, existingCategories: Category[]) {
  const lower = name.toLowerCase();

  let icon = 'folder';
  if (lower.includes('code') || lower.includes('dev') || lower.includes('tech') || lower.includes('git')) {
    icon = 'code';
  } else if (lower.includes('study') || lower.includes('course') || lower.includes('learn') || lower.includes('school')) {
    icon = 'graduation-cap';
  } else if (lower.includes('video') || lower.includes('movie') || lower.includes('film') || lower.includes('entertainment')) {
    icon = 'film';
  } else if (lower.includes('music') || lower.includes('audio') || lower.includes('song')) {
    icon = 'music';
  } else if (lower.includes('work') || lower.includes('job') || lower.includes('business') || lower.includes('office')) {
    icon = 'briefcase';
  } else if (lower.includes('read') || lower.includes('book') || lower.includes('article') || lower.includes('blog')) {
    icon = 'bookmark';
  } else if (lower.includes('news') || lower.includes('press')) {
    icon = 'newspaper';
  } else if (lower.includes('tool') || lower.includes('data') || lower.includes('db')) {
    icon = 'database';
  } else if (lower.includes('star') || lower.includes('favorite') || lower.includes('cool')) {
    icon = 'sparkles';
  } else if (lower.includes('heart') || lower.includes('life') || lower.includes('health')) {
    icon = 'heart';
  } else if (lower.includes('coffee') || lower.includes('food') || lower.includes('drink')) {
    icon = 'coffee';
  } else {
    // Pick next available icon
    const usedIcons = new Set(existingCategories.map((c) => c.icon));
    const nextIcon = AVAILABLE_ICONS.find((ic) => !usedIcons.has(ic)) || AVAILABLE_ICONS[0];
    icon = nextIcon;
  }

  // Pick color rotation
  const usedColors = new Set(existingCategories.map((c) => c.color.toLowerCase()));
  const availableColor = AVAILABLE_COLORS.find((col) => !usedColors.has(col.hex.toLowerCase()));
  const color = availableColor ? availableColor.hex : AVAILABLE_COLORS[existingCategories.length % AVAILABLE_COLORS.length].hex;

  return { icon, color };
}

/**
 * Robust RFC 4180 CSV parser that handles delimiters, quotes, escaped quotes, and newlines
 */
export function parseCsvRows(text: string): string[][] {
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!cleanText.trim()) return [];

  // Auto-detect delimiter from first line (comma, semicolon, tab, pipe)
  const firstLine = cleanText.split('\n')[0];
  const delimiters = [',', ';', '\t', '|'];
  let delimiter = ',';
  let maxCount = -1;

  for (const d of delimiters) {
    // Count occurrences outside quotes
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '"') inQuotes = !inQuotes;
      else if (firstLine[i] === d && !inQuotes) count++;
    }
    if (count > maxCount) {
      maxCount = count;
      delimiter = d;
    }
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped double quote
        currentCell += '"';
        i++; // skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  // Push final cell/row if remaining
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Standardize an unparsed item into a raw candidate
 */
interface RawCandidate {
  title?: string;
  url?: string;
  category?: string;
  tags?: string[] | string;
  description?: string;
  isFavorite?: boolean;
}

/**
 * Parse JSON data: handles arrays, objects with links, and Chrome/Firefox bookmark trees
 */
function extractRawCandidatesFromJson(parsed: any): RawCandidate[] {
  const candidates: RawCandidate[] = [];

  // If it's a Chrome/Firefox bookmarks export format
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed.roots || parsed.children)) {
    function traverseBookmarks(node: any, folderPath: string[] = []) {
      if (!node) return;

      const currentTitle = node.name || node.title || '';
      const currentFolder = node.type === 'folder' || node.children ? [...folderPath, currentTitle].filter(Boolean) : folderPath;

      if (node.url) {
        candidates.push({
          title: node.name || node.title || '',
          url: node.url,
          category: currentFolder.length > 0 ? currentFolder[currentFolder.length - 1] : undefined,
          description: node.description,
          tags: currentFolder.slice(0, -1),
        });
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          traverseBookmarks(child, currentFolder);
        }
      }
    }

    if (parsed.roots) {
      for (const rootKey of Object.keys(parsed.roots)) {
        traverseBookmarks(parsed.roots[rootKey], []);
      }
    } else if (parsed.children) {
      traverseBookmarks(parsed, []);
    }
    return candidates;
  }

  // Determine array source
  let itemsArray: any[] = [];
  if (Array.isArray(parsed)) {
    itemsArray = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.links)) itemsArray = parsed.links;
    else if (Array.isArray(parsed.items)) itemsArray = parsed.items;
    else if (Array.isArray(parsed.bookmarks)) itemsArray = parsed.bookmarks;
    else if (Array.isArray(parsed.data)) itemsArray = parsed.data;
    else if (Array.isArray(parsed.entries)) itemsArray = parsed.entries;
  }

  for (const item of itemsArray) {
    if (!item || typeof item !== 'object') continue;

    const url = item.url || item.link || item.href || item.uri || item.address || item.website || '';
    const title = item.title || item.name || item.label || item.text || item.headline || '';
    const category = item.category || item.categorySlug || item.folder || item.folder_name || item.collection || item.group || '';
    const description = item.description || item.desc || item.notes || item.note || item.excerpt || item.summary || '';
    const tags = item.tags || item.tagList || item.keywords || item.labels || [];
    const isFavorite = Boolean(item.isFavorite ?? item.favorite ?? item.starred ?? item.star ?? false);

    candidates.push({
      title,
      url,
      category,
      description,
      tags,
      isFavorite,
    });
  }

  return candidates;
}

/**
 * Parse CSV rows into raw candidates by mapping column headers
 */
function extractRawCandidatesFromCsv(rows: string[][]): RawCandidate[] {
  if (rows.length === 0) return [];

  const candidates: RawCandidate[] = [];
  const headerRow = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Header column index finders
  const urlIdx = headerRow.findIndex((h) =>
    ['url', 'link', 'href', 'address', 'website', 'webpage', 'location'].includes(h)
  );
  const titleIdx = headerRow.findIndex((h) =>
    ['title', 'name', 'label', 'headline', 'bookmarkname', 'text'].includes(h)
  );
  const categoryIdx = headerRow.findIndex((h) =>
    ['category', 'categoryslug', 'folder', 'foldername', 'collection', 'group'].includes(h)
  );
  const tagsIdx = headerRow.findIndex((h) =>
    ['tags', 'tag', 'taglist', 'keywords', 'labels'].includes(h)
  );
  const descIdx = headerRow.findIndex((h) =>
    ['description', 'desc', 'notes', 'note', 'excerpt', 'summary', 'comment', 'memo'].includes(h)
  );
  const favIdx = headerRow.findIndex((h) =>
    ['favorite', 'isfavorite', 'starred', 'star', 'pinned'].includes(h)
  );

  // If recognizable headers exist
  if (urlIdx !== -1) {
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const url = row[urlIdx] || '';
      const title = titleIdx !== -1 ? row[titleIdx] : '';
      const category = categoryIdx !== -1 ? row[categoryIdx] : '';
      const desc = descIdx !== -1 ? row[descIdx] : '';
      const tagsRaw = tagsIdx !== -1 ? row[tagsIdx] : '';
      const favRaw = favIdx !== -1 ? (row[favIdx] || '').toLowerCase() : '';
      const isFavorite = ['true', '1', 'yes', 'y'].includes(favRaw);

      candidates.push({
        url,
        title,
        category,
        description: desc,
        tags: tagsRaw,
        isFavorite,
      });
    }
  } else {
    // Headerless CSV fallback: find which column contains URLs
    let detectedUrlCol = -1;
    for (let col = 0; col < (rows[0]?.length || 0); col++) {
      const colValues = rows.slice(0, 5).map((r) => r[col] || '');
      const hasUrls = colValues.some((v) => /^(https?:\/\/|www\.)/i.test(v));
      if (hasUrls) {
        detectedUrlCol = col;
        break;
      }
    }

    if (detectedUrlCol !== -1) {
      // Find title column (first non-URL text column)
      const detectedTitleCol = detectedUrlCol === 0 ? 1 : 0;
      const detectedCategoryCol = [0, 1, 2].find((c) => c !== detectedUrlCol && c !== detectedTitleCol) ?? -1;

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const url = row[detectedUrlCol] || '';
        if (!url) continue;

        const title = detectedTitleCol < row.length ? row[detectedTitleCol] : '';
        const category = detectedCategoryCol !== -1 && detectedCategoryCol < row.length ? row[detectedCategoryCol] : '';

        candidates.push({
          url,
          title,
          category,
        });
      }
    }
  }

  return candidates;
}

/**
 * Main parser function: takes file text or string and returns normalized preview data
 */
export function parseBulkImportFile(
  fileContent: string,
  fileName: string,
  existingCategories: Category[],
  existingLinks: SavedLink[],
  defaultCategorySlug: string
): ParseResult {
  let format: 'json' | 'csv' | 'unknown' = 'unknown';
  let rawCandidates: RawCandidate[] = [];

  const trimmed = fileContent.trim();
  const lowerFileName = fileName.toLowerCase();

  // Try parsing as JSON first if file ends with .json or starts with [ or {
  if (lowerFileName.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      rawCandidates = extractRawCandidatesFromJson(parsed);
      format = 'json';
    } catch {
      // If JSON parsing fails, fall through to CSV
    }
  }

  // If not parsed as JSON, try CSV
  if (format === 'unknown') {
    const csvRows = parseCsvRows(trimmed);
    if (csvRows.length > 0) {
      rawCandidates = extractRawCandidatesFromCsv(csvRows);
      if (rawCandidates.length > 0) {
        format = 'csv';
      }
    }
  }

  // Build a lookup set for duplicate detection:
  // Key = `${categorySlug.toLowerCase()}::${normalizeUrlForComparison(url)}`
  const existingKeySet = new Set(
    existingLinks.map(
      (l) => `${(l.categorySlug || '').toLowerCase()}::${normalizeUrlForComparison(l.url)}`
    )
  );

  // Category map by slug and by name (lowercase)
  const categoryBySlug = new Map<string, Category>();
  const categoryByName = new Map<string, Category>();
  for (const cat of existingCategories) {
    categoryBySlug.set(cat.slug.toLowerCase(), cat);
    categoryByName.set(cat.name.toLowerCase(), cat);
  }

  const defaultCategory =
    categoryBySlug.get(defaultCategorySlug.toLowerCase()) ||
    existingCategories[0] || {
      name: 'General',
      slug: 'general',
      color: '#0284c7',
      icon: 'folder',
      id: 'general',
      createdAt: Date.now(),
    };

  const parsedLinks: ParsedImportLink[] = [];
  const detectedCategoriesMap = new Map<
    string,
    { name: string; slug: string; isNew: boolean; count: number; icon: string; color: string }
  >();

  for (let i = 0; i < rawCandidates.length; i++) {
    const raw = rawCandidates[i];
    const rawUrl = (raw.url || '').trim();

    if (!rawUrl) {
      continue;
    }

    const normalized = normalizeUrl(rawUrl);
    let isValid = false;
    let validationError: string | undefined;

    try {
      const parsedUrl = new URL(normalized);
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        isValid = true;
      } else {
        validationError = 'Unsupported protocol';
      }
    } catch {
      isValid = false;
      validationError = 'Invalid URL format';
    }

    // Resolve Category
    let resolvedCategoryName = defaultCategory.name;
    let resolvedCategorySlug = defaultCategory.slug;
    let isCategoryNew = false;

    if (raw.category && raw.category.trim()) {
      const rawCatName = raw.category.trim();
      const rawCatSlug = slugify(rawCatName);

      if (categoryByName.has(rawCatName.toLowerCase())) {
        const found = categoryByName.get(rawCatName.toLowerCase())!;
        resolvedCategoryName = found.name;
        resolvedCategorySlug = found.slug;
      } else if (categoryBySlug.has(rawCatSlug)) {
        const found = categoryBySlug.get(rawCatSlug)!;
        resolvedCategoryName = found.name;
        resolvedCategorySlug = found.slug;
      } else {
        // It's a new category
        resolvedCategoryName = rawCatName;
        resolvedCategorySlug = rawCatSlug;
        isCategoryNew = true;
      }
    }

    // Track detected category count
    if (!detectedCategoriesMap.has(resolvedCategorySlug)) {
      const visuals = suggestCategoryVisuals(resolvedCategoryName, existingCategories);
      detectedCategoriesMap.set(resolvedCategorySlug, {
        name: resolvedCategoryName,
        slug: resolvedCategorySlug,
        isNew: isCategoryNew,
        count: 0,
        icon: visuals.icon,
        color: visuals.color,
      });
    }
    const catEntry = detectedCategoriesMap.get(resolvedCategorySlug)!;
    catEntry.count += 1;

    // Check duplicate in the target category
    const checkKey = `${resolvedCategorySlug.toLowerCase()}::${normalizeUrlForComparison(normalized)}`;
    const isDuplicate = existingKeySet.has(checkKey);

    // Resolve Title
    let resolvedTitle = (raw.title || '').trim();
    if (!resolvedTitle) {
      const host = extractHostname(normalized);
      try {
        const p = new URL(normalized);
        const pathSnippet = p.pathname.replace(/^\/+|\/+$/g, '').slice(0, 30);
        resolvedTitle = pathSnippet ? `${host} / ${pathSnippet}` : host;
      } catch {
        resolvedTitle = host || normalized;
      }
    }

    // Resolve Tags
    let resolvedTags: string[] = [];
    if (Array.isArray(raw.tags)) {
      resolvedTags = raw.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    } else if (typeof raw.tags === 'string' && raw.tags.trim()) {
      resolvedTags = raw.tags
        .split(/[,;\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    }

    // Duplicate links should be unselected by default, valid non-duplicates selected
    const shouldSelect = isValid && !isDuplicate;

    parsedLinks.push({
      tempId: `import_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      title: resolvedTitle,
      url: normalized,
      categorySlug: resolvedCategorySlug,
      categoryName: resolvedCategoryName,
      description: raw.description ? String(raw.description).trim() : undefined,
      tags: Array.from(new Set(resolvedTags)).slice(0, 8),
      isFavorite: Boolean(raw.isFavorite),
      isDuplicate,
      isValid,
      validationError,
      selected: shouldSelect,
    });
  }

  const validCount = parsedLinks.filter((l) => l.isValid).length;
  const invalidCount = parsedLinks.filter((l) => !l.isValid).length;
  const duplicateCount = parsedLinks.filter((l) => l.isDuplicate).length;

  return {
    links: parsedLinks,
    detectedCategories: Array.from(detectedCategoriesMap.values()),
    totalFound: parsedLinks.length,
    validCount,
    invalidCount,
    duplicateCount,
    format,
  };
}

/**
 * Generate and download a sample CSV file for users to see the structure
 */
export function downloadSampleCsv() {
  const csvContent = `Title,URL,Category,Tags,Description,Favorite
"GitHub","https://github.com","Study","coding, git, developer","Code hosting, collaboration and open source",true
"YouTube","https://youtube.com","Entertainment","video, music, streaming","Video streaming platform and media hub",true
"Wikipedia","https://wikipedia.org","Information","encyclopedia, knowledge, reference","Free online open encyclopedia",false
"Linear","https://linear.app","Work & Tools","productivity, agile, sprint","Issue tracker built for high performance software teams",false
"Substack","https://substack.com","Reading & Articles","newsletter, essays, journalism","Independent newsletters and writers platform",false
`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'linkvault-sample-import.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate and download a sample JSON file for users
 */
export function downloadSampleJson() {
  const sampleData = [
    {
      title: 'GitHub - Code & Repositories',
      url: 'https://github.com',
      category: 'Study',
      tags: ['coding', 'git', 'dev'],
      description: 'Open source repositories and software collaboration',
      isFavorite: true,
    },
    {
      title: 'YouTube - Media & Streaming',
      url: 'https://youtube.com',
      category: 'Entertainment',
      tags: ['video', 'music'],
      description: 'Favorite video streams, creative essays, podcasts',
      isFavorite: true,
    },
    {
      title: 'Wikipedia - The Free Encyclopedia',
      url: 'https://en.wikipedia.org',
      category: 'Information',
      tags: ['reference', 'knowledge'],
      description: 'Comprehensive open-access collaborative encyclopedia',
      isFavorite: false,
    },
    {
      title: 'Linear Issue Tracker',
      url: 'https://linear.app',
      category: 'Work & Tools',
      tags: ['productivity', 'agile'],
      description: 'Issue tracker built for high performance software teams',
      isFavorite: false,
    },
  ];
  const blob = new Blob([JSON.stringify(sampleData, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'linkvault-sample-import.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
