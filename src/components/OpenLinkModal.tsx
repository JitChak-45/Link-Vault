import React, { useState } from 'react';
import {
  ExternalLink,
  Shield,
  Copy,
  Check,
  X,
  Lock,
  EyeOff,
  Share2,
  Smartphone,
  Info,
  ChevronRight,
} from 'lucide-react';
import { SavedLink, Category } from '../types';
import { extractHostname, getFaviconUrl, normalizeUrl } from '../utils/urlHelper';

interface OpenLinkModalProps {
  isOpen: boolean;
  link: SavedLink | null;
  category?: Category;
  onClose: () => void;
  onOpenNormal?: (link: SavedLink) => void;
  onLinkOpened?: (link: SavedLink) => void;
}

export const OpenLinkModal: React.FC<OpenLinkModalProps> = ({
  isOpen,
  link,
  category,
  onClose,
  onOpenNormal,
  onLinkOpened,
}) => {
  const [copiedForIncognito, setCopiedForIncognito] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen || !link) return null;

  const targetUrl = normalizeUrl(link.url);
  const domain = extractHostname(link.url);
  const favicon = link.faviconUrl || getFaviconUrl(link.url);

  const isMobile =
    typeof window !== 'undefined' &&
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 0 && window.innerWidth <= 768));
  const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);
  const isIOS = typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const recordOpen = () => {
    if (typeof onOpenNormal === 'function') onOpenNormal(link);
    if (typeof onLinkOpened === 'function') onLinkOpened(link);
  };

  const handleOpenNormal = () => {
    recordOpen();
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
    onClose();
  };

  const handleCopyForIncognito = () => {
    recordOpen();
    try {
      navigator.clipboard.writeText(targetUrl);
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(40);
      }
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
    setCopiedForIncognito(true);
  };

  const handleShareToBrowser = async () => {
    recordOpen();
    if (canShare) {
      try {
        await navigator.share({
          title: link.title,
          url: targetUrl,
        });
      } catch (err) {
        console.log('Share dismissed:', err);
      }
    }
  };

  const handleCopyOnly = () => {
    navigator.clipboard.writeText(targetUrl);
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(30);
    }
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div
      id="open-link-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="open-link-modal-dialog"
        className="w-full max-w-md bg-white dark:bg-[#0D1422] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111B2E]/60 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#070B14] border border-slate-200/80 dark:border-slate-700/80 p-2 flex items-center justify-center shrink-0 shadow-2xs">
              <img
                src={favicon}
                alt=""
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] text-sm sm:text-base leading-snug truncate">
                {link.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500 truncate">{domain}</span>
                {category?.hideFromAll && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300 font-semibold border border-blue-200 dark:border-blue-900/60">
                    <EyeOff className="w-2.5 h-2.5" /> Private Category
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            id="close-open-link-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Scrollable if needed */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-white dark:bg-[#0D1422]">
          {/* Option 1: Standard Normal Tab */}
          <a
            id="open-normal-tab-btn"
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              recordOpen();
              onClose();
            }}
            className="group flex items-start gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-600 dark:hover:border-cyan-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-left transition-all cursor-pointer touch-manipulation active:scale-[0.99]"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform mt-0.5">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-cyan-300">
                  Open in Standard Tab
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Opens directly in a standard new browser tab.
              </p>
            </div>
          </a>

          {/* Section Divider: Incognito / Private Launch */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Incognito / Private Window</span>
              </div>
              {isMobile && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 font-semibold border border-cyan-300 dark:border-cyan-800">
                  <Smartphone className="w-3 h-3" /> Phone Mode
                </span>
              )}
            </div>

            {/* If on Mobile Phone: The Native Touch & Hold Launcher */}
            {isMobile ? (
              <div className="space-y-3">
                {/* Method 1: The Native Real Anchor (Mobile Chrome / Safari / Samsung) */}
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    // Left tap on phone copies URL and highlights steps
                    handleCopyForIncognito();
                  }}
                  className="group block p-3.5 rounded-xl border-2 border-dashed border-cyan-500/60 dark:border-cyan-400/50 bg-gradient-to-br from-cyan-50/70 via-blue-50/30 to-slate-50 dark:from-[#111B2E] dark:via-[#0D1829] dark:to-[#070B14] text-left transition-all active:scale-[0.98] cursor-pointer shadow-xs"
                  title="Touch and hold to open in incognito"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-xs mt-0.5">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                          <span>Touch & Hold (Long-Press) Here</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                          {isAndroid ? (
                            <>
                              Press & hold your finger for 1 second, then choose{' '}
                              <strong className="text-cyan-700 dark:text-cyan-300 underline font-semibold">
                                "Open in incognito tab"
                              </strong>
                              .
                            </>
                          ) : isIOS ? (
                            <>
                              Press & hold your finger for 1 second, then tap{' '}
                              <strong className="text-cyan-700 dark:text-cyan-300 underline font-semibold">
                                "Open in New Tab" / Private
                              </strong>
                              .
                            </>
                          ) : (
                            <>Press & hold your finger to trigger your browser's private tab menu.</>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded bg-cyan-500 text-slate-950 uppercase tracking-wider shadow-2xs">
                      Hold 1s
                    </span>
                  </div>
                </a>

                {/* Method 2 & 3 Mobile Actions: Share to Private Browser & Copy Link */}
                <div className="grid grid-cols-2 gap-2">
                  {canShare && (
                    <button
                      type="button"
                      onClick={handleShareToBrowser}
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111B2E] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold active:scale-95 transition-all touch-manipulation min-h-[44px]"
                    >
                      <Share2 className="w-3.5 h-3.5 text-blue-500" />
                      <span className="truncate">Share to Browser</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyForIncognito}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold active:scale-95 transition-all touch-manipulation min-h-[44px] ${
                      copiedForIncognito
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111B2E] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    } ${!canShare ? 'col-span-2' : ''}`}
                  >
                    {copiedForIncognito ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>URL Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-cyan-500" />
                        <span>Copy Link & Open</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Step-by-Step Mobile Instructions */}
                {copiedForIncognito && (
                  <div className="p-3 bg-slate-900 text-white rounded-xl text-xs space-y-2 border border-slate-800 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>URL copied to clipboard!</span>
                    </div>
                    <div className="text-[11px] text-slate-300 space-y-1">
                      {isAndroid ? (
                        <>
                          <p className="font-semibold text-cyan-300">How to open in Android Chrome Incognito:</p>
                          <ol className="list-decimal list-inside space-y-0.5 text-slate-300">
                            <li>Tap the 3 dots menu (⋮) at the top-right of Chrome.</li>
                            <li>Tap <strong>"New incognito tab"</strong>.</li>
                            <li>Tap the address bar, paste the copied link, and hit enter.</li>
                          </ol>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-cyan-300">How to open in Safari Private:</p>
                          <ol className="list-decimal list-inside space-y-0.5 text-slate-300">
                            <li>Tap the tabs icon (⧉) at the bottom right.</li>
                            <li>Tap <strong>"Private"</strong> to switch to Private mode.</li>
                            <li>Tap <strong>+</strong>, paste the link in the address bar.</li>
                          </ol>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Desktop experience */
              <div className="space-y-3">
                <a
                  id="open-incognito-tab-btn"
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    handleCopyForIncognito();
                  }}
                  className="group flex items-start gap-3.5 p-3.5 rounded-xl border-2 border-slate-800 dark:border-cyan-500/30 bg-slate-900/[0.02] dark:bg-[#111B2E]/40 hover:bg-slate-900/[0.05] dark:hover:bg-[#111B2E]/80 text-left transition-all cursor-pointer relative"
                  title="Right-click and select 'Open link in incognito window'"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                        <span>Incognito / Private Window</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold uppercase tracking-wider">
                          Right-Click
                        </span>
                      </span>
                      <Lock className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      <strong>Fastest:</strong> Right-click this card & click <em>"Open link in incognito window"</em>.
                      <br />
                      <span className="text-slate-500 dark:text-slate-400">
                        Or click to copy URL & press{' '}
                        <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono border border-slate-300 dark:border-slate-700">
                          {isMac ? '⌘+Shift+N' : 'Ctrl+Shift+N'}
                        </kbd>
                        .
                      </span>
                    </p>
                  </div>
                </a>

                {copiedForIncognito && (
                  <div className="p-3 rounded-xl bg-slate-900 text-white text-xs space-y-1.5 border border-slate-800">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                      <Check className="w-4 h-4" />
                      <span>URL copied to clipboard!</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-white">{isMac ? '⌘+Shift+N' : 'Ctrl+Shift+N'}</kbd> then paste with <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-white">{isMac ? '⌘+V' : 'Ctrl+V'}</kbd>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Why browser security blocks 1-click incognito notice */}
            <div className="mt-3 p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Why can't websites open Incognito with 1 click?</strong>
                <p className="text-[10px] text-amber-800 dark:text-amber-400 mt-0.5">
                  Web browsers strictly forbid all websites from programmatically forcing incognito windows to prevent tracking and preserve security. Use the <strong>Touch & Hold</strong> button above on phone, or right-click on desktop.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-[#111B2E]/60 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <button
            type="button"
            onClick={handleCopyOnly}
            className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium px-2 py-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation min-h-[36px]"
          >
            {copiedUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400">Copied URL</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy URL Only</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-medium transition-colors cursor-pointer touch-manipulation min-h-[36px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
