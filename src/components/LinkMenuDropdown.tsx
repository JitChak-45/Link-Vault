import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Shield, QrCode, Edit2, Trash2 } from 'lucide-react';
import { SavedLink } from '../types';

interface LinkMenuDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  link: SavedLink;
  onOpenOptions?: (link: SavedLink) => void;
  onOpenIncognito: () => void;
  onShareQr?: (link: SavedLink) => void;
  onEdit: (link: SavedLink) => void;
  onDelete: (id: string) => void;
}

interface Coords {
  top?: number;
  bottom?: number;
  right: number;
  maxHeight: number;
}

export const LinkMenuDropdown: React.FC<LinkMenuDropdownProps> = ({
  isOpen,
  onClose,
  triggerRef,
  link,
  onOpenOptions,
  onOpenIncognito,
  onShareQr,
  onEdit,
  onDelete,
}) => {
  const [coords, setCoords] = useState<Coords | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 280; // Full height of all 5 items + divider + margins
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const margin = 8;

      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;

      // Flip upward if below space is cramped and above has more room
      const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      // Available vertical space in chosen direction
      const availableHeight = openUpward ? spaceAbove : spaceBelow;
      const calculatedMaxHeight = Math.max(160, Math.min(menuHeight, availableHeight));

      setCoords({
        top: openUpward ? undefined : Math.max(margin, rect.bottom + 6),
        bottom: openUpward ? Math.max(margin, viewportHeight - rect.top + 6) : undefined,
        right: Math.max(margin, Math.min(viewportWidth - 216, viewportWidth - rect.right)),
        maxHeight: calculatedMaxHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, triggerRef]);

  if (!isOpen || !coords) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Invisible backdrop click-catcher to dismiss dropdown */}
      <div
        className="fixed inset-0 z-[98]"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Portaled Dropdown Menu Container */}
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          top: coords.top !== undefined ? `${coords.top}px` : undefined,
          bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
          right: `${coords.right}px`,
          maxHeight: `${coords.maxHeight}px`,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className="z-[99] w-52 bg-white dark:bg-[#0D1422] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 py-1.5 animate-in fade-in zoom-in-95 duration-150 overflow-y-auto select-none flex flex-col"
      >
        {onOpenOptions && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenOptions(link);
            }}
            className="w-full px-3.5 py-2.5 sm:py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#111B2E] flex items-center gap-2.5 min-h-[44px] sm:min-h-0 touch-manipulation transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
            <span>Launch Options</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenIncognito();
          }}
          className="w-full px-3.5 py-2.5 sm:py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#111B2E] flex items-center gap-2.5 min-h-[44px] sm:min-h-0 touch-manipulation transition-colors"
        >
          <Shield className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <span>Incognito Details</span>
        </button>

        {onShareQr && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onShareQr(link);
            }}
            className="w-full px-3.5 py-2.5 sm:py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#111B2E] flex items-center gap-2.5 min-h-[44px] sm:min-h-0 touch-manipulation transition-colors"
          >
            <QrCode className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>Share QR Code</span>
          </button>
        )}

        {/* Divider before Edit and Delete */}
        <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

        <button
          type="button"
          onClick={() => {
            onClose();
            onEdit(link);
          }}
          className="w-full px-3.5 py-2.5 sm:py-2 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-cyan-400 flex items-center gap-2.5 min-h-[44px] sm:min-h-0 touch-manipulation transition-colors"
        >
          <Edit2 className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <span>Edit</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onDelete(link.id);
          }}
          className="w-full px-3.5 py-2.5 sm:py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 min-h-[44px] sm:min-h-0 touch-manipulation transition-colors"
        >
          <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
          <span>Delete</span>
        </button>
      </div>
    </>,
    document.body
  );
};
