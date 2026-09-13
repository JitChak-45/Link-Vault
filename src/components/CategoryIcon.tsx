import React from 'react';
import {
  Film,
  GraduationCap,
  Compass,
  Briefcase,
  Bookmark,
  Sparkles,
  Code,
  Database,
  Globe,
  Music,
  Newspaper,
  Folder,
  Heart,
  Coffee,
  LucideIcon,
} from 'lucide-react';

interface CategoryIconProps {
  name: string;
  className?: string;
  color?: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  'film': Film,
  'graduation-cap': GraduationCap,
  'compass': Compass,
  'briefcase': Briefcase,
  'bookmark': Bookmark,
  'sparkles': Sparkles,
  'code': Code,
  'database': Database,
  'globe': Globe,
  'music': Music,
  'newspaper': Newspaper,
  'folder': Folder,
  'heart': Heart,
  'coffee': Coffee,
};

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name,
  className = 'w-4 h-4',
  color,
}) => {
  const IconComponent = ICON_MAP[name] || Folder;
  return <IconComponent className={className} style={color ? { color } : undefined} />;
};
