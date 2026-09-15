import React, { useState } from 'react';
import {
  X,
  DownloadCloud,
  Check,
  CheckSquare,
  Square,
  EyeOff,
  Globe,
  Tag,
  Shield,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Category, SavedLink, QrSharePayload } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { extractHostname, getFaviconUrl } from '../utils/urlHelper';

interface ImportSharedModalProps {
  isOpen: boolean;
  payload: QrSharePayload | null;
  existingCategories: Category[];
  onClose: () => void;
  onImportCategoryAndLinks: (
    categoryData: {
      name: string;
      slug: string;
      icon: string;
      color: string;
      hideFromAll: boolean;
      description?: string;
    },
    linksToImport: Array<{
      title: string;
      url: string;
      description?: string;
      tags?: string[];
      imageUrl?: string;
      faviconUrl?: string;
      isFavorite?: boolean;
    }>
  ) => void;
  onImportSingleLink: (linkData: {
    title: string;
    url: string;
    categorySlug: string;
    description?: string;
    tags?: string[];
    imageUrl?: string;
    faviconUrl?: string;
    isFavorite?: boolean;
  }) => void;
}

export const ImportSharedModal: React.FC<ImportSharedModalProps> = ({
  isOpen,
  payload,
  existingCategories,
  onClose,
  onImportCategoryAndLinks,
  onImportSingleLink,
}) => {
  const isCategory = payload?.type === 'category';

  // Category state
  const initialHideFromAll = isCategory
    ? Boolean(payload?.category?.hideFromAll)
    : false;
  const [hideFromAll, setHideFromAll] = useState(initialHideFromAll);

  // For category links, keep track of which links are selected
  const categoryLinks =
    isCategory && payload?.type === 'category' && Array.isArray(payload.links)
      ? payload.links
      : [];
  const [selectedIndices, setSelectedIndices] = useState<number[]>(
    () => categoryLinks.map((_, i) => i)
  );

  // For single link import
  const [targetCategorySlug, setTargetCategorySlug] = useState<string>(() => {
    if (payload?.type === 'link') {
      const slug = payload.link.categorySlug;
      if (slug && existingCategories.some((c) => c.slug === slug)) {
        return slug;
      }
    }
    return existingCategories[0]?.slug || 'entertainment';
  });

  // Re-sync privacy flag when payload or modal visibility changes
  React.useEffect(() => {
    if (payload?.type === 'category') {
      setHideFromAll(Boolean(payload.category.hideFromAll));
      const links = Array.isArray(payload.links) ? payload.links : [];
      setSelectedIndices(links.map((_, i) => i));
    }
  }, [payload, isOpen]);

  if (!isOpen || !payload) return null;

  const toggleSelectAll = () => {
    if (selectedIndices.length === categoryLinks.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(categoryLinks.map((_, i) => i));
    }
  };

  const toggleIndex = (idx: number) => {
    setSelectedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleConfirmImport = () => {
    if (payload.type === 'category') {
      // If user hasn't explicitly unselected all, default to importing all category links
      const selectedLinks =
        selectedIndices.length > 0
          ? categoryLinks.filter((_, i) => selectedIndices.includes(i))
          : categoryLinks;

      onImportCategoryAndLinks(
        {
          name: payload.category.name,
          slug: payload.category.slug,
          icon: payload.category.icon || 'Bookmark',
          color: payload.category.color || '#4f46e5',
          hideFromAll: hideFromAll,
          description: payload.category.description || '',
        },
        selectedLinks
      );
    } else if (payload.type === 'link') {
      onImportSingleLink({
        title: payload.link.title,
        url: payload.link.url,
        categorySlug: targetCategorySlug,
        description: payload.link.description || '',
        tags: Array.isArray(payload.link.tags) ? payload.link.tags : [],
        imageUrl: payload.link.imageUrl || '',
        faviconUrl: payload.link.faviconUrl || '',
        isFavorite: Boolean(payload.link.isFavorite),
      });
    }
    onClose();
  };

  return (
    <div
      id="import-shared-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="import-shared-modal-dialog"
        className="w-full max-w-lg bg-white dark:bg-[#0D1422] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111B2E]/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 flex items-center justify-center shadow-xs">
              <DownloadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] text-sm sm:text-base">
                {isCategory ? 'Import Shared Category' : 'Import Shared Link'}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Found via QR Code scan · Save to your local and cloud vault
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-import-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#111B2E] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin bg-white dark:bg-[#0D1422]">
          {isCategory && payload.type === 'category' ? (
            <>
              {/* Category card preview */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111B2E]/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                    style={{ backgroundColor: payload.category.color }}
                  >
                    <CategoryIcon name={payload.category.icon} color="#ffffff" className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-[#0F172A] dark:text-[#F1F5F9] text-base truncate">
                      {payload.category.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {categoryLinks.length} {categoryLinks.length === 1 ? 'link' : 'links'} ready to save
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-cyan-300 shrink-0 border border-blue-200 dark:border-blue-900/60">
                  Shared Category
                </span>
              </div>

              {/* Privacy Setting Preservation (Crucial User Requirement) */}
              <div
                id="import-privacy-box"
                className={`p-3.5 rounded-2xl border transition-colors flex items-start justify-between gap-3 ${
                  hideFromAll
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 text-slate-900 dark:text-slate-100'
                    : 'bg-slate-50 dark:bg-[#111B2E]/30 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      hideFromAll ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block">
                      Private Category (Hide from &quot;All Links&quot;)
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {payload.category.hideFromAll
                        ? 'This category was set to Private on the sharing device. It will remain private and hidden from your All Links page.'
                        : 'Keep these links visible exclusively inside this category tab.'}
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    id="import-toggle-hide-all"
                    checked={hideFromAll}
                    onChange={(e) => setHideFromAll(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Links list to be imported */}
              <div className="space-y-2">
                {categoryLinks.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-1">
                      <span>Links to Import ({selectedIndices.length} of {categoryLinks.length})</span>
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 font-medium cursor-pointer"
                      >
                        {selectedIndices.length === categoryLinks.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                      {categoryLinks.map((linkItem, idx) => {
                        const isSelected = selectedIndices.includes(idx);
                        const domain = extractHostname(linkItem.url);
                        const favicon = linkItem.faviconUrl || getFaviconUrl(linkItem.url);

                        return (
                          <div
                            key={idx}
                            onClick={() => toggleIndex(idx)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-white dark:bg-[#111B2E] border-blue-200 dark:border-blue-900/60 shadow-2xs'
                                : 'bg-slate-50/60 dark:bg-[#070B14]/40 border-slate-200 dark:border-slate-800 opacity-60'
                            }`}
                          >
                            <div className="text-blue-600 dark:text-cyan-400 shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                              )}
                            </div>

                            <div className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0">
                              <img
                                src={favicon}
                                alt=""
                                className="w-3.5 h-3.5 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                                {linkItem.title}
                              </h5>
                              <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                {domain}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#111B2E]/40 border border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                    This shared category does not contain any links. You can still save the folder structure to your vault.
                  </div>
                )}
              </div>
            </>
          ) : payload.type === 'link' ? (
            <>
              {/* Single Link Preview */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111B2E]/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 flex items-center justify-center shrink-0 shadow-2xs">
                    <img
                      src={payload.link.faviconUrl || getFaviconUrl(payload.link.url)}
                      alt=""
                      className="w-5 h-5 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-[#0F172A] dark:text-[#F1F5F9] text-sm truncate">
                      {payload.link.title}
                    </h4>
                    <p className="font-mono text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {payload.link.url}
                    </p>
                  </div>
                </div>

                {payload.link.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 pl-12 line-clamp-2">
                    {payload.link.description}
                  </p>
                )}
              </div>

              {/* Choose destination category */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Save to Category:
                </label>
                <select
                  value={targetCategorySlug}
                  onChange={(e) => setTargetCategorySlug(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-[#070B14] focus:outline-hidden focus:border-blue-600 dark:focus:border-cyan-400"
                >
                  {existingCategories.map((c) => (
                    <option key={c.slug} value={c.slug} className="bg-white dark:bg-[#0D1422] text-slate-900 dark:text-slate-100">
                      {c.name} {c.hideFromAll ? '(Private)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-[#111B2E]/60 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-[#111B2E] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            id="confirm-import-shared-btn"
            onClick={handleConfirmImport}
            disabled={isCategory && categoryLinks.length > 0 && selectedIndices.length === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>
              {isCategory
                ? categoryLinks.length > 0
                  ? `Save All (${selectedIndices.length}) to My Vault`
                  : 'Save Category Folder'
                : 'Save to My Vault'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
