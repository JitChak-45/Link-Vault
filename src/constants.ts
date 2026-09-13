import { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'entertainment',
    name: 'Entertainment',
    slug: 'entertainment',
    color: '#f59e0b', // warm amber
    icon: 'film',
    description: 'Movies, streaming, music, gaming, podcasts & leisure',
    isDefault: true,
    createdAt: 1,
  },
  {
    id: 'study',
    name: 'Study',
    slug: 'study',
    color: '#6366f1', // indigo
    icon: 'graduation-cap',
    description: 'Courses, textbooks, research papers, tutorials & notes',
    isDefault: true,
    createdAt: 2,
  },
  {
    id: 'information',
    name: 'Information',
    slug: 'information',
    color: '#0284c7', // sky blue
    icon: 'compass',
    description: 'News, Wikipedia, documentation, reference & tech updates',
    isDefault: true,
    createdAt: 3,
  },
  {
    id: 'work',
    name: 'Work & Tools',
    slug: 'work',
    color: '#10b981', // emerald green
    icon: 'briefcase',
    description: 'Productivity apps, repositories, dashboards & business',
    isDefault: true,
    createdAt: 4,
  },
  {
    id: 'reading',
    name: 'Reading & Articles',
    slug: 'reading',
    color: '#ec4899', // rose pink
    icon: 'bookmark',
    description: 'Long-form reads, essays, newsletters & personal archive',
    isDefault: true,
    createdAt: 5,
  },
];

export const AVAILABLE_COLORS = [
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Rose', hex: '#ec4899' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Slate', hex: '#64748b' },
];

export const AVAILABLE_ICONS = [
  'film',
  'graduation-cap',
  'compass',
  'briefcase',
  'bookmark',
  'sparkles',
  'code',
  'database',
  'globe',
  'music',
  'newspaper',
  'folder',
  'heart',
  'coffee',
];
