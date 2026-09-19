export function normalizeUrl(input: string): string {
  let trimmed = input.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  return trimmed;
}

/**
 * Normalizes a URL for duplicate-checking comparison:
 * - Ensures https scheme
 * - Strips leading www.
 * - Standardizes case for hostname
 * - Strips trailing slash on pathname
 * - Sorts search query parameters
 */
export function normalizeUrlForComparison(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const port = parsed.port ? `:${parsed.port}` : '';

    let pathname = parsed.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.replace(/\/+$/, '');
    }

    const searchParams = new URLSearchParams(parsed.search);
    searchParams.sort();
    const search = searchParams.toString() ? `?${searchParams.toString()}` : '';

    return `https://${hostname}${port}${pathname}${search}`;
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
  }
}

/**
 * Checks whether two URLs point to the same canonical destination.
 */
export function isSameUrl(
  urlA: string | undefined | null,
  urlB: string | undefined | null
): boolean {
  if (!urlA || !urlB) return false;
  const compA = normalizeUrlForComparison(urlA);
  const compB = normalizeUrlForComparison(urlB);
  return compA !== '' && compA === compB;
}

export function extractHostname(url: string): string {
  try {
    const parsed = new URL(normalizeUrl(url));
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

export function getFaviconUrl(url: string): string {
  const hostname = extractHostname(url);
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
}

export function guessCategory(url: string): string | null {
  const lower = url.toLowerCase();

  const entertainmentKeywords = [
    'youtube.com', 'youtu.be', 'netflix.com', 'twitch.tv', 'spotify.com',
    'soundcloud.com', 'disneyplus.com', 'primevideo.com', 'steampowered.com',
    'imdb.com', 'rottentomatoes.com', 'crunchyroll.com', 'tiktok.com',
    'ign.com', 'kotaku.com', 'bandcamp.com'
  ];

  const studyKeywords = [
    'github.com', 'gitlab.com', 'stackoverflow.com', 'coursera.org',
    'edx.org', 'udemy.com', 'khanacademy.org', 'arxiv.org', 'mit.edu',
    'stanford.edu', 'harvard.edu', 'leetcode.com', 'developer.mozilla.org',
    'w3schools.com', 'sciencedirect.com', 'jstor.org', 'scholar.google',
    'codecademy.com', 'freecodecamp.org', 'docs.'
  ];

  const infoKeywords = [
    'wikipedia.org', 'bbc.com', 'cnn.com', 'reuters.com', 'bloomberg.com',
    'theverge.com', 'wired.com', 'techcrunch.com', 'nytimes.com', 'wsj.com',
    'news.ycombinator.com', 'britannica.com', 'nature.com', 'apnews.com'
  ];

  const workKeywords = [
    'figma.com', 'slack.com', 'notion.so', 'notion.site', 'jira',
    'trello.com', 'linear.app', 'asana.com', 'miro.com', 'drive.google',
    'docs.google', 'sheets.google', 'canva.com', 'loom.com'
  ];

  for (const kw of entertainmentKeywords) {
    if (lower.includes(kw)) return 'entertainment';
  }
  for (const kw of studyKeywords) {
    if (lower.includes(kw)) return 'study';
  }
  for (const kw of infoKeywords) {
    if (lower.includes(kw)) return 'information';
  }
  for (const kw of workKeywords) {
    if (lower.includes(kw)) return 'work';
  }

  return null;
}

export function generateTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.replace(/^www\./, '');
    const pathSegments = parsed.pathname
      .split('/')
      .filter((s) => s.length > 0 && !s.match(/^[0-9]+$/));

    if (pathSegments.length > 0) {
      const last = pathSegments[pathSegments.length - 1]
        .replace(/[-_]/g, ' ')
        .replace(/\.[a-zA-Z0-9]+$/, '');
      if (last.length > 2) {
        return `${capitalize(last)} - ${host}`;
      }
    }
    return host;
  } catch {
    return url;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function getDefaultThumbnailUrl(rawUrl: string): string {
  const url = normalizeUrl(rawUrl);
  if (!url) return '';
  const lower = url.toLowerCase();

  // 1. YouTube video
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  // 2. GitHub repo
  const ghMatch = url.match(/https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\/|$)/i);
  if (ghMatch && ghMatch[1] && ghMatch[2] && !['features', 'topics', 'trending', 'collections', 'events', 'settings'].includes(ghMatch[1])) {
    return `https://opengraph.githubassets.com/1/${ghMatch[1]}/${ghMatch[2].replace(/\.git$/, '')}`;
  }

  // 3. Vimeo
  const vimeoMatch = url.match(/https?:\/\/(?:www\.)?vimeo\.com\/([0-9]+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
  }

  // 4. Popular platforms curated high-res previews
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=800&auto=format&fit=crop';
  }
  if (lower.includes('spotify.com')) {
    return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop';
  }
  if (lower.includes('wikipedia.org')) {
    return 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=800&auto=format&fit=crop';
  }
  if (lower.includes('news.ycombinator.com')) {
    return 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=800&auto=format&fit=crop';
  }
  if (lower.includes('mit.edu') || lower.includes('coursera') || lower.includes('edx.org')) {
    return 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop';
  }
  if (lower.includes('arxiv.org')) {
    return 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=800&auto=format&fit=crop';
  }

  // 5. High-resolution screenshot preview for any standard web destination
  return `https://v1.screenshot.11ty.dev/${encodeURIComponent(url)}/opengraph/`;
}
