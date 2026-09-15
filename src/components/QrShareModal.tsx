import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  QrCode,
  Copy,
  Check,
  Download,
  Share2,
  EyeOff,
  ExternalLink,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { Category, SavedLink, QrSharePayload } from '../types';
import { CategoryIcon } from './CategoryIcon';
import {
  generateCategoryQrPayload,
  generateLinkQrPayload,
  generateShareUrl,
  encodeShareDataAsync,
  generateQrDataUrl,
  downloadQrCode,
  isLinkInCategory,
  createCloudShareBundle,
} from '../utils/qrHelper';

interface QrShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Either share a category + links OR an individual link
  category?: Category | null;
  categoryLinks?: SavedLink[];
  links?: SavedLink[];
  singleLink?: SavedLink | null;
  link?: SavedLink | null;
}

export const QrShareModal: React.FC<QrShareModalProps> = ({
  isOpen,
  onClose,
  category,
  categoryLinks: propCategoryLinks,
  links = [],
  singleLink,
  link: propLink,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [quickCode, setQuickCode] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLinksPreview, setShowLinksPreview] = useState<boolean>(false);

  const activeLink = propLink || singleLink || null;
  const isCategory = Boolean(category && !activeLink);

  // Compute category links: find all matching links from links array or propCategoryLinks
  const resolvedCategoryLinks = useMemo(() => {
    if (!isCategory || !category) return [];
    // 1. Gather all links from global links that match this category
    const matchedFromGlobal = links.filter((l) => isLinkInCategory(l.categorySlug, category));
    if (matchedFromGlobal.length > 0) {
      return matchedFromGlobal;
    }
    // 2. Fallback to passed propCategoryLinks if provided
    if (propCategoryLinks && propCategoryLinks.length > 0) {
      return propCategoryLinks;
    }
    return [];
  }, [isCategory, category, propCategoryLinks, links]);

  const isPrivate = Boolean(category?.hideFromAll);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    // CRITICAL: Immediately clear stale QR code, link, and quick code so previous category state is NEVER replicated
    setQrDataUrl('');
    setShareUrl('');
    setQuickCode('');
    setIsLoading(true);
    setErrorMessage(null);

    async function generate() {
      try {
        let payload: QrSharePayload | null = null;
        if (isCategory && category) {
          payload = generateCategoryQrPayload(category, resolvedCategoryLinks);
        } else if (activeLink) {
          payload = generateLinkQrPayload(activeLink, category || undefined);
        }

        if (!payload) {
          if (isMounted) {
            setIsLoading(false);
            setErrorMessage('No category or link selected to share.');
          }
          return;
        }

        // 1. Try creating cloud share bundle for ultra-short, never-truncated URL + 6-digit Quick Code
        try {
          const cloudResult = await createCloudShareBundle(payload);
          if (!isMounted) return;
          setShareUrl(cloudResult.shareUrl);
          setQuickCode(cloudResult.shortCode);

          // Instant high-res QR code generation (short URL will never fail)
          const dataUrl = await generateQrDataUrl(cloudResult.shareUrl);
          if (!isMounted) return;
          setQrDataUrl(dataUrl);
          setIsLoading(false);
        } catch (cloudErr) {
          console.warn('Cloud share bundle upload fallback:', cloudErr);
          // Fallback: local compact encoding
          const token = await encodeShareDataAsync(payload);
          const url = generateShareUrl(payload, token);
          if (!isMounted) return;
          setShareUrl(url);

          const dataUrl = await generateQrDataUrl(url);
          if (!isMounted) return;
          setQrDataUrl(dataUrl);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('QR code generation failed:', err);
        if (!isMounted) return;
        setIsLoading(false);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Failed to generate QR code. You can still use the Copy Link button below.'
        );
      }
    }

    generate();

    return () => {
      isMounted = false;
    };
  }, [isOpen, category?.id, category?.slug, category?.name, activeLink?.id, activeLink?.url, resolvedCategoryLinks.length, isCategory]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!quickCode) return;
    navigator.clipboard.writeText(quickCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const filename = isCategory
      ? `link-vault-category-${category?.slug || 'share'}.png`
      : `link-vault-link.png`;
    downloadQrCode(qrDataUrl, filename);
  };

  return (
    <div
      id="qr-share-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="qr-share-modal-dialog"
        className="w-full max-w-md bg-white dark:bg-[#0D1422] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111B2E]/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 flex items-center justify-center shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] text-sm sm:text-base">
                {isCategory ? 'Share Category via QR' : 'Share Link via QR'}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {isCategory
                  ? 'Transfer this entire category with all links'
                  : 'Instantly beam this link to another device'}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-qr-share-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#111B2E] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 flex flex-col items-center text-center space-y-4 bg-white dark:bg-[#0D1422]">
          {/* Information summary badge */}
          {isCategory && category && (
            <div className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-[#111B2E]/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: category.color }}
                >
                  <CategoryIcon name={category.icon} color="#ffffff" className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm truncate flex items-center gap-1.5">
                    <span>{category.name}</span>
                    {isPrivate && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-cyan-300 font-semibold border border-blue-200 dark:border-blue-900/60">
                        <EyeOff className="w-2.5 h-2.5" /> Private
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      {resolvedCategoryLinks.length}{' '}
                      {resolvedCategoryLinks.length === 1 ? 'link' : 'links'} ready to beam
                    </span>
                    {resolvedCategoryLinks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowLinksPreview(!showLinksPreview)}
                        className="text-[11px] text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        {showLinksPreview ? 'Hide' : 'Preview'}
                        {showLinksPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md shrink-0">
                Auto-Save Ready
              </span>
            </div>
          )}

          {/* Expandable list of links being shared */}
          {isCategory && showLinksPreview && resolvedCategoryLinks.length > 0 && (
            <div className="w-full max-h-36 overflow-y-auto space-y-1 p-2 rounded-xl bg-slate-100/70 dark:bg-[#111B2E]/90 border border-slate-200 dark:border-slate-800 text-left">
              {resolvedCategoryLinks.map((l, idx) => (
                <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-[#0D1422] text-xs">
                  <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1 truncate">
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{l.title || l.url}</p>
                    <p className="text-[10px] text-slate-400 truncate">{l.url}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Zero links warning if category is empty */}
          {isCategory && resolvedCategoryLinks.length === 0 && (
            <div className="w-full flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-left text-amber-900 dark:text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-snug">
                <strong>Empty Category:</strong> There are no saved links in &ldquo;{category?.name}&rdquo; yet. The recipient will only receive the folder structure. Add links to this category if you want to share your bookmarks.
              </p>
            </div>
          )}

          {!isCategory && activeLink && (
            <div className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-[#111B2E]/50 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3 text-left min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
                <Share2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm truncate">{activeLink.title}</h4>
                <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{activeLink.url}</p>
              </div>
            </div>
          )}

          {/* Privacy preservation notice */}
          {isPrivate && (
            <div className="w-full flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-left text-amber-900 dark:text-amber-300 text-xs">
              <EyeOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-snug">
                <strong>Privacy Preserved:</strong> When scanned by another user of this app, this category will automatically be saved as <strong>Private</strong> (hidden from their All Links page).
              </p>
            </div>
          )}

          {/* Quick Share Code Banner */}
          {quickCode && (
            <div className="w-full p-2.5 rounded-xl bg-gradient-to-r from-blue-50 dark:from-blue-950/40 via-cyan-50 dark:via-cyan-950/30 to-blue-50 dark:to-blue-950/40 border border-blue-200 dark:border-cyan-900/60 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-600/10 dark:bg-cyan-400/10 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Quick Code
                  </div>
                  <div className="font-mono font-bold text-sm tracking-widest text-blue-700 dark:text-cyan-300">
                    {quickCode.slice(0, 3)} {quickCode.slice(3)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                id="copy-quick-code-btn"
                onClick={handleCopyCode}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 dark:bg-cyan-500 hover:bg-blue-700 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-bold text-[11px] transition-colors cursor-pointer shrink-0"
              >
                {copiedCode ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          )}

          {/* QR Code Display Card */}
          <div className="p-4 bg-white rounded-2xl border-2 border-slate-200/90 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center min-h-[240px] w-full max-w-[260px]">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 text-slate-400 py-10">
                <div className="w-8 h-8 border-3 border-blue-600 dark:border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Generating high-res QR code...</span>
              </div>
            ) : qrDataUrl ? (
              <div className="relative group">
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-56 h-56 object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="p-3 text-center">
                <p className="text-xs font-semibold text-rose-500">Failed to generate QR code.</p>
                {errorMessage && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[220px]">
                    {errorMessage}
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
            Scan this QR code using a phone camera or the <strong>Scan QR</strong> button in this app to save automatically.
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
            <button
              type="button"
              id="copy-share-url-btn"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#070B14] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all shadow-2xs cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="download-qr-image-btn"
              onClick={handleDownloadQr}
              disabled={!qrDataUrl}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
