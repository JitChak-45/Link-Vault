import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Link as LinkIcon,
  Sparkles,
  Star,
  Tag as TagIcon,
  Check,
  Folder,
  Globe,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  ExternalLink,
  CheckCircle2,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { Category, SavedLink } from '../types';
import { CategoryIcon } from './CategoryIcon';
import {
  normalizeUrl,
  extractHostname,
  getFaviconUrl,
  guessCategory,
  generateTitleFromUrl,
  getDefaultThumbnailUrl,
  isSameUrl,
} from '../utils/urlHelper';
import { isLinkInCategory } from '../utils/qrHelper';
import { fetchLinkMetadata, extractQuickMetadata } from '../utils/fetchMetadata';

interface AddEditLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    linkData: Omit<SavedLink, 'id' | 'createdAt' | 'updatedAt' | 'clickCount'>
  ) => Promise<void>;
  editingLink?: SavedLink | null;
  categories: Category[];
  initialCategorySlug?: string;
  existingLinks?: SavedLink[];
}

export const AddEditLinkModal: React.FC<AddEditLinkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingLink,
  categories,
  initialCategorySlug,
  existingLinks,
}) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [categorySlug, setCategorySlug] = useState('entertainment');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);

  // Active target category object
  const targetCategoryObj = useMemo(() => {
    return (
      categories.find((c) => c.slug === categorySlug) || {
        slug: categorySlug,
        name: categorySlug,
      }
    );
  }, [categories, categorySlug]);

  // Check if link already exists in the currently selected category
  const duplicateInCurrentCategory = useMemo(() => {
    if (!url || !url.trim() || !existingLinks) return null;
    return (
      existingLinks.find(
        (l) =>
          (!editingLink || l.id !== editingLink.id) &&
          isLinkInCategory(l.categorySlug, targetCategoryObj) &&
          isSameUrl(l.url, url)
      ) || null
    );
  }, [url, targetCategoryObj, existingLinks, editingLink]);

  // Check if link exists in other categories (to explicitly inform user that cross-category save is allowed)
  const existingInOtherCategories = useMemo(() => {
    if (!url || !url.trim() || !existingLinks) return [];
    return existingLinks.filter(
      (l) =>
        (!editingLink || l.id !== editingLink.id) &&
        !isLinkInCategory(l.categorySlug, targetCategoryObj) &&
        isSameUrl(l.url, url)
    );
  }, [url, targetCategoryObj, existingLinks, editingLink]);

  // OpenGraph Thumbnail & Favicon states
  const [imageUrl, setImageUrl] = useState<string>('');
  const [faviconUrl, setFaviconUrl] = useState<string>('');
  const [isFetchingMeta, setIsFetchingMeta] = useState<boolean>(false);
  const [metaFetchStatus, setMetaFetchStatus] = useState<
    'idle' | 'loading' | 'success' | 'none' | 'error'
  >('idle');
  const [showCustomImageInput, setShowCustomImageInput] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchedUrlRef = useRef<string>('');

  // Fetch OpenGraph metadata function
  const runFetchMetadata = useCallback(
    async (targetUrl: string, autoFillText = true) => {
      const normalized = normalizeUrl(targetUrl);
      if (!normalized || normalized.length < 8) return;

      lastFetchedUrlRef.current = normalized;
      setIsFetchingMeta(true);
      setMetaFetchStatus('loading');
      setImageError(false);

      // 1. Instant optimistic metadata for fast platforms and fallback preview
      const quick = extractQuickMetadata(normalized);
      const fallbackThumb = quick.imageUrl || getDefaultThumbnailUrl(normalized);
      if (fallbackThumb) {
        setImageUrl(fallbackThumb);
      }
      if (quick.faviconUrl) {
        setFaviconUrl(quick.faviconUrl);
      }

      try {
        const meta = await fetchLinkMetadata(normalized);

        if (meta.imageUrl) {
          setImageUrl(meta.imageUrl);
          setMetaFetchStatus('success');
        } else if (fallbackThumb) {
          setImageUrl(fallbackThumb);
          setMetaFetchStatus('success');
        } else {
          setMetaFetchStatus('none');
        }

        if (meta.faviconUrl) {
          setFaviconUrl(meta.faviconUrl);
        }

        // Auto-fill title if currently empty or matches plain host
        if (autoFillText && meta.title) {
          setTitle((curr) => (!curr || curr === extractHostname(normalized) ? meta.title! : curr));
        }

        // Auto-fill description if currently empty
        if (autoFillText && meta.description) {
          setDescription((curr) => (!curr ? meta.description! : curr));
        }
      } catch (err) {
        console.warn('Metadata fetch error:', err);
        setMetaFetchStatus('none');
      } finally {
        setIsFetchingMeta(false);
      }
    },
    []
  );

  useEffect(() => {
    if (editingLink) {
      setUrl(editingLink.url);
      setTitle(editingLink.title);
      setCategorySlug(editingLink.categorySlug);
      setDescription(editingLink.description || '');
      setTags(editingLink.tags || []);
      setIsFavorite(editingLink.isFavorite || false);
      setImageUrl(editingLink.imageUrl || '');
      setFaviconUrl(editingLink.faviconUrl || '');
      setSuggestedCategory(null);
      setMetaFetchStatus(editingLink.imageUrl ? 'success' : 'idle');
      setShowCustomImageInput(false);
      setImageError(false);
      lastFetchedUrlRef.current = editingLink.url;
    } else {
      setUrl('');
      setTitle('');
      setCategorySlug(initialCategorySlug || categories[0]?.slug || 'entertainment');
      setDescription('');
      setTags([]);
      setIsFavorite(false);
      setImageUrl('');
      setFaviconUrl('');
      setSuggestedCategory(null);
      setMetaFetchStatus('idle');
      setShowCustomImageInput(false);
      setImageError(false);
      lastFetchedUrlRef.current = '';
    }
    setError(null);
  }, [editingLink, isOpen, initialCategorySlug, categories]);

  // Debounced auto-fetch when URL is typed or pasted
  const handleUrlChange = (value: string) => {
    setUrl(value);
    setError(null);
    setImageError(false);

    // If title is currently empty, autofill candidate
    if (!title && value.trim().length > 4) {
      const generated = generateTitleFromUrl(value);
      if (generated && generated !== value) {
        setTitle(generated);
      }
    }

    // Guess category
    const guessed = guessCategory(value);
    if (guessed && categories.some((c) => c.slug === guessed)) {
      setSuggestedCategory(guessed);
    } else {
      setSuggestedCategory(null);
    }

    // Trigger auto-fetch with debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = value.trim();
    if (trimmed.length > 7 && (trimmed.startsWith('http') || trimmed.includes('.'))) {
      debounceTimerRef.current = setTimeout(() => {
        runFetchMetadata(trimmed, !title);
      }, 650);
    }
  };

  const handleManualRefreshMeta = () => {
    if (url.trim()) {
      runFetchMetadata(url.trim(), false);
    }
  };

  const handleApplySuggestedCategory = () => {
    if (suggestedCategory) {
      setCategorySlug(suggestedCategory);
      setSuggestedCategory(null);
    }
  };

  const handleAutoTitle = () => {
    if (!url.trim()) return;
    const generated = generateTitleFromUrl(url);
    setTitle(generated);
  };

  const handleAddTag = () => {
    const cleanTag = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanTag && !tags.includes(cleanTag)) {
      setTags([...tags, cleanTag]);
      setTagInput('');
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUrl = normalizeUrl(url);
    if (!finalUrl) {
      setError('Please provide a valid link URL.');
      return;
    }

    if (duplicateInCurrentCategory) {
      setError(
        `This link is already saved in the "${targetCategoryObj.name}" category. Duplicate entries in the same category are not allowed, but you can save it into a different category.`
      );
      return;
    }

    const finalTitle =
      title.trim() || generateTitleFromUrl(finalUrl) || extractHostname(finalUrl);

    try {
      setIsSaving(true);
      setError(null);
      await onSave({
        url: finalUrl,
        title: finalTitle,
        categorySlug,
        description: description.trim(),
        tags,
        isFavorite,
        imageUrl: imageUrl.trim() || undefined,
        faviconUrl: faviconUrl.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save link');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const domainPreview = url ? extractHostname(url) : null;
  const currentFavicon = faviconUrl || (url ? getFaviconUrl(url) : null);

  return (
    <div
      id="link-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        id="link-modal-container"
        className="bg-white dark:bg-[#0D1422] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#111B2E]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/40">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk']">
                {editingLink ? 'Edit Saved Link' : 'Save Important Link'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auto-retrieves OpenGraph thumbnail and favicon
              </p>
            </div>
          </div>
          <button
            id="close-link-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111B2E] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 bg-white dark:bg-[#0D1422]">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* URL Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="link-url-input"
                className="text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Destination URL <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                {domainPreview && (
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    {domainPreview}
                  </span>
                )}
                {url.trim().length > 7 && (
                  <button
                    type="button"
                    id="refetch-og-btn"
                    onClick={handleManualRefreshMeta}
                    disabled={isFetchingMeta}
                    className="text-[11px] text-blue-600 dark:text-cyan-400 hover:text-blue-800 dark:hover:text-cyan-300 font-medium inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    title="Re-fetch OpenGraph thumbnail and favicon"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isFetchingMeta ? 'animate-spin' : ''}`}
                    />
                    <span>{isFetchingMeta ? 'Fetching...' : 'Refetch'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center pointer-events-none">
                {currentFavicon && url.length > 5 ? (
                  <img
                    src={currentFavicon}
                    alt=""
                    className="w-4 h-4 rounded-xs object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Globe className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                )}
              </div>
              <input
                id="link-url-input"
                type="text"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                required
                autoFocus={!editingLink}
                className={`w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:outline-hidden focus:ring-2 transition-all text-[#0F172A] dark:text-[#F1F5F9] bg-white dark:bg-[#070B14] placeholder-slate-400 dark:placeholder-slate-500 ${
                  duplicateInCurrentCategory
                    ? 'border-amber-400 dark:border-amber-600 focus:ring-amber-500/20 focus:border-amber-500'
                    : 'border-slate-300 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400'
                }`}
              />
            </div>

            {/* Duplicate link in same category alert */}
            {duplicateInCurrentCategory && (
              <div
                id="duplicate-link-warning"
                className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1.5 animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Already saved in "{targetCategoryObj.name}"</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  This destination is already saved in{' '}
                  <strong className="font-semibold text-amber-950 dark:text-amber-100">
                    {targetCategoryObj.name}
                  </strong>{' '}
                  as{' '}
                  <strong className="font-semibold text-amber-950 dark:text-amber-100">
                    "{duplicateInCurrentCategory.title}"
                  </strong>
                  . Duplicate entries in the same category are not permitted.
                </p>
                <div className="text-[11px] text-amber-700/90 dark:text-amber-300/90 flex items-center gap-1.5 pt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    Tip: You can select a different category below to save this link there.
                  </span>
                </div>
              </div>
            )}

            {/* Cross-category allowed info notice */}
            {!duplicateInCurrentCategory && existingInOtherCategories.length > 0 && (
              <div
                id="cross-category-allowed-notice"
                className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center gap-2 animate-in fade-in duration-200"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  This link is already in{' '}
                  <strong className="font-semibold">
                    {existingInOtherCategories
                      .map(
                        (l) =>
                          categories.find((c) => isLinkInCategory(l.categorySlug, c))?.name ||
                          l.categorySlug
                      )
                      .join(', ')}
                  </strong>
                  . Adding it to <strong className="font-semibold">{targetCategoryObj.name}</strong> is allowed!
                </span>
              </div>
            )}

            {/* Smart Category suggestion badge */}
            {suggestedCategory && suggestedCategory !== categorySlug && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Auto-detected category:{' '}
                  <strong>
                    {categories.find((c) => c.slug === suggestedCategory)?.name}
                  </strong>
                </span>
                <button
                  type="button"
                  id="accept-suggested-category-btn"
                  onClick={handleApplySuggestedCategory}
                  className="px-2 py-0.5 text-[11px] bg-amber-200/70 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-900 dark:text-amber-200 text-amber-900 rounded font-medium transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* OpenGraph Thumbnail & Favicon Preview Section */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111B2E]/40 p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>OpenGraph Preview & Media</span>
              </span>

              {isFetchingMeta ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-cyan-400 font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Fetching metadata...</span>
                </span>
              ) : imageUrl && !imageError ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Thumbnail detected</span>
                </span>
              ) : url.length > 7 ? (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {metaFetchStatus === 'none' ? 'No OG image found' : 'Ready'}
                </span>
              ) : null}
            </div>

            {/* Thumbnail Display / Shimmer Loader */}
            {isFetchingMeta ? (
              <div className="w-full h-32 rounded-lg bg-slate-200/70 dark:bg-slate-800/70 animate-pulse flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-500 dark:text-cyan-400" />
                <span className="font-medium">Retrieving OpenGraph thumbnail & favicon...</span>
              </div>
            ) : imageUrl && !imageError ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900/5 group">
                <img
                  src={imageUrl}
                  alt="OpenGraph Thumbnail"
                  referrerPolicy="no-referrer"
                  className="w-full h-36 sm:h-40 object-cover rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
                  onError={() => setImageError(true)}
                />

                {/* Overlay Action Bar */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-between p-2.5 opacity-90 transition-opacity">
                  <div className="flex items-center gap-1.5">
                    {currentFavicon && (
                      <div className="w-5 h-5 rounded-sm bg-white/90 p-0.5 flex items-center justify-center shadow-xs">
                        <img
                          src={currentFavicon}
                          alt=""
                          className="w-3.5 h-3.5 object-contain"
                        />
                      </div>
                    )}
                    <span className="text-[11px] font-medium text-white drop-shadow-xs truncate max-w-[200px]">
                      {domainPreview || 'OpenGraph Thumbnail'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      id="remove-thumbnail-btn"
                      onClick={() => setImageUrl('')}
                      className="px-2 py-1 bg-black/60 hover:bg-rose-600 text-white rounded-md text-[10px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      title="Remove thumbnail"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                    <button
                      type="button"
                      id="change-thumbnail-btn"
                      onClick={() => setShowCustomImageInput(!showCustomImageInput)}
                      className="px-2 py-1 bg-white/90 hover:bg-white text-slate-800 rounded-md text-[10px] font-semibold transition-colors cursor-pointer"
                    >
                      Change URL
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-[#070B14] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#111B2E] flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0">
                    {currentFavicon && url.length > 5 ? (
                      <img
                        src={currentFavicon}
                        alt=""
                        className="w-4 h-4 object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {url.length > 7
                        ? 'No banner image found on page'
                        : 'Enter a URL to preview thumbnail'}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      Favicon and link metadata are automatically captured.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  id="toggle-custom-image-btn"
                  onClick={() => setShowCustomImageInput(!showCustomImageInput)}
                  className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:text-blue-800 dark:hover:text-cyan-300 shrink-0 cursor-pointer"
                >
                  {showCustomImageInput ? 'Hide' : '+ Add Image URL'}
                </button>
              </div>
            )}

            {/* Custom Image URL Field */}
            {showCustomImageInput && (
              <div className="pt-1.5 space-y-1">
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
                  Custom Image / Thumbnail URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://example.com/cover.jpg"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setImageError(false);
                    }}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 text-slate-800 dark:text-slate-100 bg-white dark:bg-[#070B14]"
                  />
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-[#111B2E] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="link-title-input"
                className="text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Title / Label
              </label>
              {url.trim().length > 4 && (
                <button
                  type="button"
                  id="auto-title-btn"
                  onClick={handleAutoTitle}
                  className="text-[11px] text-blue-600 dark:text-cyan-400 hover:text-blue-800 dark:hover:text-cyan-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto-format</span>
                </button>
              )}
            </div>
            <input
              id="link-title-input"
              type="text"
              placeholder="e.g. Next.js Documentation or Sci-Fi Movie List"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all text-[#0F172A] dark:text-[#F1F5F9] bg-white dark:bg-[#070B14] placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Category</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((cat) => {
                const isSelected = categorySlug === cat.slug;
                const isLinkInThisCat =
                  url.trim().length > 4 &&
                  existingLinks?.some(
                    (l) =>
                      (!editingLink || l.id !== editingLink.id) &&
                      isLinkInCategory(l.categorySlug, cat) &&
                      isSameUrl(l.url, url)
                  );

                return (
                  <button
                    key={cat.slug}
                    type="button"
                    id={`select-category-${cat.slug}-btn`}
                    onClick={() => setCategorySlug(cat.slug)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? isLinkInThisCat
                          ? 'border-amber-500 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 shadow-xs ring-1 ring-amber-400 dark:ring-amber-500'
                          : 'border-blue-600 dark:border-cyan-400 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-cyan-200 shadow-xs ring-1 ring-blue-500 dark:ring-cyan-400'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#111B2E] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cat.color}18` }}
                    >
                      <CategoryIcon
                        name={cat.icon}
                        color={cat.color}
                        className="w-3.5 h-3.5"
                      />
                    </div>
                    <span className="truncate flex-1">{cat.name}</span>
                    {isLinkInThisCat && (
                      <span
                        className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-800/80 px-1 py-0.5 rounded-sm shrink-0"
                        title="Link already saved in this category"
                      >
                        Saved
                      </span>
                    )}
                    {cat.hideFromAll && (
                      <EyeOff className="w-3 h-3 text-slate-400 shrink-0" title="Private category (hidden from All Links)" />
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            {categories.find((c) => c.slug === categorySlug)?.hideFromAll && (
              <p className="text-[11px] text-blue-600 dark:text-cyan-400 flex items-center gap-1.5 mt-1">
                <EyeOff className="w-3 h-3" />
                <span>This category is private — link will be hidden from the "All Links" page and only visible in this category.</span>
              </p>
            )}
          </div>

          {/* Description / Notes */}
          <div className="space-y-1.5">
            <label
              htmlFor="link-desc-input"
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Personal Notes / Why it is important (optional)</span>
            </label>
            <textarea
              id="link-desc-input"
              rows={2}
              placeholder="e.g. Chapter 4 reference, bookmarked for thesis project, or weekend watch..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all text-[#0F172A] dark:text-[#F1F5F9] bg-white dark:bg-[#070B14] placeholder-slate-400 dark:placeholder-slate-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label
              htmlFor="link-tags-input"
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
            >
              <TagIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Tags (type and press Enter)</span>
            </label>
            <div className="flex gap-2">
              <input
                id="link-tags-input"
                type="text"
                placeholder="e.g. tutorial, python, design"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all text-[#0F172A] dark:text-[#F1F5F9] bg-white dark:bg-[#070B14]"
              />
              <button
                type="button"
                id="add-tag-chip-btn"
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-slate-100 dark:bg-[#111B2E] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-rose-600 ml-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Favorite toggle */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <label
              htmlFor="favorite-link-checkbox"
              className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              <input
                id="favorite-link-checkbox"
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <Star
                  className={`w-4 h-4 ${
                    isFavorite ? 'text-amber-500 fill-amber-500' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                Mark as Starred / Priority
              </span>
            </label>
          </div>

          {/* Modal Footer actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2">
            <button
              type="button"
              id="cancel-link-btn"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#111B2E] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-link-btn"
              disabled={isSaving || !!duplicateInCurrentCategory}
              title={
                duplicateInCurrentCategory
                  ? `This link is already saved in "${targetCategoryObj.name}". Please select another category to save.`
                  : undefined
              }
              className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Vault...</span>
                </>
              ) : editingLink ? (
                'Save Changes'
              ) : (
                'Save Link'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
