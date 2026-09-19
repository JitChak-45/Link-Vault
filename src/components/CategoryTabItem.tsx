import React, { useState, useRef, useEffect } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { GripVertical, EyeOff, Pencil, QrCode, Trash2 } from 'lucide-react';
import { Category } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface CategoryTabItemProps {
  cat: Category;
  isSelected: boolean;
  count: number;
  isDraggingThis: boolean;
  theme: 'light' | 'dark';
  categoriesScrollRef: React.RefObject<HTMLDivElement | null>;
  categoriesRef: React.MutableRefObject<Category[]>;
  autoScrollSpeedRef: React.MutableRefObject<number>;
  startAutoScroll: () => void;
  stopAutoScroll: () => void;
  setActiveDraggingCatSlug: (slug: string | null) => void;
  commitCategoryOrderToCloud: (categories: Category[]) => void;
  onSelectCategory: (slug: string) => void;
  onEditCategory: (cat: Category) => void;
  onShareCategory: (cat: Category) => void;
  onRequestDeleteCategory: (cat: Category) => void;
}

export const CategoryTabItem: React.FC<CategoryTabItemProps> = ({
  cat,
  isSelected,
  count,
  isDraggingThis,
  theme,
  categoriesScrollRef,
  categoriesRef,
  autoScrollSpeedRef,
  startAutoScroll,
  stopAutoScroll,
  setActiveDraggingCatSlug,
  commitCategoryOrderToCloud,
  onSelectCategory,
  onEditCategory,
  onShareCategory,
  onRequestDeleteCategory,
}) => {
  const dragControls = useDragControls();

  // Mobile long-press state
  const [isHoldingMobile, setIsHoldingMobile] = useState(false);
  const [isLongPressActive, setIsLongPressActive] = useState(false);

  const longPressTimerRef = useRef<number | null>(null);
  const holdIndicatorTimerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const savedPointerEventRef = useRef<React.PointerEvent | null>(null);
  const isDraggingGestureRef = useRef(false);
  const isLongPressTriggeredRef = useRef(false);
  const itemContainerRef = useRef<HTMLDivElement | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (holdIndicatorTimerRef.current) clearTimeout(holdIndicatorTimerRef.current);
    };
  }, []);

  const clearTimers = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (holdIndicatorTimerRef.current) {
      clearTimeout(holdIndicatorTimerRef.current);
      holdIndicatorTimerRef.current = null;
    }
    setIsHoldingMobile(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // If target is inside an action button (edit, qr, delete), let button handle it
    const target = e.target as HTMLElement;
    if (
      target.closest('button[id^="edit-category-"]') ||
      target.closest('button[id^="share-category-"]') ||
      target.closest('button[id^="delete-category-"]')
    ) {
      return;
    }

    // Computer version: Instant mouse drag (do not change anything for computer version)
    if (e.pointerType === 'mouse') {
      dragControls.start(e);
      return;
    }

    // Mobile / Touch version: Require long press to reorder
    if (e.pointerType === 'touch') {
      startPosRef.current = { x: e.clientX, y: e.clientY };
      savedPointerEventRef.current = e;
      isDraggingGestureRef.current = false;
      isLongPressTriggeredRef.current = false;

      // Subtle indicator after 180ms of holding still
      holdIndicatorTimerRef.current = window.setTimeout(() => {
        setIsHoldingMobile(true);
      }, 180);

      // Long press triggers at 420ms
      longPressTimerRef.current = window.setTimeout(() => {
        setIsHoldingMobile(false);
        setIsLongPressActive(true);
        isLongPressTriggeredRef.current = true;
        isDraggingGestureRef.current = true;

        // Gentle haptic feedback on mobile if supported
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(40);
          } catch (_) {}
        }

        // Attach non-passive touchmove preventDefault to prevent browser native scroll during active drag
        const preventTouchScroll = (ev: TouchEvent) => {
          if (isDraggingGestureRef.current && ev.cancelable) {
            ev.preventDefault();
          }
        };
        window.addEventListener('touchmove', preventTouchScroll, { passive: false });

        const handleTouchEnd = () => {
          isDraggingGestureRef.current = false;
          setIsLongPressActive(false);
          window.removeEventListener('touchmove', preventTouchScroll);
          window.removeEventListener('touchend', handleTouchEnd);
          window.removeEventListener('touchcancel', handleTouchEnd);
        };
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('touchcancel', handleTouchEnd);

        // Attempt pointer capture
        try {
          if (itemContainerRef.current && e.pointerId) {
            itemContainerRef.current.setPointerCapture(e.pointerId);
          }
        } catch (_) {}

        // Programmatically start Framer Motion drag
        if (savedPointerEventRef.current) {
          dragControls.start(savedPointerEventRef.current);
        }
      }, 420);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;

    // If long press has not triggered yet, check if finger moved
    if (!isDraggingGestureRef.current) {
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      // If movement exceeds 8px, user is scrolling horizontally! Cancel long press!
      if (Math.hypot(dx, dy) > 8) {
        clearTimers();
      } else {
        // Keep pointer event position updated
        savedPointerEventRef.current = e;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    clearTimers();
    setIsLongPressActive(false);

    // If long press was triggered, reset the flag after a short delay so click is suppressed
    if (isLongPressTriggeredRef.current) {
      setTimeout(() => {
        isLongPressTriggeredRef.current = false;
      }, 150);
    }
  };

  const handlePointerCancel = () => {
    clearTimers();
    setIsLongPressActive(false);
    isDraggingGestureRef.current = false;
  };

  return (
    <Reorder.Item
      key={cat.slug}
      value={cat}
      as="div"
      dragControls={dragControls}
      dragListener={false}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      ref={itemContainerRef}
      whileDrag={{
        scale: 1.05,
        zIndex: 60,
        cursor: 'grabbing',
        boxShadow:
          theme === 'dark'
            ? '0 16px 36px -4px rgba(0, 0, 0, 0.9), 0 0 0 2px rgba(6, 182, 212, 0.9)'
            : '0 16px 36px -4px rgba(0, 0, 0, 0.25), 0 0 0 2px rgba(6, 182, 212, 0.9)',
      }}
      transition={{ type: 'spring', damping: 28, stiffness: 380 }}
      onDragStart={() => {
        setActiveDraggingCatSlug(cat.slug);
        startAutoScroll();
      }}
      onDrag={(event, info) => {
        const container = categoriesScrollRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = info.point.x;
        const threshold = 120;

        // Auto-scroll when dragged near left edge (towards start / All Links / Starred)
        if (x < rect.left + threshold) {
          const dist = rect.left + threshold - x;
          const factor = Math.min(1.8, Math.max(0.3, dist / threshold));
          autoScrollSpeedRef.current = -Math.round(18 * factor);
        }
        // Auto-scroll when dragged near right edge (towards end)
        else if (x > rect.right - threshold) {
          const dist = x - (rect.right - threshold);
          const factor = Math.min(1.8, Math.max(0.3, dist / threshold));
          autoScrollSpeedRef.current = Math.round(18 * factor);
        } else {
          autoScrollSpeedRef.current = 0;
        }
      }}
      onDragEnd={() => {
        stopAutoScroll();
        commitCategoryOrderToCloud(categoriesRef.current);
        setIsLongPressActive(false);
        isDraggingGestureRef.current = false;
      }}
      className={`relative group shrink-0 flex items-center rounded-xl transition-colors border select-none touch-pan-x ${
        isSelected
          ? 'text-white shadow-xs border-transparent'
          : 'bg-white dark:bg-[#0D1422] border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#111B2E]'
      } ${isDraggingThis ? 'opacity-95' : 'opacity-100'} ${
        isHoldingMobile ? 'ring-2 ring-cyan-400/50 scale-[1.02]' : ''
      } ${isLongPressActive ? 'ring-2 ring-cyan-400 shadow-md' : ''}`}
      style={isSelected ? { backgroundColor: cat.color } : undefined}
    >
      {/* Drag Grip Handle */}
      <div
        className={`pl-2.5 pr-0.5 py-2 cursor-grab active:cursor-grabbing flex items-center shrink-0 transition-colors ${
          isSelected
            ? 'text-white/80 hover:text-white'
            : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
        title="Drag on desktop, or long press on mobile to reorder"
        aria-label={`Drag to reorder ${cat.name}`}
      >
        <GripVertical className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Category Filter Selection Button */}
      <button
        type="button"
        id={`filter-category-${cat.slug}-btn`}
        onClick={() => {
          if (isLongPressTriggeredRef.current) {
            return; // Suppress selection click after long-press drag
          }
          onSelectCategory(cat.slug);
        }}
        className="flex items-center gap-1.5 pr-2 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer select-none"
      >
        <CategoryIcon
          name={cat.icon}
          color={isSelected ? '#ffffff' : cat.color}
          className="w-3.5 h-3.5"
        />
        <span>{cat.name}</span>
        {cat.hideFromAll && (
          <span
            title="Private category (hidden from All Links)"
            className={`p-0.5 rounded ${
              isSelected
                ? 'bg-black/20 text-white'
                : 'text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-blue-950/60'
            }`}
          >
            <EyeOff className="w-3 h-3" />
          </span>
        )}
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            isSelected
              ? 'bg-black/20 text-white'
              : 'bg-slate-100 dark:bg-[#111B2E] text-slate-600 dark:text-slate-300'
          }`}
        >
          {count}
        </span>
      </button>

      {/* Edit Category Button */}
      <button
        type="button"
        id={`edit-category-pill-${cat.slug}-btn`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onEditCategory(cat);
        }}
        className={`p-1.5 mr-1 rounded-lg transition-all cursor-pointer ${
          isSelected
            ? 'text-white bg-black/25 hover:bg-black/40 border border-white/25 shadow-2xs'
            : 'text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700/80 hover:text-blue-600 dark:hover:text-cyan-300 shadow-2xs'
        }`}
        title={`Edit ${cat.name} name, icon, color & privacy`}
        aria-label={`Edit ${cat.name}`}
      >
        <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-200" />
      </button>

      {/* Share Category via QR Code */}
      <button
        type="button"
        id={`share-category-qr-${cat.slug}-btn`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onShareCategory(cat);
        }}
        className={`p-1.5 mr-1 rounded-lg transition-all cursor-pointer ${
          isSelected
            ? 'text-white bg-black/25 hover:bg-black/40 border border-white/25 shadow-2xs'
            : 'text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700/80 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-2xs'
        }`}
        title={`Share ${cat.name} (${count} links) via QR Code`}
        aria-label={`Share ${cat.name} QR Code`}
      >
        <QrCode className="w-3.5 h-3.5 text-slate-400 dark:text-slate-200" />
      </button>

      {/* Delete Category Button */}
      <button
        type="button"
        id={`delete-category-pill-${cat.slug}-btn`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRequestDeleteCategory(cat);
        }}
        className={`p-1.5 mr-1.5 rounded-lg transition-all cursor-pointer ${
          isSelected
            ? 'text-white bg-black/25 hover:bg-black/40 border border-white/25 shadow-2xs hover:text-rose-200'
            : 'text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200/90 dark:border-slate-700/80 hover:text-rose-600 dark:hover:text-rose-400 shadow-2xs'
        }`}
        title={`Delete "${cat.name}" category (Requires App Lock PIN + Security Answer)`}
        aria-label={`Delete ${cat.name}`}
      >
        <Trash2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-200" />
      </button>
    </Reorder.Item>
  );
};
