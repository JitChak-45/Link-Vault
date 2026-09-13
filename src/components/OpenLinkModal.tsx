import React, { useState } from 'react';
import {
  ExternalLink,
  Shield,
  Copy,
  Check,
  X,
  Globe,
  Lock,
  EyeOff,
  Sparkles,
  Command,
} from 'lucide-react';
import { SavedLink, Category } from '../types';
import { extractHostname, getFaviconUrl, normalizeUrl } from '../utils/urlHelper';

interface OpenLinkModalProps {
  isOpen: boolean;
  link: SavedLink | null;
  category?: Category;
  onClose: () => void;
  onOpenNormal: (link: SavedLink) => void;
}

export const OpenLinkModal: React.FC<OpenLinkModalProps> = ({
  isOpen,
  link,
  category,
  onClose,
  onOpenNormal,
}) => {
  const [copiedForIncognito, setCopiedForIncognito] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen || !link) return null;

  const targetUrl = normalizeUrl(link.url);
  const domain = extractHostname(link.url);
  const favicon = link.faviconUrl || getFaviconUrl(link.url);
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const handleOpenNormal = () => {
    onOpenNormal(link);
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

  const handleOpenIncognito = () => {
    onOpenNormal(link); // record click / visit stats
    // Copy URL to clipboard so user can immediately paste in Incognito window if desired
    try {
      navigator.clipboard.writeText(targetUrl);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
    setCopiedForIncognito(true);
  };

  const handleCopyOnly = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div
      id="open-link-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="open-link-modal-dialog"
        className="w-full max-w-md bg-white dark:bg-[#0D1422] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111B2E]/60 flex items-start justify-between gap-3">
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 bg-white dark:bg-[#0D1422]">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Choose how you would like to launch this URL:
          </p>

          <div className="grid grid-cols-1 gap-3">
            {/* Option 1: Normal Chrome / Browser Tab */}
            <a
              id="open-normal-tab-btn"
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onOpenNormal(link);
                onClose();
              }}
              className="group flex items-start gap-3.5 p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-blue-600 dark:hover:border-cyan-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-left transition-all cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-cyan-300">
                    Open in Normal Tab
                  </span>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-cyan-400" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Opens directly in a standard new browser tab with cookies and browser history.
                </p>
              </div>
            </a>

            {/* Option 2: Incognito / Private Tab */}
            <a
              id="open-incognito-tab-btn"
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                handleOpenIncognito();
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
                  <span className="text-slate-500 dark:text-slate-400">Or left-click to auto-copy URL & use <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono border border-slate-300 dark:border-slate-700">{isMac ? '⌘+Shift+N' : 'Ctrl+Shift+N'}</kbd>.</span>
                </p>
              </div>
            </a>
          </div>

          {/* Browser limitation explanation note */}
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-900 dark:text-amber-300 space-y-1 leading-relaxed">
            <div className="flex items-center gap-1.5 font-semibold text-amber-950 dark:text-amber-200">
              <Shield className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              <span>Why doesn't the browser open Incognito automatically on click?</span>
            </div>
            <p>
              Chrome, Edge, and Safari have strict security rules that <strong>forbid any website from forcing an incognito window via code</strong>. Only <em>you</em> can open incognito via your browser's right-click menu or the keyboard shortcut.
            </p>
          </div>

          {/* Incognito Helper Card when clicked */}
          {copiedForIncognito && (
            <div className="p-3.5 rounded-xl bg-slate-900 dark:bg-[#070B14] border border-slate-800 text-white space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <Check className="w-4 h-4" />
                <span>URL copied to clipboard!</span>
              </div>
              <div className="text-[11px] text-slate-300 dark:text-slate-400 space-y-1.5">
                <div className="p-2 bg-slate-800/80 dark:bg-[#111B2E] rounded-lg border border-slate-700 dark:border-slate-800">
                  <p className="font-semibold text-white mb-0.5">Method 1 (Instant, 0 typing):</p>
                  <p className="text-slate-300 dark:text-slate-400">
                    Right-click the <strong>"Incognito / Private Window"</strong> box above and select <strong>"Open link in incognito window"</strong>.
                  </p>
                </div>
                <div className="p-2 bg-slate-800/80 dark:bg-[#111B2E] rounded-lg border border-slate-700 dark:border-slate-800">
                  <p className="font-semibold text-white mb-0.5">Method 2 (Keyboard shortcut):</p>
                  <p className="text-slate-300 dark:text-slate-400">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-slate-700 dark:bg-slate-800 text-white border border-slate-600 dark:border-slate-700 font-mono text-[10px]">{isMac ? '⌘ + Shift + N' : 'Ctrl + Shift + N'}</kbd>, then press <kbd className="px-1.5 py-0.5 rounded bg-slate-700 dark:bg-slate-800 text-white border border-slate-600 dark:border-slate-700 font-mono text-[10px]">{isMac ? '⌘ + V' : 'Ctrl + V'}</kbd> and hit Enter.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    onOpenNormal(link);
                    onClose();
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1"
                >
                  <span>Open in normal tab instead</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 bg-slate-800 dark:bg-[#111B2E] hover:bg-slate-700 dark:hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-[#111B2E]/60 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={handleCopyOnly}
            className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium px-2 py-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
            className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
