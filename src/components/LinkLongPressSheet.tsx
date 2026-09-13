import React from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Star,
  Edit2,
  Trash2,
  Globe,
  Shield,
  QrCode,
  Sparkles,
  X,
} from 'lucide-react';
import { Category, SavedLink } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface LinkLongPressSheetProps {
  isOpen: boolean;
  onClose: () => void;
  link: SavedLink;
  category?: Category;
  domain: string;
  favicon: string;
  faviconError: boolean;
  onFaviconError: () => void;
  copied: boolean;
  targetUrl: string;
  onCopy: (e: React.MouseEvent) => void;
  onOpenNormal: () => void;
  onOpenIncognito: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onShareQr?: (link: SavedLink) => void;
  onOpenOptions?: (link: SavedLink) => void;
  onEdit: (link: SavedLink) => void;
  onDelete: (id: string) => void;
}

export const LinkLongPressSheet: React.FC<LinkLongPressSheetProps> = ({
  isOpen,
  onClose,
  link,
  category,
  domain,
  favicon,
  faviconError,
  onFaviconError,
  copied,
  targetUrl,
  onCopy,
  onOpenNormal,
  onOpenIncognito,
  onToggleFavorite,
  onShareQr,
  onOpenOptions,
  onEdit,
  onDelete,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        className="relative w-full sm:max-w-md bg-white dark:bg-[#0D1422] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 z-10 overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Link Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#111B2E] border border-slate-200/80 dark:border-slate-800 p-2 flex items-center justify-center shrink-0">
              {!faviconError ? (
                <img
                  src={favicon}
                  alt=""
                  className="w-5 h-5 object-contain"
                  onError={onFaviconError}
                />
              ) : (
                <Globe className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <h3 className="font-bold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] text-sm truncate leading-snug">
                  {link.title}
                </h3>
                {category && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
                    style={{
                      backgroundColor: `${category.color}20`,
                      color: category.color,
                      border: `1px solid ${category.color}40`,
                    }}
                  >
                    <CategoryIcon name={category.icon} color={category.color} className="w-2.5 h-2.5" />
                    <span>{category.name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500 truncate">{domain}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#111B2E] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 transition-colors touch-manipulation active:scale-95"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action List - High touch targets (min-h 48px) for mobile finger tapping */}
        <div className="p-2 sm:p-3 overflow-y-auto space-y-1">
          {/* 1. Open in New Tab */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNormal();
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-slate-800 dark:text-slate-100 hover:bg-blue-50/70 dark:hover:bg-blue-950/30 active:bg-blue-100 dark:active:bg-blue-900/40 transition-colors text-left touch-manipulation group min-h-[50px]"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0 group-hover:bg-blue-600 dark:group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Open in New Tab</div>
              <div className="text-xs text-slate-400 dark:text-slate-400 truncate">Launch in browser immediately</div>
            </div>
          </button>

          {/* 2. Open in Incognito */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenIncognito();
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#111B2E] active:bg-slate-200 transition-colors text-left touch-manipulation group min-h-[50px]"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#111B2E] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:bg-slate-800 dark:group-hover:bg-slate-700 group-hover:text-white transition-colors">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Open in Incognito Mode</div>
              <div className="text-xs text-slate-400 dark:text-slate-400 truncate">Auto-copies URL and provides private launch tips</div>
            </div>
          </button>

          {/* 3. Copy Link Address */}
          <button
            type="button"
            onClick={(e) => {
              onCopy(e);
              setTimeout(onClose, 800);
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#111B2E] active:bg-slate-200 transition-colors text-left touch-manipulation group min-h-[50px]"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#111B2E] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:bg-slate-800 dark:group-hover:bg-slate-700 group-hover:text-white transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {copied ? 'URL Copied to Clipboard!' : 'Copy Link Address'}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-400 truncate">{targetUrl}</div>
            </div>
          </button>

          {/* 4. Star / Favorite */}
          <button
            type="button"
            onClick={(e) => {
              onToggleFavorite(e);
              onClose();
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-slate-800 dark:text-slate-100 hover:bg-amber-50/70 dark:hover:bg-amber-950/30 active:bg-amber-100 transition-colors text-left touch-manipulation group min-h-[50px]"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center shrink-0">
              <Star className={`w-4 h-4 ${link.isFavorite ? 'fill-amber-500' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {link.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-400">
                {link.isFavorite ? 'Remove bookmark from favorites list' : 'Pin to favorites for fast 1-tap access'}
              </div>
            </div>
          </button>

          {/* 5. Share QR Code */}
          {onShareQr && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onShareQr(link);
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-slate-800 dark:text-slate-100 hover:bg-cyan-50/70 dark:hover:bg-cyan-950/30 active:bg-cyan-100 transition-colors text-left touch-manipulation group min-h-[50px]"
            >
              <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                <QrCode className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Share QR Code</div>
                <div className="text-xs text-slate-400 dark:text-slate-400">Display QR code to scan with a mobile camera</div>
              </div>
            </button>
          )}

          {/* 6. More Launch Options */}
          {onOpenOptions && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenOptions(link);
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-slate-800 dark:text-slate-100 hover:bg-purple-50/70 dark:hover:bg-purple-950/30 active:bg-purple-100 transition-colors text-left touch-manipulation group min-h-[50px]"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">More Launch Options</div>
                <div className="text-xs text-slate-400 dark:text-slate-400">Launch modes, browser choices & clipboard tools</div>
              </div>
            </button>
          )}

          {/* 7. Edit Link */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(link);
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#111B2E] active:bg-slate-200 transition-colors text-left touch-manipulation group min-h-[50px]"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#111B2E] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Edit2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Edit Link Details</div>
              <div className="text-xs text-slate-400 dark:text-slate-400">Update title, category, tags, or description</div>
            </div>
          </button>

          {/* 8. Delete Link */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete(link.id);
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:bg-rose-100 transition-colors text-left touch-manipulation group min-h-[50px]"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">Delete Bookmark</div>
              <div className="text-xs text-rose-400/80 truncate">Permanently remove this bookmark from your collection</div>
            </div>
          </button>
        </div>

        {/* Cancel Button */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-[#070B14]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-[#111B2E] active:bg-slate-200 transition-colors touch-manipulation min-h-[48px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
