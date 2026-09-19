import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  FileCode,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  ArrowRight,
  RotateCcw,
  Search,
  Download,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  ExternalLink,
  Layers,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { Category, SavedLink } from '../types';
import { CategoryIcon } from './CategoryIcon';
import {
  parseBulkImportFile,
  downloadSampleCsv,
  downloadSampleJson,
  ParsedImportLink,
  DetectedCategory,
  ParseResult,
  slugify,
} from '../utils/importParser';
import { getFaviconUrl, normalizeUrlForComparison } from '../utils/urlHelper';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCategories: Category[];
  existingLinks: SavedLink[];
  currentCategorySlug?: string;
  onConfirmImport: (
    linksToImport: Array<{
      title: string;
      url: string;
      categorySlug: string;
      description?: string;
      tags: string[];
      isFavorite?: boolean;
    }>,
    newCategoriesToCreate: Category[]
  ) => Promise<void>;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  existingCategories,
  existingLinks,
  currentCategorySlug = 'all',
  onConfirmImport,
}) => {
  // Input mode: 'file' or 'paste'
  const [inputTab, setInputTab] = useState<'file' | 'paste'>('file');
  const [pastedContent, setPastedContent] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Parsed state
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [previewLinks, setPreviewLinks] = useState<ParsedImportLink[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDuplicateState, setFilterDuplicateState] = useState<'all' | 'ready' | 'duplicate'>('all');

  // Configuration options
  const defaultInitialCategorySlug =
    currentCategorySlug && currentCategorySlug !== 'all' && currentCategorySlug !== 'favorites'
      ? currentCategorySlug
      : existingCategories[0]?.slug || 'entertainment';

  const [defaultCategorySlug, setDefaultCategorySlug] = useState<string>(defaultInitialCategorySlug);
  const [autoCreateCategories, setAutoCreateCategories] = useState<boolean>(true);
  const [overrideAllCategories, setOverrideAllCategories] = useState<boolean>(false);
  const [overrideCategorySlug, setOverrideCategorySlug] = useState<string>(defaultInitialCategorySlug);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset modal when reopened
  React.useEffect(() => {
    if (isOpen) {
      setParseResult(null);
      setPreviewLinks([]);
      setParseError(null);
      setSelectedFileName('');
      setPastedContent('');
      setSearchQuery('');
      setFilterDuplicateState('all');
      setIsImporting(false);
      const initialCat =
        currentCategorySlug && currentCategorySlug !== 'all' && currentCategorySlug !== 'favorites'
          ? currentCategorySlug
          : existingCategories[0]?.slug || 'entertainment';
      setDefaultCategorySlug(initialCat);
      setOverrideCategorySlug(initialCat);
    }
  }, [isOpen, currentCategorySlug, existingCategories]);

  if (!isOpen) return null;

  // Process text or file into parse results
  const handleProcessContent = (content: string, fileName: string) => {
    setParseError(null);
    if (!content.trim()) {
      setParseError('The file or pasted content is empty.');
      return;
    }

    try {
      const result = parseBulkImportFile(
        content,
        fileName,
        existingCategories,
        existingLinks,
        defaultCategorySlug
      );

      if (result.totalFound === 0) {
        setParseError(
          'Could not find any links or URLs. Please ensure your file has valid URLs, formatted as JSON or CSV.'
        );
        return;
      }

      setParseResult(result);
      setPreviewLinks(result.links);
      setSelectedFileName(fileName);
    } catch (err: any) {
      setParseError(`Failed to parse file: ${err.message || 'Unknown error'}`);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleProcessContent(text, file.name);
    };
    reader.onerror = () => {
      setParseError('Error reading file. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Re-run category resolution or duplicate checks when settings change
  const effectiveLinks = useMemo(() => {
    if (!parseResult) return [];

    const existingKeySet = new Set(
      existingLinks.map(
        (l) => `${(l.categorySlug || '').toLowerCase()}::${normalizeUrlForComparison(l.url)}`
      )
    );

    return previewLinks.map((item) => {
      const targetSlug = overrideAllCategories ? overrideCategorySlug : item.categorySlug;
      const checkKey = `${targetSlug.toLowerCase()}::${normalizeUrlForComparison(item.url)}`;
      const isDuplicate = existingKeySet.has(checkKey);

      let isSelected = item.selected;
      if (skipDuplicates && isDuplicate) {
        isSelected = false;
      }

      return {
        ...item,
        categorySlug: targetSlug,
        categoryName: overrideAllCategories
          ? existingCategories.find((c) => c.slug === overrideCategorySlug)?.name || targetSlug
          : item.categoryName,
        isDuplicate,
        selected: isSelected,
      };
    });
  }, [
    previewLinks,
    overrideAllCategories,
    overrideCategorySlug,
    existingLinks,
    existingCategories,
    skipDuplicates,
    parseResult,
  ]);

  // Filtered preview items for table display
  const filteredLinks = useMemo(() => {
    let list = effectiveLinks;

    if (filterDuplicateState === 'ready') {
      list = list.filter((l) => !l.isDuplicate && l.isValid);
    } else if (filterDuplicateState === 'duplicate') {
      list = list.filter((l) => l.isDuplicate);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q) ||
          l.categoryName.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  }, [effectiveLinks, filterDuplicateState, searchQuery]);

  // Toggle single link selection
  const handleToggleSelectLink = (tempId: string) => {
    setPreviewLinks((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, selected: !item.selected } : item))
    );
  };

  // Select all or deselect all
  const handleSelectAll = (select: boolean) => {
    const idsToChange = new Set(filteredLinks.map((l) => l.tempId));
    setPreviewLinks((prev) =>
      prev.map((item) => (idsToChange.has(item.tempId) ? { ...item, selected: select } : item))
    );
  };

  // Change individual link's category
  const handleChangeLinkCategory = (tempId: string, newSlug: string) => {
    const cat = existingCategories.find((c) => c.slug === newSlug);
    setPreviewLinks((prev) =>
      prev.map((item) =>
        item.tempId === tempId
          ? {
              ...item,
              categorySlug: newSlug,
              categoryName: cat ? cat.name : newSlug,
            }
          : item
      )
    );
  };

  // Count metrics
  const selectedCount = effectiveLinks.filter((l) => l.selected).length;
  const totalDuplicates = effectiveLinks.filter((l) => l.isDuplicate).length;

  // Compute newly required categories that don't exist yet
  const newCategoriesToCreate = useMemo<Category[]>(() => {
    if (!parseResult || overrideAllCategories || !autoCreateCategories) return [];

    const existingSlugs = new Set(existingCategories.map((c) => c.slug.toLowerCase()));
    const neededSlugs = new Set<string>();

    for (const link of effectiveLinks) {
      if (link.selected && !existingSlugs.has(link.categorySlug.toLowerCase())) {
        neededSlugs.add(link.categorySlug.toLowerCase());
      }
    }

    const list: Category[] = [];
    for (const cat of parseResult.detectedCategories) {
      if (neededSlugs.has(cat.slug.toLowerCase())) {
        list.push({
          id: cat.slug,
          name: cat.name,
          slug: cat.slug,
          color: cat.color,
          icon: cat.icon,
          description: `Imported category (${cat.count} links)`,
          isDefault: false,
          hideFromAll: false,
          createdAt: Date.now(),
        });
      }
    }
    return list;
  }, [
    parseResult,
    overrideAllCategories,
    autoCreateCategories,
    existingCategories,
    effectiveLinks,
  ]);

  // Execute Import
  const handleExecuteImport = async () => {
    const selectedLinks = effectiveLinks.filter((l) => l.selected);
    if (selectedLinks.length === 0) {
      setParseError('Please select at least one link to import.');
      return;
    }

    setIsImporting(true);
    setParseError(null);

    try {
      const linksPayload = selectedLinks.map((l) => ({
        title: l.title,
        url: l.url,
        categorySlug: l.categorySlug,
        description: l.description,
        tags: l.tags,
        isFavorite: l.isFavorite,
      }));

      await onConfirmImport(linksPayload, newCategoriesToCreate);
      onClose();
    } catch (err: any) {
      setParseError(`Import failed: ${err.message || 'Unknown error'}`);
      setIsImporting(false);
    }
  };

  return (
    <div
      id="bulk-import-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        id="bulk-import-modal-content"
        className="bg-white dark:bg-[#0D1422] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#111B2E]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/40 shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] tracking-tight">
                  Bulk Import Links
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100/70 dark:bg-blue-950/80 text-blue-700 dark:text-cyan-300 font-semibold border border-blue-200/50 dark:border-blue-800/50">
                  JSON & CSV
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Migrate bookmarks from Chrome, Firefox, Pocket, Raindrop, Notion or spreadsheets
              </p>
            </div>
          </div>
          <button
            id="close-bulk-import-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111B2E] transition-colors cursor-pointer"
            aria-label="Close bulk import modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-white dark:bg-[#0D1422]">
          {/* Error Banner */}
          {parseError && (
            <div
              id="bulk-import-error-banner"
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{parseError}</div>
              <button
                type="button"
                onClick={() => setParseError(null)}
                className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 1: Upload or Paste (shown when no parsed result yet) */}
          {!parseResult && (
            <div className="space-y-4">
              {/* Method Switcher Tabs */}
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#111B2E] p-1 rounded-xl">
                  <button
                    type="button"
                    id="import-tab-file-btn"
                    onClick={() => setInputTab('file')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      inputTab === 'file'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                  </button>
                  <button
                    type="button"
                    id="import-tab-paste-btn"
                    onClick={() => setInputTab('paste')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      inputTab === 'paste'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Paste Text</span>
                  </button>
                </div>

                {/* Sample Download Shortcuts */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="download-sample-csv-btn"
                    onClick={downloadSampleCsv}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-[#111B2E] transition-colors border border-slate-200/80 dark:border-slate-800 cursor-pointer"
                    title="Download sample CSV template format"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Sample CSV</span>
                  </button>
                  <button
                    type="button"
                    id="download-sample-json-btn"
                    onClick={downloadSampleJson}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-[#111B2E] transition-colors border border-slate-200/80 dark:border-slate-800 cursor-pointer"
                    title="Download sample JSON template format"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Sample JSON</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Drag & Drop File Zone */}
              {inputTab === 'file' && (
                <div
                  id="bulk-import-dropzone"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99]'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-[#111B2E]/20 hover:bg-slate-50/80 dark:hover:bg-[#111B2E]/40'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    id="bulk-import-file-input"
                    type="file"
                    accept=".json,.csv,.txt"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  <div className="w-14 h-14 rounded-2xl bg-blue-100/70 dark:bg-blue-950/70 text-blue-600 dark:text-cyan-400 flex items-center justify-center mb-3 shadow-inner">
                    <Upload className="w-7 h-7" />
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Drag & Drop your JSON or CSV file here
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                    Supports <strong className="font-semibold text-slate-700 dark:text-slate-300">.json</strong>,{' '}
                    <strong className="font-semibold text-slate-700 dark:text-slate-300">.csv</strong>, Chrome bookmark exports, Pocket & Raindrop files
                  </p>

                  <button
                    type="button"
                    id="browse-files-btn"
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer pointer-events-none"
                  >
                    Browse Files on Computer
                  </button>
                </div>
              )}

              {/* Tab 2: Paste Raw Text */}
              {inputTab === 'paste' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Paste CSV content or JSON array below:
                    </label>
                    <span className="text-[11px] text-slate-400">Comma, tab or semicolon delimited</span>
                  </div>

                  <textarea
                    id="bulk-import-paste-textarea"
                    rows={8}
                    value={pastedContent}
                    onChange={(e) => setPastedContent(e.target.value)}
                    placeholder={`Title,URL,Category,Tags\n"GitHub","https://github.com","Study","coding, git"\n"YouTube","https://youtube.com","Entertainment","music, video"`}
                    className="w-full p-3 font-mono text-xs bg-slate-50/50 dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 text-slate-800 dark:text-slate-200"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      id="parse-pasted-text-btn"
                      disabled={!pastedContent.trim()}
                      onClick={() => handleProcessContent(pastedContent, 'pasted-links.csv')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Parse & Preview Links</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Migration Guidance Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111B2E]/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <HelpCircle className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                  <span>Supported Formats & Auto-Detection</span>
                </div>
                <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pl-6 list-disc leading-relaxed">
                  <li>
                    <strong>CSV:</strong> Headers such as <code className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">URL</code>, <code className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">Title</code>, <code className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">Category</code>, <code className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">Tags</code>, <code className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">Description</code> are automatically mapped.
                  </li>
                  <li>
                    <strong>JSON:</strong> Standard array <code className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">[&#123;url, title...&#125;]</code>, Chrome/Firefox nested bookmark export JSON, or objects with <code className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">links</code>, <code className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">items</code> or <code className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">bookmarks</code>.
                  </li>
                  <li>
                    <strong>Duplicate Safe:</strong> Links already present in the same category are highlighted in amber and automatically deselected so you never get duplicates.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Configuration (shown when file is parsed) */}
          {parseResult && (
            <div className="space-y-4">
              {/* File Info & Back Action */}
              <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-slate-100/70 dark:bg-[#111B2E] rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-cyan-400 shrink-0">
                    {parseResult.format === 'json' ? (
                      <FileCode className="w-4 h-4" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {selectedFileName || 'Import File'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Detected {parseResult.format.toUpperCase()} format • {parseResult.totalFound} links found
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  id="reupload-import-file-btn"
                  onClick={() => {
                    setParseResult(null);
                    setPreviewLinks([]);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 font-medium transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Choose Another File</span>
                </button>
              </div>

              {/* Summary Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#111B2E]/40">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Found</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white font-['Space_Grotesk']">
                    {parseResult.totalFound}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Ready to Import</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-800 dark:text-emerald-300 font-['Space_Grotesk']">
                    {effectiveLinks.filter((l) => !l.isDuplicate && l.isValid).length}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20">
                  <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Duplicates in Cat</span>
                  </div>
                  <div className="text-lg font-bold text-amber-800 dark:text-amber-300 font-['Space_Grotesk']">
                    {totalDuplicates}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20">
                  <div className="text-[11px] font-medium text-blue-700 dark:text-cyan-400 flex items-center gap-1">
                    <FolderPlus className="w-3 h-3" />
                    <span>New Categories</span>
                  </div>
                  <div className="text-lg font-bold text-blue-800 dark:text-cyan-300 font-['Space_Grotesk']">
                    {newCategoriesToCreate.length}
                  </div>
                </div>
              </div>

              {/* Import Configuration Panel */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111B2E]/30 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Category Mapping & Settings
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Default Category Selector */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Default Target Category (for unassigned links):
                    </label>
                    <select
                      id="default-import-category-select"
                      value={defaultCategorySlug}
                      onChange={(e) => setDefaultCategorySlug(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {existingCategories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Override Category Selector (if override is enabled) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Override All Links with One Category:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="override-all-categories-checkbox"
                        checked={overrideAllCategories}
                        onChange={(e) => setOverrideAllCategories(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                      />
                      <select
                        id="override-category-select"
                        disabled={!overrideAllCategories}
                        value={overrideCategorySlug}
                        onChange={(e) => setOverrideCategorySlug(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 disabled:opacity-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {existingCategories.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            Force all to: {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      id="auto-create-categories-checkbox"
                      checked={autoCreateCategories}
                      onChange={(e) => setAutoCreateCategories(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                    />
                    <span>
                      Auto-create missing categories found in file ({newCategoriesToCreate.length} detected)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      id="skip-duplicates-checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                    />
                    <span>
                      Skip duplicates in same category ({totalDuplicates} detected)
                    </span>
                  </label>
                </div>

                {/* New categories chips preview */}
                {newCategoriesToCreate.length > 0 && autoCreateCategories && !overrideAllCategories && (
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                      New categories to be created:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {newCategoriesToCreate.map((cat) => (
                        <span
                          key={cat.slug}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold text-white shadow-2xs"
                          style={{ backgroundColor: cat.color }}
                        >
                          <CategoryIcon name={cat.icon} color="#ffffff" className="w-3 h-3" />
                          <span>{cat.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Links Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                {/* Search & Filter */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative flex-1 min-w-0 max-w-xs">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="import-preview-search-input"
                      type="text"
                      placeholder="Filter preview list..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-100 dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      id="filter-all-import-btn"
                      onClick={() => setFilterDuplicateState('all')}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        filterDuplicateState === 'all'
                          ? 'bg-slate-800 dark:bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-[#111B2E] text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      All ({effectiveLinks.length})
                    </button>
                    <button
                      type="button"
                      id="filter-ready-import-btn"
                      onClick={() => setFilterDuplicateState('ready')}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        filterDuplicateState === 'ready'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-[#111B2E] text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Ready ({effectiveLinks.filter((l) => !l.isDuplicate).length})
                    </button>
                    {totalDuplicates > 0 && (
                      <button
                        type="button"
                        id="filter-duplicates-import-btn"
                        onClick={() => setFilterDuplicateState('duplicate')}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          filterDuplicateState === 'duplicate'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 dark:bg-[#111B2E] text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        Duplicates ({totalDuplicates})
                      </button>
                    )}
                  </div>
                </div>

                {/* Bulk Select/Deselect Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    id="select-all-import-btn"
                    onClick={() => handleSelectAll(true)}
                    className="text-xs text-blue-600 dark:text-cyan-400 hover:underline font-medium cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    id="deselect-all-import-btn"
                    onClick={() => handleSelectAll(false)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:underline font-medium cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Links Preview Table / List */}
              <div
                id="bulk-import-links-list"
                className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 max-h-72 overflow-y-auto"
              >
                {filteredLinks.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    No links match the current filter or search.
                  </div>
                ) : (
                  filteredLinks.map((item) => {
                    const favicon = getFaviconUrl(item.url);

                    return (
                      <div
                        key={item.tempId}
                        className={`p-3 flex items-start sm:items-center gap-3 transition-colors ${
                          item.selected
                            ? 'bg-blue-50/20 dark:bg-blue-950/10'
                            : 'opacity-60 bg-slate-50/40 dark:bg-slate-900/20'
                        } hover:bg-slate-50 dark:hover:bg-[#111B2E]/60`}
                      >
                        {/* Checkbox */}
                        <button
                          type="button"
                          id={`toggle-link-${item.tempId}-btn`}
                          onClick={() => handleToggleSelectLink(item.tempId)}
                          className="mt-0.5 sm:mt-0 text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 shrink-0 cursor-pointer"
                          aria-label={item.selected ? `Deselect ${item.title}` : `Select ${item.title}`}
                        >
                          {item.selected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        {/* Favicon */}
                        <div className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 mt-0.5 sm:mt-0">
                          <img
                            src={favicon}
                            alt=""
                            className="w-4 h-4 object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>

                        {/* Title & URL */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {item.title}
                            </span>
                            {item.isDuplicate && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shrink-0"
                                title="This link already exists in this category in your vault"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Duplicate in Category
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">
                            {item.url}
                          </div>
                          {item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.tags.map((t, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Category Selector for this link */}
                        <div className="shrink-0">
                          {overrideAllCategories ? (
                            <span className="text-[11px] px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300 font-medium border border-blue-200/50 dark:border-blue-800/50">
                              {item.categoryName}
                            </span>
                          ) : (
                            <select
                              id={`select-category-link-${item.tempId}`}
                              value={item.categorySlug}
                              onChange={(e) => handleChangeLinkCategory(item.tempId, e.target.value)}
                              className="text-[11px] px-2 py-1 bg-white dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-hidden"
                            >
                              {existingCategories.map((c) => (
                                <option key={c.slug} value={c.slug}>
                                  {c.name}
                                </option>
                              ))}
                              {/* Also include detected category if not in existing list */}
                              {!existingCategories.some((c) => c.slug === item.categorySlug) && (
                                <option value={item.categorySlug}>{item.categoryName} (New)</option>
                              )}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#111B2E]/60 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {parseResult ? (
              <span>
                <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selectedCount}</strong>{' '}
                links selected to import
                {totalDuplicates > 0 && skipDuplicates && (
                  <span className="text-amber-600 dark:text-amber-400 ml-1 font-medium">
                    ({totalDuplicates} duplicates skipped)
                  </span>
                )}
              </span>
            ) : (
              <span>Supports Raindrop, Pocket, Chrome, Firefox & Excel exports</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="cancel-bulk-import-btn"
              onClick={onClose}
              disabled={isImporting}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {parseResult && (
              <button
                type="button"
                id="confirm-execute-bulk-import-btn"
                onClick={handleExecuteImport}
                disabled={isImporting || selectedCount === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Import {selectedCount} {selectedCount === 1 ? 'Link' : 'Links'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
