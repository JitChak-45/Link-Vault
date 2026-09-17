export interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  description?: string;
  isDefault?: boolean;
  hideFromAll?: boolean;
  createdAt: number;
  order?: number;
}

export interface SavedLink {
  id: string;
  title: string;
  url: string;
  categorySlug: string;
  description?: string;
  tags: string[];
  isFavorite: boolean;
  clickCount: number;
  lastVisitedAt?: number;
  createdAt: number;
  updatedAt: number;
  imageUrl?: string;
  faviconUrl?: string;
}

export type SortOption = 'newest' | 'oldest' | 'clicks' | 'title';
export type ViewMode = 'grid' | 'list';
export type OpenTabMode = 'normal' | 'incognito';

export interface QrSharedCategoryPayload {
  version: 1;
  app: 'link-vault';
  type: 'category';
  category: {
    name: string;
    slug: string;
    icon: string;
    color: string;
    hideFromAll?: boolean;
    description?: string;
  };
  links: Array<{
    title: string;
    url: string;
    description?: string;
    tags?: string[];
    imageUrl?: string;
    faviconUrl?: string;
    isFavorite?: boolean;
  }>;
}

export interface QrSharedLinkPayload {
  version: 1;
  app: 'link-vault';
  type: 'link';
  link: {
    title: string;
    url: string;
    categorySlug?: string;
    categoryName?: string;
    categoryHideFromAll?: boolean;
    description?: string;
    tags?: string[];
    imageUrl?: string;
    faviconUrl?: string;
    isFavorite?: boolean;
  };
}

export type QrSharePayload = QrSharedCategoryPayload | QrSharedLinkPayload;
