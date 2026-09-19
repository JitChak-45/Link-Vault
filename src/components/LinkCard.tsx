import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Star,
  MoreVertical,
  Edit2,
  Trash2,
  Globe,
  Tag,
  Eye,
  Shield,
  QrCode,
  Lock,
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react';
import { Category, SavedLink, ViewMode } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { extractHostname, getFaviconUrl, getDefaultThumbnailUrl, normalizeUrl } from '../utils/urlHelper';
import { LinkLongPressSheet } from './LinkLongPressSheet';
import { LinkMenuDropdown } from './LinkMenuDropdown';

interface LinkCardProps {
  link: SavedLink;
  category?: Category;
  viewMode: ViewMode;
  onOpen: (link: SavedLink) => void;
  onOpenOptions?: (link: SavedLink) => void;
  onShareQr?: (link: SavedLink) => void;
  onEdit: (link: SavedLink) => void;
  onDelete: (linkId: string) => void;
  onToggleFavorite: (link: SavedLink) => void;
  onSelectTag?: (tag: string) => void;
}

export const LinkCard: React.FC<LinkCardProps> = ({
  link,
  category,
  viewMode,
  onOpen,
  onOpenOptions,
  onShareQr,
  onEdit,
  onDelete,
  onToggleFavorite,
  onSelectTag,
}) => {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [showOpenMenu, setShowOpenMenu] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [incognitoNotice, setIncognitoNotice] = useState(false);

  // Long-press detection and mobile quick action bottom sheet
  const [showLongPressSheet, setShowLongPressSheet] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);

  const domain = extractHostname(link.url);
  const favicon = link.faviconUrl || getFaviconUrl(link.url);
  const effectiveThumbnail = link.imageUrl || getDefaultThumbnailUrl(link.url);
  const hasThumbnail = Boolean(effectiveThumbnail && !thumbnailError);
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const isMobile =
    typeof window !== 'undefined' &&
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 0 && window.innerWidth <= 768));
  const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);
  const targetUrl = normalizeUrl(link.url);

  // Cleanup long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const startLongPress = useCallback((clientX: number, clientY: number) => {
    touchStartPosRef.current = { x: clientX, y: clientY };
    setIsPressing(true);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      setIsPressing(false);
      // Mobile haptic feedback vibration if supported
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(50);
        } catch {
          // ignore
        }
      }
      setShowLongPressSheet(true);
    }, 450);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsPressing(false);
    if (didLongPressRef.current) {
      // Keep guard active briefly to prevent subsequent onClick
      setTimeout(() => {
        didLongPressRef.current = false;
      }, 350);
    }
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      startLongPress(touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPosRef.current && e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
      // Cancel long press if user is scrolling (> 10px movement)
      if (deltaX > 10 || deltaY > 10) {
        cancelLongPress();
      }
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
  };

  const handleTouchCancel = () => {
    cancelLongPress();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      startLongPress(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    cancelLongPress();
  };

  const handleMouseLeave = () => {
    cancelLongPress();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (didLongPressRef.current) {
      e.preventDefault();
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (didLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(link);
  };

  const handleOpenNormal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowOpenMenu(false);
    onOpen(link);
    try {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenIncognito = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setShowOpenMenu(false);
    onOpen(link);
    try {
      navigator.clipboard.writeText(targetUrl);
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(40);
      }
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
    if (isMobile && onOpenOptions) {
      onOpenOptions(link);
    } else {
      setIncognitoNotice(true);
      setTimeout(() => setIncognitoNotice(false), 7000);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (viewMode === 'list') {
    return (
      <div
        id={`link-item-${link.id}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onClick={handleCardClick}
        style={{ WebkitTouchCallout: 'none' }}
        className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 bg-white dark:bg-[#0D1422] rounded-xl border border-slate-200/90 dark:border-slate-800/90 hover:border-blue-400/50 dark:hover:border-blue-500/40 hover:shadow-md transition-all gap-2.5 sm:gap-4 select-none touch-manipulation cursor-pointer sm:cursor-default ${
          isPressing ? 'scale-[0.99] ring-2 ring-cyan-400/50 bg-cyan-500/10' : ''
        }`}
      >
        {/* Left: Thumbnail/Favicon + Title + Host + Category */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          {/* Visual: OpenGraph Thumbnail or Favicon */}
          {hasThumbnail ? (
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (didLongPressRef.current) {
                  e.preventDefault();
                  return;
                }
                onOpen(link);
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              title={`Open ${link.title}`}
              className="relative w-12 h-12 sm:w-14 sm:h-10 rounded-lg overflow-hidden border border-slate-200/70 dark:border-slate-800 shrink-0 bg-slate-100 dark:bg-[#111B2E] group-hover:brightness-95 transition-all block cursor-pointer mt-0.5 sm:mt-0 touch-manipulation"
            >
              <img
                src={effectiveThumbnail}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={() => setThumbnailError(true)}
              />
              <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-xs bg-white/95 dark:bg-[#0D1422]/95 p-0.5 flex items-center justify-center shadow-xs">
                {!faviconError ? (
                  <img
                    src={favicon}
                    alt=""
                    className="w-2.5 h-2.5 object-contain"
                    onError={() => setFaviconError(true)}
                  />
                ) : (
                  <Globe className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                )}
              </div>
            </a>
          ) : (
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (didLongPressRef.current) {
                  e.preventDefault();
                  return;
                }
                onOpen(link);
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              title={`Open ${link.title}`}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#111B2E] border border-slate-200/70 dark:border-slate-800 p-2 flex items-center justify-center shrink-0 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-[#162238] transition-colors mt-0.5 sm:mt-0 touch-manipulation"
            >
              {!faviconError ? (
                <img
                  src={favicon}
                  alt=""
                  className="w-5 h-5 object-contain"
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <Globe className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              )}
            </a>
          )}

          {/* Title and Domain */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (didLongPressRef.current) {
                    e.preventDefault();
                    return;
                  }
                  onOpen(link);
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="font-bold text-[#0F172A] dark:text-[#F1F5F9] hover:text-blue-600 dark:hover:text-cyan-400 text-xs sm:text-sm line-clamp-1 sm:truncate transition-colors cursor-pointer text-left leading-snug py-0.5 touch-manipulation"
                title={`Open ${link.title} (Long press or right-click for quick actions)`}
              >
                {link.title}
              </a>

              {category && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
                  style={{
                    backgroundColor: `${category.color}15`,
                    color: category.color,
                  }}
                >
                  <CategoryIcon name={category.icon} color={category.color} className="w-2.5 h-2.5" />
                  <span>{category.name}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex-wrap">
              <span className="font-mono">{domain}</span>
              <span>·</span>
              <span>{formatDate(link.createdAt)}</span>
              {link.clickCount > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                    <Eye className="w-3 h-3" />
                    {link.clickCount}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Tags */}
          {link.tags && link.tags.length > 0 && (
            <div className="hidden md:flex items-center gap-1 shrink-0">
              {link.tags.slice(0, 2).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTag && onSelectTag(tag);
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-[10px] px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#111B2E] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium transition-colors touch-manipulation"
                >
                  #{tag}
                </button>
              ))}
              {link.tags.length > 2 && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">+{link.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions Row: Optimized for mobile touch targets (40px on mobile, 32px on sm) */}
        <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-1.5 pt-2 sm:pt-0 border-t border-slate-100 dark:border-slate-800/80 sm:border-0 shrink-0 w-full sm:w-auto">
          {/* Left utility buttons on mobile */}
          <div className="flex items-center gap-1">
            {/* Favorite */}
            <button
              type="button"
              onClick={handleToggleFavorite}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-amber-50/70 dark:hover:bg-amber-950/30 active:bg-amber-100 transition-colors touch-manipulation active:scale-95"
              title={link.isFavorite ? 'Unfavorite' : 'Favorite'}
            >
              <Star
                className={`w-4 h-4 ${
                  link.isFavorite ? 'text-amber-500 fill-amber-500' : ''
                }`}
              />
            </button>

            {/* QR Code Share */}
            {onShareQr && (
              <button
                type="button"
                onClick={() => onShareQr(link)}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg text-slate-400 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 active:bg-blue-100 transition-colors touch-manipulation active:scale-95"
                title="Share via QR Code"
              >
                <QrCode className="w-4 h-4 text-slate-400 dark:text-slate-200" />
              </button>
            )}

            {/* Copy URL */}
            <button
              type="button"
              onClick={handleCopy}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111B2E] active:bg-slate-200 transition-colors touch-manipulation active:scale-95"
              title="Copy URL"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Incognito Link (Right-click: Open link in incognito window, or tap for launcher on mobile) */}
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                handleOpenIncognito(e);
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111B2E] active:bg-slate-200 transition-colors cursor-pointer touch-manipulation active:scale-95"
              title={isMobile ? "Touch & hold for incognito menu, or tap for launch helper" : "Right-click & choose 'Open link in incognito window' (or click to copy & open)"}
            >
              <Shield className="w-4 h-4" />
            </a>
          </div>

          {/* Right utility buttons on mobile */}
          <div className="flex items-center gap-1.5">
            {/* Direct Open in New Tab Button */}
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (didLongPressRef.current) {
                  e.preventDefault();
                  return;
                }
                onOpen(link);
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-3 h-10 sm:h-8 rounded-xl sm:rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 active:from-blue-800 active:to-cyan-800 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer shrink-0 touch-manipulation"
              title="Open in new tab (Right-click for Incognito)"
            >
              <span>Open</span>
              <ExternalLink className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
            </a>

            {/* 3-dots Menu */}
            <div className="relative">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111B2E] active:bg-slate-200 transition-colors touch-manipulation active:scale-95"
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Floating Incognito Toast */}
        {incognitoNotice && (
          <div className="absolute inset-x-2 sm:inset-x-3 bottom-2 p-2.5 sm:p-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 border border-slate-700/80 max-w-full">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>URL Copied to Clipboard!</span>
                </div>
                {isMobile ? (
                  <div className="space-y-0.5 text-[11px] text-slate-200">
                    <p>
                      <strong>Phone tip:</strong> Touch & hold the shield icon or link to choose{' '}
                      <span className="text-cyan-300 font-medium">"Open in incognito tab"</span>.
                    </p>
                    <p className="text-slate-300">
                      Or switch to your browser's Private tab and paste the copied link.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-200">
                      <strong>Method 1:</strong> Right-click the shield icon or "Open" and select <span className="text-amber-300 font-medium">"Open link in incognito window"</span>.
                    </p>
                    <p className="text-[11px] text-slate-300">
                      <strong>Method 2:</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-white">{isMac ? '⌘+Shift+N' : 'Ctrl+Shift+N'}</kbd> for Incognito, then paste (<kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-white">{isMac ? '⌘+V' : 'Ctrl+V'}</kbd>).
                    </p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIncognitoNotice(false)}
                className="text-slate-400 hover:text-white shrink-0 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              {onOpenOptions && (
                <button
                  type="button"
                  onClick={() => {
                    setIncognitoNotice(false);
                    onOpenOptions(link);
                  }}
                  className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Shield className="w-3 h-3" />
                  <span>Launch helper</span>
                </button>
              )}
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  onOpen(link);
                  setIncognitoNotice(false);
                }}
                className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 underline inline-flex items-center gap-1 ml-auto"
              >
                <span>Open in normal tab instead</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Portaled 3-Dots Action Dropdown Menu */}
        <LinkMenuDropdown
          isOpen={showMenu}
          onClose={() => setShowMenu(false)}
          triggerRef={menuButtonRef}
          link={link}
          onOpenOptions={onOpenOptions}
          onOpenIncognito={() => handleOpenIncognito()}
          onShareQr={onShareQr}
          onEdit={onEdit}
          onDelete={onDelete}
        />

        {/* Mobile Long-Press Quick Actions Bottom Sheet */}
        <LinkLongPressSheet
          isOpen={showLongPressSheet}
          onClose={() => setShowLongPressSheet(false)}
          link={link}
          category={category}
          domain={domain}
          favicon={favicon}
          faviconError={faviconError}
          onFaviconError={() => setFaviconError(true)}
          copied={copied}
          targetUrl={targetUrl}
          onCopy={handleCopy}
          onOpenNormal={() => handleOpenNormal()}
          onOpenIncognito={() => handleOpenIncognito()}
          onToggleFavorite={handleToggleFavorite}
          onShareQr={onShareQr}
          onOpenOptions={onOpenOptions}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    );
  }

  // Grid view card
  return (
    <div
      id={`link-card-${link.id}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      onClick={handleCardClick}
      style={{ WebkitTouchCallout: 'none' }}
      className={`group relative flex flex-col justify-between bg-white dark:bg-[#0D1422] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 hover:border-blue-400/50 dark:hover:border-blue-500/40 hover:shadow-lg transition-all duration-200 select-none touch-manipulation cursor-pointer sm:cursor-default ${
        showMenu ? 'z-30' : 'z-auto'
      } ${isPressing ? 'scale-[0.99] ring-2 ring-cyan-400/50 bg-cyan-500/10' : ''}`}
    >
      {/* Top OpenGraph Banner (if available) */}
      {hasThumbnail && (
        <div className="relative w-full h-36 sm:h-40 rounded-t-2xl bg-slate-100 dark:bg-[#111B2E] border-b border-slate-100 dark:border-slate-800/80">
          <div className="absolute inset-0 overflow-hidden rounded-t-2xl">
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (didLongPressRef.current) {
                  e.preventDefault();
                  return;
                }
                onOpen(link);
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="block w-full h-full cursor-pointer touch-manipulation"
              title={`Open ${link.title}`}
            >
              <img
                src={effectiveThumbnail}
                alt={link.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={() => setThumbnailError(true)}
              />
            </a>
          </div>

          {/* Banner Overlays: Category pill & action buttons */}
          <div className="absolute inset-x-0 top-0 p-3 flex items-center justify-between bg-gradient-to-b from-slate-900/60 to-transparent z-10">
            {category && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/95 dark:bg-[#0D1422]/90 text-slate-800 dark:text-slate-100 shadow-xs backdrop-blur-xs border border-transparent dark:border-slate-700/60"
              >
                <CategoryIcon name={category.icon} color={category.color} className="w-3 h-3" />
                <span>{category.name}</span>
              </span>
            )}

            <div className="flex items-center gap-1">
              {/* QR Code */}
              {onShareQr && (
                <button
                  type="button"
                  onClick={() => onShareQr(link)}
                  onTouchStart={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg bg-white/90 hover:bg-white dark:bg-[#0D1422]/90 dark:hover:bg-[#111B2E] text-slate-400 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-400 shadow-xs transition-colors touch-manipulation active:scale-95"
                  title="Share via QR Code"
                >
                  <QrCode className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-400 dark:text-slate-200" />
                </button>
              )}

              {/* Star */}
              <button
                type="button"
                onClick={handleToggleFavorite}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg bg-white/90 hover:bg-white dark:bg-[#0D1422]/90 dark:hover:bg-[#111B2E] text-slate-600 dark:text-slate-300 hover:text-amber-500 shadow-xs transition-colors touch-manipulation active:scale-95"
                title={link.isFavorite ? 'Favorited' : 'Add to favorites'}
              >
                <Star
                  className={`w-4 h-4 sm:w-3.5 sm:h-3.5 ${
                    link.isFavorite ? 'text-amber-500 fill-amber-500' : ''
                  }`}
                />
              </button>

              {/* Menu */}
              <div className="relative">
                <button
                  ref={menuButtonRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg bg-white/90 hover:bg-white dark:bg-[#0D1422]/90 dark:hover:bg-[#111B2E] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xs transition-colors touch-manipulation active:scale-95"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Card Content */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Header row when no top banner */}
          {!hasThumbnail && (
            <div className="flex items-center justify-between gap-2 mb-3">
              {category && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{
                    backgroundColor: `${category.color}15`,
                    color: category.color,
                    border: `1px solid ${category.color}30`,
                  }}
                >
                  <CategoryIcon name={category.icon} color={category.color} className="w-3.5 h-3.5" />
                  <span>{category.name}</span>
                </span>
              )}

              <div className="flex items-center gap-1">
                {onShareQr && (
                  <button
                    type="button"
                    onClick={() => onShareQr(link)}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg text-slate-400 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 transition-colors touch-manipulation active:scale-95"
                    title="Share via QR Code"
                  >
                    <QrCode className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-400 dark:text-slate-200" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  onTouchStart={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors touch-manipulation active:scale-95"
                  title={link.isFavorite ? 'Favorited' : 'Add to favorites'}
                >
                  <Star
                    className={`w-4 h-4 ${
                      link.isFavorite ? 'text-amber-500 fill-amber-500' : ''
                    }`}
                  />
                </button>

                <div className="relative">
                  <button
                    ref={menuButtonRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111B2E] transition-colors touch-manipulation active:scale-95"
                    title="More options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Title + Host Row */}
          <div className="flex items-start gap-2.5 mb-2">
            <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg bg-slate-100 dark:bg-[#111B2E] border border-slate-200/80 dark:border-slate-800 p-1 flex items-center justify-center shrink-0 mt-0.5">
              {!faviconError ? (
                <img
                  src={favicon}
                  alt=""
                  className="w-4 h-4 object-contain"
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <Globe className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (didLongPressRef.current) {
                    e.preventDefault();
                    return;
                  }
                  onOpen(link);
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="font-bold text-[#0F172A] dark:text-[#F1F5F9] hover:text-blue-600 dark:hover:text-cyan-400 text-xs sm:text-sm line-clamp-2 leading-snug transition-colors group-hover:text-blue-600 dark:group-hover:text-cyan-400 text-left cursor-pointer py-0.5 touch-manipulation"
                title={`Open ${link.title} (Long press or right-click for quick actions)`}
              >
                {link.title}
              </a>
              <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 block truncate mt-0.5">
                {domain}
              </span>
            </div>
          </div>

          {/* Description / Notes */}
          {link.description && (
            <p className="text-slate-600 dark:text-slate-300 text-xs line-clamp-2 mb-3 leading-relaxed">
              {link.description}
            </p>
          )}

          {/* Tags */}
          {link.tags && link.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {link.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTag && onSelectTag(tag);
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] sm:text-[10px] px-2.5 py-1 sm:py-0.5 rounded-lg bg-slate-100 dark:bg-[#111B2E] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium transition-colors touch-manipulation"
                >
                  <Tag className="w-3 h-3 sm:w-2.5 sm:h-2.5 text-slate-400 dark:text-slate-500" />
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom info & quick action bar: 40px touch targets on mobile */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0">
            <span className="truncate">{formatDate(link.createdAt)}</span>
            {link.clickCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0">
                  <Eye className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  {link.clickCount}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-1 shrink-0">
            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111B2E] active:bg-slate-200 transition-colors touch-manipulation active:scale-95"
              title="Copy URL"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Incognito Link (Right-click: Open link in incognito window, or tap for launcher on mobile) */}
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                handleOpenIncognito(e);
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl sm:rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111B2E] active:bg-slate-200 transition-colors cursor-pointer touch-manipulation active:scale-95"
              title={isMobile ? "Touch & hold for incognito menu, or tap for launch helper" : "Right-click & choose 'Open link in incognito window' (or click to copy & open)"}
            >
              <Shield className="w-4 h-4" />
            </a>

            {/* Direct Open in New Tab Button */}
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (didLongPressRef.current) {
                  e.preventDefault();
                  return;
                }
                onOpen(link);
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-3 h-10 sm:h-8 rounded-xl sm:rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 active:from-blue-800 active:to-cyan-800 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer shrink-0 touch-manipulation"
              title="Open in new tab (Right-click for Incognito)"
            >
              <span>Open</span>
              <ExternalLink className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Floating Incognito Toast */}
      {incognitoNotice && (
        <div className="absolute inset-x-2 sm:inset-x-3 bottom-2 p-2.5 sm:p-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 border border-slate-700/80 max-w-full">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>URL Copied to Clipboard!</span>
              </div>
              {isMobile ? (
                <div className="space-y-0.5 text-[11px] text-slate-200">
                  <p>
                    <strong>Phone tip:</strong> Touch & hold the shield icon or link to choose{' '}
                    <span className="text-cyan-300 font-medium">"Open in incognito tab"</span>.
                  </p>
                  <p className="text-slate-300">
                    Or switch to your browser's Private tab and paste the copied link.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-slate-200">
                    <strong>Method 1:</strong> Right-click the shield icon or "Open" and select <span className="text-amber-300 font-medium">"Open link in incognito window"</span>.
                  </p>
                  <p className="text-[11px] text-slate-300">
                    <strong>Method 2:</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-white">{isMac ? '⌘+Shift+N' : 'Ctrl+Shift+N'}</kbd> for Incognito, then paste (<kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-white">{isMac ? '⌘+V' : 'Ctrl+V'}</kbd>).
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIncognitoNotice(false)}
              className="text-slate-400 hover:text-white shrink-0 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            {onOpenOptions && (
              <button
                type="button"
                onClick={() => {
                  setIncognitoNotice(false);
                  onOpenOptions(link);
                }}
                className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Shield className="w-3 h-3" />
                <span>Launch helper</span>
              </button>
            )}
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onOpen(link);
                setIncognitoNotice(false);
              }}
              className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 underline inline-flex items-center gap-1 ml-auto"
            >
              <span>Open in normal tab instead</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Portaled 3-Dots Action Dropdown Menu */}
      <LinkMenuDropdown
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        triggerRef={menuButtonRef}
        link={link}
        onOpenOptions={onOpenOptions}
        onOpenIncognito={() => handleOpenIncognito()}
        onShareQr={onShareQr}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      {/* Mobile Long-Press Quick Actions Bottom Sheet */}
      <LinkLongPressSheet
        isOpen={showLongPressSheet}
        onClose={() => setShowLongPressSheet(false)}
        link={link}
        category={category}
        domain={domain}
        favicon={favicon}
        faviconError={faviconError}
        onFaviconError={() => setFaviconError(true)}
        copied={copied}
        targetUrl={targetUrl}
        onCopy={handleCopy}
        onOpenNormal={() => handleOpenNormal()}
        onOpenIncognito={() => handleOpenIncognito()}
        onToggleFavorite={handleToggleFavorite}
        onShareQr={onShareQr}
        onOpenOptions={onOpenOptions}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
};
