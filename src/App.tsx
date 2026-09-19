import React, { useState, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import {
  Search,
  Plus,
  Cloud,
  LayoutGrid,
  List as ListIcon,
  Star,
  FolderPlus,
  SlidersHorizontal,
  Bookmark,
  Smartphone,
  Sparkles,
  Layers,
  CheckCircle2,
  Trash2,
  X,
  ExternalLink,
  Lock,
  EyeOff,
  Pencil,
  Settings2,
  QrCode,
  Sun,
  Moon,
  Loader2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileDown,
} from 'lucide-react';
import { exportLinksToPdf } from './utils/pdfExport';
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  type User,
} from './firebase';
import { Category, SavedLink, SortOption, ViewMode, QrSharePayload } from './types';
import { DEFAULT_CATEGORIES } from './constants';
import { STARTER_LINKS } from './utils/starterData';
import {
  getLocalCategories,
  saveLocalCategories,
  getLocalLinks,
  saveLocalLinks,
} from './utils/localVault';
import { decodeShareData, decodeShareDataAsync, isLinkInCategory } from './utils/qrHelper';
import { getFaviconUrl, isSameUrl, normalizeUrlForComparison } from './utils/urlHelper';
import { CategoryIcon } from './components/CategoryIcon';
import { LinkCard } from './components/LinkCard';
import { AddEditLinkModal } from './components/AddEditLinkModal';
import { CategoryModal } from './components/CategoryModal';
import { SyncModal } from './components/SyncModal';
import { BulkImportModal } from './components/BulkImportModal';
import { PinLockScreen } from './components/PinLockScreen';
import { OpenLinkModal } from './components/OpenLinkModal';
import { QrShareModal } from './components/QrShareModal';
import { QrScannerModal } from './components/QrScannerModal';
import { ImportSharedModal } from './components/ImportSharedModal';
import { DeleteCategoryModal } from './components/DeleteCategoryModal';
import { CategoryTabItem } from './components/CategoryTabItem';
import { TopRightAuthWidget } from './components/TopRightAuthWidget';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [categories, setCategories] = useState<Category[]>(() => getLocalCategories());
  const [links, setLinks] = useState<SavedLink[]>(() => getLocalLinks());
  const [isSyncing, setIsSyncing] = useState(false);

  // Active filters and views
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<SavedLink | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // QR Code & Cross-Device Import Modals
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isQrShareModalOpen, setIsQrShareModalOpen] = useState(false);
  const [qrShareCategory, setQrShareCategory] = useState<Category | null>(null);
  const [qrShareLink, setQrShareLink] = useState<SavedLink | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPayload, setImportPayload] = useState<QrSharePayload | null>(null);
  const [isOpenLinkModalOpen, setIsOpenLinkModalOpen] = useState(false);
  const [linkToOpen, setLinkToOpen] = useState<SavedLink | null>(null);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Category Scroll & Reorder State
  const categoriesScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef<number>(0);
  const categoriesRef = useRef<Category[]>(categories);
  categoriesRef.current = categories;
  const [activeDraggingCatSlug, setActiveDraggingCatSlug] = useState<string | null>(null);

  // 6-digit PIN Security Protection
  const [storedPinHash, setStoredPinHash] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('link_vault_pin_hash') : null;
  });
  const [hasPinSet, setHasPinSet] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? Boolean(localStorage.getItem('link_vault_pin_hash')) : false;
  });
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? Boolean(localStorage.getItem('link_vault_pin_hash')) : false;
  });
  const [isImportLoading, setIsImportLoading] = useState<boolean>(false);
  const [securityQuestion, setSecurityQuestion] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('link_vault_sec_question') : null;
  });
  const [securityAnswerHash, setSecurityAnswerHash] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('link_vault_sec_answer_hash') : null;
  });

  // Auto-lock vault immediately on tab switch or when mobile app is hidden/switched
  useEffect(() => {
    if (!hasPinSet) return;

    const lockVaultImmediately = () => {
      if ((window as any).__linkVaultFilePickerActive) return;
      // Synchronously flush state update so the PIN Lock Screen mounts immediately
      flushSync(() => {
        setIsLocked(true);
      });
      window.scrollTo(0, 0);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lockVaultImmediately();
      }
    };

    const handlePageHide = () => {
      lockVaultImmediately();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [hasPinSet]);

  // Device time helper: 6:00 PM (18:00) to 6:00 AM (06:00) -> Night Mode ('dark'); 6:00 AM to 6:00 PM -> Day Mode ('light')
  const getThemeByDeviceTime = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6 ? 'dark' : 'light';
  };

  const [isManualThemeActive, setIsManualThemeActive] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('link_vault_theme_manual') === 'true';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const isManual = localStorage.getItem('link_vault_theme_manual') === 'true';
    const saved = localStorage.getItem('link_vault_theme');
    if (isManual && (saved === 'light' || saved === 'dark')) {
      return saved;
    }
    return getThemeByDeviceTime();
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    }
    try {
      localStorage.setItem('link_vault_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Periodic sync with local device time (Night Mode 6 PM - 6 AM; Day Mode 6 AM - 6 PM)
  useEffect(() => {
    const syncThemeWithLocalTime = () => {
      if (!isManualThemeActive) {
        const expected = getThemeByDeviceTime();
        setTheme(expected);
      }
    };

    syncThemeWithLocalTime();
    const interval = setInterval(syncThemeWithLocalTime, 20000);
    return () => clearInterval(interval);
  }, [isManualThemeActive]);

  const toggleTheme = () => {
    setIsManualThemeActive(true);
    try {
      localStorage.setItem('link_vault_theme_manual', 'true');
    } catch {}
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 1. Process share import links (URL hash, cloud short IDs, or search params like #s=..., #import=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkAndProcessImportUrl = async () => {
      const fullUrl = window.location.href;
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      const hasShareIndicator =
        fullUrl.includes('#s=') ||
        fullUrl.includes('?s=') ||
        fullUrl.includes('&s=') ||
        fullUrl.includes('#share=') ||
        fullUrl.includes('?share=') ||
        fullUrl.includes('#import=') ||
        fullUrl.includes('?import=') ||
        fullUrl.includes('#i=') ||
        fullUrl.includes('?i=') ||
        fullUrl.includes('#code=') ||
        fullUrl.includes('?code=') ||
        fullUrl.includes('#s_') ||
        hash.startsWith('#s_') ||
        /s_[a-zA-Z0-9_-]+/.test(fullUrl);

      if (hasShareIndicator) {
        setIsImportLoading(true);
        const timeoutId = setTimeout(() => {
          setIsImportLoading(false);
        }, 5000);

        try {
          const decoded = (await decodeShareDataAsync(fullUrl)) || decodeShareData(fullUrl);
          if (decoded) {
            setImportPayload(decoded);
            setIsImportModalOpen(true);
            try {
              window.history.replaceState(null, '', window.location.pathname);
            } catch {
              // ignore
            }
          } else {
            setImportSuccessMessage(
              'Shared bundle link was incomplete or expired. You can also use the 6-digit Quick Code via Scan QR.'
            );
            setTimeout(() => setImportSuccessMessage(null), 6000);
          }
        } catch (err) {
          console.warn('Failed to parse URL import payload:', err);
        } finally {
          clearTimeout(timeoutId);
          setIsImportLoading(false);
        }
      }
    };

    checkAndProcessImportUrl();

    // Also listen for hash changes if user pastes a hash in current window
    window.addEventListener('hashchange', checkAndProcessImportUrl);
    return () => {
      window.removeEventListener('hashchange', checkAndProcessImportUrl);
    };
  }, []);

  // 2. Authenticate user (Google / Email)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore Subscriptions for Categories and Links
  useEffect(() => {
    if (!user) {
      // Local mode
      setCategories(getLocalCategories());
      setLinks(getLocalLinks());
      setIsSyncing(false);
      return;
    }

    setIsSyncing(true);
    const userDocRef = doc(db, 'users', user.uid);
    const categoriesColRef = collection(userDocRef, 'categories');
    const linksColRef = collection(userDocRef, 'links');

    // User doc listener for synced PIN and security question
    const unsubUserDoc = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.pinHash) {
          setStoredPinHash(data.pinHash);
          setHasPinSet(true);
          localStorage.setItem('link_vault_pin_hash', data.pinHash);
        } else if (data && 'pinHash' in data && data.pinHash === null) {
          setStoredPinHash(null);
          setHasPinSet(false);
          localStorage.removeItem('link_vault_pin_hash');
        }

        if (data?.securityQuestion) {
          setSecurityQuestion(data.securityQuestion);
          localStorage.setItem('link_vault_sec_question', data.securityQuestion);
        }
        if (data?.securityAnswerHash) {
          setSecurityAnswerHash(data.securityAnswerHash);
          localStorage.setItem('link_vault_sec_answer_hash', data.securityAnswerHash);
        }
      }
    });

    // Categories listener
    const unsubCategories = onSnapshot(
      categoriesColRef,
      async (snapshot) => {
        if (snapshot.empty) {
          // Initialize with local categories in Firestore
          const currentCats = getLocalCategories();
          for (const cat of currentCats) {
            await setDoc(doc(categoriesColRef, cat.slug), cat);
          }
        } else {
          const loadedCategories = snapshot.docs.map((d) => d.data() as Category);
          loadedCategories.sort((a, b) => {
            if (typeof a.order === 'number' && typeof b.order === 'number') {
              return a.order - b.order;
            }
            return a.createdAt - b.createdAt;
          });
          setCategories(loadedCategories);
          saveLocalCategories(loadedCategories);
        }
      },
      (error) => {
        console.error('Error listening to categories:', error);
      }
    );

    // Links listener
    const unsubLinks = onSnapshot(
      linksColRef,
      async (snapshot) => {
        if (snapshot.empty) {
          // If first time this user logs into the cloud, sync/upload their existing local links!
          const currentLocal = getLocalLinks();
          if (currentLocal.length > 0) {
            for (const item of currentLocal) {
              const newRef = doc(linksColRef);
              const linkDoc: SavedLink = {
                ...item,
                id: newRef.id,
              };
              await setDoc(newRef, linkDoc);
            }
          }
        } else {
          const loadedLinks = snapshot.docs.map((d) => d.data() as SavedLink);
          setLinks(loadedLinks);
          saveLocalLinks(loadedLinks);
        }
        setIsSyncing(false);
      },
      (error) => {
        console.error('Error listening to links:', error);
        setIsSyncing(false);
      }
    );

    return () => {
      unsubUserDoc();
      unsubCategories();
      unsubLinks();
    };
  }, [user]);

  // Operations with dual local & cloud persistence
  const handleSaveLink = async (
    linkData: Omit<SavedLink, 'id' | 'createdAt' | 'updatedAt' | 'clickCount'>
  ) => {
    // Check if link already exists in the same category (allow same link in different categories)
    const targetCategory = categories.find((c) => c.slug === linkData.categorySlug) || {
      slug: linkData.categorySlug,
      name: linkData.categorySlug,
    };
    const duplicateInCategory = links.find(
      (l) =>
        (!editingLink || l.id !== editingLink.id) &&
        isLinkInCategory(l.categorySlug, targetCategory) &&
        isSameUrl(l.url, linkData.url)
    );

    if (duplicateInCategory) {
      setIsSyncing(false);
      const catName =
        categories.find((c) => isLinkInCategory(c.slug, targetCategory))?.name ||
        targetCategory.name ||
        'this';
      throw new Error(
        `This link already exists in the "${catName}" category. Duplicate entries in the same category are not permitted, but you can save this link into a different category.`
      );
    }

    setIsSyncing(true);
    if (editingLink) {
      const updatedList = links.map((l) =>
        l.id === editingLink.id
          ? {
              ...l,
              ...linkData,
              description: linkData.description || '',
              imageUrl: linkData.imageUrl || '',
              faviconUrl: linkData.faviconUrl || '',
              updatedAt: Date.now(),
            }
          : l
      );
      setLinks(updatedList);
      saveLocalLinks(updatedList);

      if (user) {
        try {
          const linkRef = doc(db, 'users', user.uid, 'links', editingLink.id);
          await updateDoc(
            linkRef,
            cleanForFirestore({
              ...linkData,
              description: linkData.description || '',
              imageUrl: linkData.imageUrl || '',
              faviconUrl: linkData.faviconUrl || '',
              updatedAt: Date.now(),
            })
          );
        } catch (err) {
          console.error('Failed to update link in Firestore:', err);
        }
      }
    } else {
      const newId = user
        ? doc(collection(db, 'users', user.uid, 'links')).id
        : `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newLink: SavedLink = {
        ...linkData,
        description: linkData.description || '',
        imageUrl: linkData.imageUrl || '',
        faviconUrl: linkData.faviconUrl || '',
        id: newId,
        clickCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const updatedList = [newLink, ...links];
      setLinks(updatedList);
      saveLocalLinks(updatedList);

      if (user) {
        try {
          const newRef = doc(db, 'users', user.uid, 'links', newId);
          await setDoc(newRef, cleanForFirestore(newLink));
        } catch (err) {
          console.error('Failed to save new link in Firestore:', err);
        }
      }
    }
    setEditingLink(null);
    setIsSyncing(false);
  };

  const handleDeleteLink = async (linkId: string) => {
    setIsSyncing(true);
    const updatedList = links.filter((l) => l.id !== linkId);
    setLinks(updatedList);
    saveLocalLinks(updatedList);

    if (user) {
      const linkRef = doc(db, 'users', user.uid, 'links', linkId);
      await deleteDoc(linkRef);
    }
    setDeleteConfirmationId(null);
    setIsSyncing(false);
  };

  const handleToggleFavorite = async (link: SavedLink) => {
    const updatedList = links.map((l) =>
      l.id === link.id ? { ...l, isFavorite: !l.isFavorite, updatedAt: Date.now() } : l
    );
    setLinks(updatedList);
    saveLocalLinks(updatedList);

    if (user) {
      const linkRef = doc(db, 'users', user.uid, 'links', link.id);
      await updateDoc(linkRef, {
        isFavorite: !link.isFavorite,
        updatedAt: Date.now(),
      });
    }
  };

  const handleOpenLink = async (link: SavedLink) => {
    const updatedList = links.map((l) =>
      l.id === link.id
        ? {
            ...l,
            clickCount: (l.clickCount || 0) + 1,
            lastVisitedAt: Date.now(),
          }
        : l
    );
    setLinks(updatedList);
    saveLocalLinks(updatedList);

    if (user) {
      const linkRef = doc(db, 'users', user.uid, 'links', link.id);
      await updateDoc(linkRef, {
        clickCount: (link.clickCount || 0) + 1,
        lastVisitedAt: Date.now(),
      });
    }
  };

  const handleSaveCategory = async (
    categoryData: Omit<Category, 'id' | 'createdAt'> & { id?: string }
  ) => {
    setIsSyncing(true);
    if (editingCategory) {
      const updatedCategory: Category = {
        ...editingCategory,
        ...categoryData,
      };
      const updatedList = categories.map((c) =>
        c.slug === editingCategory.slug ? updatedCategory : c
      );
      setCategories(updatedList);
      saveLocalCategories(updatedList);

      if (user) {
        const catRef = doc(db, 'users', user.uid, 'categories', editingCategory.slug);
        await setDoc(catRef, updatedCategory);
      }
    } else {
      const newCategory: Category = {
        ...categoryData,
        id: categoryData.slug,
        createdAt: Date.now(),
      };
      const updatedList = [...categories, newCategory];
      setCategories(updatedList);
      saveLocalCategories(updatedList);

      if (user) {
        const catRef = doc(db, 'users', user.uid, 'categories', categoryData.slug);
        await setDoc(catRef, newCategory);
      }
    }
    setEditingCategory(null);
    setIsSyncing(false);
  };

  const handleDeleteCategory = async (categorySlug: string) => {
    setIsSyncing(true);
    const updatedList = categories.filter((c) => c.slug !== categorySlug);
    setCategories(updatedList);
    saveLocalCategories(updatedList);

    if (user) {
      const catRef = doc(db, 'users', user.uid, 'categories', categorySlug);
      await deleteDoc(catRef);
    }
    if (selectedCategory === categorySlug) {
      setSelectedCategory('all');
    }
    setEditingCategory(null);
    setIsSyncing(false);
  };

  const handleRequestDeleteCategory = (category: Category) => {
    setCategoryToDelete(category);
    setIsDeleteCategoryModalOpen(true);
  };

  const handleConfirmDeleteCategory = async (categorySlug: string) => {
    await handleDeleteCategory(categorySlug);
    setCategoryToDelete(null);
    setIsDeleteCategoryModalOpen(false);
  };

  const handleToggleCategoryPrivacy = async (categorySlug: string) => {
    const target = categories.find((c) => c.slug === categorySlug);
    if (!target) return;
    setIsSyncing(true);
    const updatedCategory: Category = {
      ...target,
      hideFromAll: !target.hideFromAll,
    };
    const updatedList = categories.map((c) =>
      c.slug === categorySlug ? updatedCategory : c
    );
    setCategories(updatedList);
    saveLocalCategories(updatedList);

    if (user) {
      const catRef = doc(db, 'users', user.uid, 'categories', categorySlug);
      await setDoc(catRef, updatedCategory);
    }
    setIsSyncing(false);
  };

  // Category Auto-Scroll & Real-Time Reorder Handlers
  const startAutoScroll = () => {
    if (autoScrollRafRef.current !== null) return;
    const loop = () => {
      if (categoriesScrollRef.current && autoScrollSpeedRef.current !== 0) {
        categoriesScrollRef.current.scrollLeft += autoScrollSpeedRef.current;
      }
      autoScrollRafRef.current = requestAnimationFrame(loop);
    };
    autoScrollRafRef.current = requestAnimationFrame(loop);
  };

  const stopAutoScroll = () => {
    autoScrollSpeedRef.current = 0;
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    setActiveDraggingCatSlug(null);
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesScrollRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      categoriesScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Reorder list handler (called in real time by Reorder.Group for physical fluid motion)
  const handleReorderCategoriesList = (newCategories: Category[]) => {
    const reindexed = newCategories.map((cat, idx) => ({
      ...cat,
      order: idx,
    }));
    setCategories(reindexed);
    saveLocalCategories(reindexed);
  };

  // Commit final category order to cloud when drag gesture finishes
  const commitCategoryOrderToCloud = (finalCategories: Category[]) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      finalCategories.forEach((cat, idx) => {
        const catRef = doc(db, 'users', user.uid, 'categories', cat.slug);
        batch.set(catRef, { order: idx }, { merge: true });
      });
      batch.commit().catch((err) => {
        console.error('Failed to sync category order to Firestore:', err);
      });
    } catch (err) {
      console.error('Failed to batch update category order in Firestore:', err);
    }
  };

  // Safety cleanup for category drag auto-scroll
  useEffect(() => {
    const handlePointerUp = () => {
      if (autoScrollRafRef.current !== null) {
        stopAutoScroll();
      }
    };
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);
    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
      }
    };
  }, []);

  // QR Share and Launch Option Handlers
  const handleOpenQrShareForCategory = (category: Category) => {
    setQrShareCategory(category);
    setQrShareLink(null);
    setIsQrShareModalOpen(true);
  };

  const handleOpenQrShareForLink = (link: SavedLink) => {
    const cat = categories.find((c) => c.slug === link.categorySlug);
    setQrShareCategory(cat || null);
    setQrShareLink(link);
    setIsQrShareModalOpen(true);
  };

  const handleOpenLaunchOptions = (link: SavedLink) => {
    setLinkToOpen(link);
    setIsOpenLinkModalOpen(true);
  };

  // Helper to ensure objects written to Firestore never contain undefined values
  const cleanForFirestore = <T extends Record<string, any>>(obj: T): T => {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          cleaned[key] = cleanForFirestore(val);
        } else {
          cleaned[key] = val;
        }
      }
    }
    return cleaned;
  };

  // Handler for importing a shared category and its links
  const handleImportCategoryAndLinks = async (
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
  ) => {
    setIsSyncing(true);

    // 1. Save or update category record (preserves private setting hideFromAll!)
    const safeSlug =
      categoryData.slug ||
      categoryData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
      `cat-${Date.now()}`;

    const existingCat = categories.find(
      (c) => c.slug === safeSlug || isLinkInCategory(c.slug, { slug: safeSlug, name: categoryData.name })
    );

    const categoryRecord: Category = {
      id: safeSlug,
      name: categoryData.name || 'Shared Category',
      slug: safeSlug,
      icon: categoryData.icon || 'Bookmark',
      color: categoryData.color || '#4f46e5',
      hideFromAll: Boolean(categoryData.hideFromAll),
      description: categoryData.description || '',
      createdAt: existingCat?.createdAt || Date.now(),
    };

    let updatedCategories: Category[];
    if (existingCat) {
      updatedCategories = categories.map((c) =>
        c.slug === existingCat.slug ? categoryRecord : c
      );
    } else {
      updatedCategories = [...categories, categoryRecord];
    }
    setCategories(updatedCategories);
    saveLocalCategories(updatedCategories);

    if (user) {
      try {
        const catRef = doc(db, 'users', user.uid, 'categories', categoryRecord.slug);
        await setDoc(catRef, cleanForFirestore(categoryRecord));
      } catch (err) {
        console.error('Failed to sync imported category to Firestore:', err);
      }
    }

    // 2. Prepare imported links
    // Check for duplicate URLs within THIS category using clean URL normalization
    const existingInThisCategory = new Set(
      links
        .filter((l) => isLinkInCategory(l.categorySlug, categoryRecord))
        .map((l) => (l.url || '').trim().toLowerCase().replace(/\/+$/, ''))
    );

    const newSavedLinks: SavedLink[] = [];
    const incomingLinks = Array.isArray(linksToImport) ? linksToImport : [];

    incomingLinks.forEach((item, idx) => {
      const rawUrl = (item.url || '').trim();
      const normalizedUrl = rawUrl.toLowerCase().replace(/\/+$/, '');
      if (rawUrl && !existingInThisCategory.has(normalizedUrl)) {
        const newId = user
          ? doc(collection(db, 'users', user.uid, 'links')).id
          : `imported-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;

        newSavedLinks.push({
          id: newId,
          title: item.title || rawUrl,
          url: rawUrl,
          categorySlug: categoryRecord.slug,
          description: item.description || '',
          tags: Array.isArray(item.tags) ? item.tags : [],
          imageUrl: item.imageUrl || '',
          faviconUrl: item.faviconUrl || getFaviconUrl(rawUrl),
          isFavorite: Boolean(item.isFavorite),
          clickCount: 0,
          createdAt: Date.now() + idx,
          updatedAt: Date.now() + idx,
        });
        existingInThisCategory.add(normalizedUrl);
      }
    });

    const mergedLinks = [...newSavedLinks, ...links];
    setLinks(mergedLinks);
    saveLocalLinks(mergedLinks);

    if (user && newSavedLinks.length > 0) {
      try {
        // Use writeBatch for atomic and rapid syncing of large category links
        const BATCH_SIZE = 400;
        for (let i = 0; i < newSavedLinks.length; i += BATCH_SIZE) {
          const chunk = newSavedLinks.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          for (const l of chunk) {
            const linkRef = doc(db, 'users', user.uid, 'links', l.id);
            batch.set(linkRef, cleanForFirestore(l));
          }
          await batch.commit();
        }
      } catch (err) {
        console.error('Failed to sync imported links to Firestore:', err);
      }
    }

    // Automatically navigate to this category so user sees all imported links immediately!
    setSelectedCategory(categoryRecord.slug);
    setSearchQuery('');
    setSelectedTag(null);
    setIsSyncing(false);

    if (newSavedLinks.length > 0) {
      setImportSuccessMessage(
        `Successfully saved "${categoryRecord.name}" with ${newSavedLinks.length} ${
          newSavedLinks.length === 1 ? 'link' : 'links'
        }! ${categoryRecord.hideFromAll ? '(Private category: visible in this tab)' : ''}`
      );
    } else if (incomingLinks.length > 0) {
      setImportSuccessMessage(
        `Category "${categoryRecord.name}" updated! All ${incomingLinks.length} links are already in this category.`
      );
    } else {
      setImportSuccessMessage(
        `Category folder "${categoryRecord.name}" saved to your vault!`
      );
    }
    setTimeout(() => setImportSuccessMessage(null), 7000);
  };

  // Handler for importing an individual link
  const handleImportSingleLink = async (linkData: {
    title: string;
    url: string;
    categorySlug: string;
    description?: string;
    tags?: string[];
    imageUrl?: string;
    faviconUrl?: string;
    isFavorite?: boolean;
  }) => {
    setIsSyncing(true);
    const rawUrl = (linkData.url || '').trim();

    // Check if duplicate in the same category
    const targetCat = categories.find(
      (c) => c.slug === (linkData.categorySlug || 'general')
    ) || {
      slug: linkData.categorySlug || 'general',
      name: linkData.categorySlug || 'general',
    };
    const duplicateInThisCategory = links.find(
      (l) => isLinkInCategory(l.categorySlug, targetCat) && isSameUrl(l.url, rawUrl)
    );
    if (duplicateInThisCategory) {
      setIsSyncing(false);
      const catName =
        categories.find((c) => isLinkInCategory(c.slug, targetCat))?.name ||
        targetCat.name;
      setImportSuccessMessage(
        `Link already exists in "${catName}" category. Skipped duplicate entry.`
      );
      setTimeout(() => setImportSuccessMessage(null), 5000);
      return;
    }

    const newId = user
      ? doc(collection(db, 'users', user.uid, 'links')).id
      : `imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newLink: SavedLink = {
      id: newId,
      title: linkData.title || rawUrl,
      url: rawUrl,
      categorySlug: linkData.categorySlug || 'general',
      description: linkData.description || '',
      tags: Array.isArray(linkData.tags) ? linkData.tags : [],
      imageUrl: linkData.imageUrl || '',
      faviconUrl: linkData.faviconUrl || getFaviconUrl(rawUrl),
      isFavorite: Boolean(linkData.isFavorite),
      clickCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedLinks = [newLink, ...links];
    setLinks(updatedLinks);
    saveLocalLinks(updatedLinks);

    if (user) {
      try {
        const linkRef = doc(db, 'users', user.uid, 'links', newLink.id);
        await setDoc(linkRef, cleanForFirestore(newLink));
      } catch (err) {
        console.error('Failed to sync imported link to Firestore:', err);
      }
    }

    setSelectedCategory(newLink.categorySlug);
    setSearchQuery('');
    setSelectedTag(null);
    setIsSyncing(false);
    setImportSuccessMessage(`Saved link "${newLink.title}" to your vault!`);
    setTimeout(() => setImportSuccessMessage(null), 5000);
  };

  const handleImportLinks = async (importedLinks: SavedLink[]) => {
    setIsSyncing(true);
    const cleaned = importedLinks.map((item, idx) => ({
      ...item,
      id: item.id || `imported_${Date.now()}_${idx}`,
      createdAt: item.createdAt || Date.now(),
      updatedAt: Date.now(),
    }));

    // Prevent duplicate entries in the same category while allowing them across different categories
    const existingKeys = new Set(
      links.map(
        (l) => `${(l.categorySlug || '').toLowerCase()}::${normalizeUrlForComparison(l.url)}`
      )
    );
    const nonDuplicates: SavedLink[] = [];
    for (const item of cleaned) {
      const key = `${(item.categorySlug || '').toLowerCase()}::${normalizeUrlForComparison(item.url)}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        nonDuplicates.push(item);
      }
    }

    const updated = [...nonDuplicates, ...links];
    setLinks(updated);
    saveLocalLinks(updated);

    if (user) {
      const linksColRef = collection(db, 'users', user.uid, 'links');
      for (const item of nonDuplicates) {
        const newRef = doc(linksColRef, item.id);
        await setDoc(newRef, item);
      }
    }
    setIsSyncing(false);
  };

  const handleConfirmBulkImport = async (
    linksToImport: Array<{
      title: string;
      url: string;
      categorySlug: string;
      description?: string;
      tags: string[];
      isFavorite?: boolean;
    }>,
    newCategoriesToCreate: Category[]
  ) => {
    setIsSyncing(true);

    // 1. Create any newly detected categories first
    let currentCategories = [...categories];
    if (newCategoriesToCreate.length > 0) {
      const existingSlugs = new Set(currentCategories.map((c) => c.slug.toLowerCase()));
      const categoriesToAdd = newCategoriesToCreate.filter(
        (c) => !existingSlugs.has(c.slug.toLowerCase())
      );

      if (categoriesToAdd.length > 0) {
        currentCategories = [...currentCategories, ...categoriesToAdd];
        setCategories(currentCategories);
        saveLocalCategories(currentCategories);

        if (user) {
          for (const cat of categoriesToAdd) {
            const catRef = doc(db, 'users', user.uid, 'categories', cat.slug);
            await setDoc(catRef, cat);
          }
        }
      }
    }

    // 2. Prepare and clean links
    const cleanedLinks: SavedLink[] = linksToImport.map((item, idx) => ({
      id: `imported_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      title: item.title,
      url: item.url,
      categorySlug: item.categorySlug,
      description: item.description,
      tags: item.tags || [],
      isFavorite: Boolean(item.isFavorite),
      clickCount: 0,
      createdAt: Date.now() - (linksToImport.length - idx) * 50,
      updatedAt: Date.now(),
      faviconUrl: getFaviconUrl(item.url),
    }));

    // Prevent duplicate entries in the same category
    const existingKeys = new Set(
      links.map(
        (l) => `${(l.categorySlug || '').toLowerCase()}::${normalizeUrlForComparison(l.url)}`
      )
    );
    const nonDuplicates: SavedLink[] = [];
    for (const item of cleanedLinks) {
      const key = `${(item.categorySlug || '').toLowerCase()}::${normalizeUrlForComparison(item.url)}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        nonDuplicates.push(item);
      }
    }

    const updated = [...nonDuplicates, ...links];
    setLinks(updated);
    saveLocalLinks(updated);

    // Save to Firestore if logged in
    if (user) {
      const linksColRef = collection(db, 'users', user.uid, 'links');
      for (const item of nonDuplicates) {
        const newRef = doc(linksColRef, item.id);
        await setDoc(newRef, item);
      }
    }

    setIsSyncing(false);

    // Feedback message
    const categoryNotice =
      newCategoriesToCreate.length > 0
        ? ` and created ${newCategoriesToCreate.length} new ${
            newCategoriesToCreate.length === 1 ? 'category' : 'categories'
          }`
        : '';
    setImportSuccessMessage(
      `Successfully imported ${nonDuplicates.length} ${
        nonDuplicates.length === 1 ? 'link' : 'links'
      }${categoryNotice}!`
    );
    setTimeout(() => setImportSuccessMessage(null), 5000);
  };

  // Handler for Exporting all links as a formatted PDF backup (Title then URL)
  const handleExportPdfBackup = () => {
    if (links.length === 0) {
      setImportSuccessMessage('No links found in your vault to export! Add some links first.');
      setTimeout(() => setImportSuccessMessage(null), 4000);
      return;
    }

    const currentCategoryObj = categories.find(
      (c) => c.slug === selectedCategory || c.id === selectedCategory
    );
    const result = exportLinksToPdf(links, categories, {
      vaultName: 'Link Vault — Backup',
      categoryName:
        selectedCategory !== 'all' && selectedCategory !== 'favorites' && currentCategoryObj
          ? currentCategoryObj.name
          : undefined,
    });

    if (result.success) {
      setImportSuccessMessage(
        `Exported ${result.count} links to "${result.filename}" automatically!`
      );
      setTimeout(() => setImportSuccessMessage(null), 5000);
    } else {
      setImportSuccessMessage(`Export failed: ${result.error || 'Unknown error'}`);
      setTimeout(() => setImportSuccessMessage(null), 5000);
    }
  };

  // PIN Protection Handlers
  const handlePinConfigured = async (
    newPinHash: string,
    newSecurityQuestion?: string,
    newSecurityAnswerHash?: string
  ) => {
    setStoredPinHash(newPinHash);
    setHasPinSet(true);
    setIsLocked(false);
    localStorage.setItem('link_vault_pin_hash', newPinHash);

    const questionToSave = newSecurityQuestion || securityQuestion;
    const answerHashToSave = newSecurityAnswerHash || securityAnswerHash;

    if (newSecurityQuestion) {
      setSecurityQuestion(newSecurityQuestion);
      localStorage.setItem('link_vault_sec_question', newSecurityQuestion);
    }
    if (newSecurityAnswerHash) {
      setSecurityAnswerHash(newSecurityAnswerHash);
      localStorage.setItem('link_vault_sec_answer_hash', newSecurityAnswerHash);
    }

    if (user) {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          pinHash: newPinHash,
          pinEnabled: true,
          pinUpdatedAt: Date.now(),
          ...(questionToSave ? { securityQuestion: questionToSave } : {}),
          ...(answerHashToSave ? { securityAnswerHash: answerHashToSave } : {}),
        },
        { merge: true }
      );
    }
  };

  const handleUpdateSecurityQuestion = async (
    question: string,
    answerHash: string
  ) => {
    setSecurityQuestion(question);
    setSecurityAnswerHash(answerHash);
    localStorage.setItem('link_vault_sec_question', question);
    localStorage.setItem('link_vault_sec_answer_hash', answerHash);

    if (user) {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          securityQuestion: question,
          securityAnswerHash: answerHash,
          securityUpdatedAt: Date.now(),
        },
        { merge: true }
      );
    }
  };

  const handleResetPin = async () => {
    setStoredPinHash(null);
    setHasPinSet(false);
    setIsLocked(false);
    setSecurityQuestion(null);
    setSecurityAnswerHash(null);
    localStorage.removeItem('link_vault_pin_hash');
    localStorage.removeItem('link_vault_sec_question');
    localStorage.removeItem('link_vault_sec_answer_hash');
    if (user) {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          pinHash: null,
          pinEnabled: false,
          pinUpdatedAt: Date.now(),
          securityQuestion: null,
          securityAnswerHash: null,
        },
        { merge: true }
      );
    }
  };

  const handleLockVault = () => {
    setIsLocked(true);
    window.scrollTo(0, 0);
  };

  const handleChangePin = () => {
    setHasPinSet(false);
    setIsLocked(true);
  };

  // Map of categories by slug for fast lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) {
      map.set(c.slug, c);
    }
    return map;
  }, [categories]);

  // Count of links belonging to private categories (hidden from All Links)
  const hiddenInAllCount = useMemo(() => {
    return links.filter((l) => {
      const cat = categoryMap.get(l.categorySlug) || categories.find((c) => isLinkInCategory(l.categorySlug, c));
      return Boolean(cat?.hideFromAll);
    }).length;
  }, [links, categoryMap, categories]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const visibleInAll = links.filter((l) => {
      const cat = categoryMap.get(l.categorySlug) || categories.find((c) => isLinkInCategory(l.categorySlug, c));
      return !cat?.hideFromAll;
    }).length;

    const counts: Record<string, number> = {
      all: visibleInAll,
      favorites: links.filter((l) => {
        const cat = categoryMap.get(l.categorySlug) || categories.find((c) => isLinkInCategory(l.categorySlug, c));
        // Exclude private categories from the public Favorites list
        return l.isFavorite && !cat?.hideFromAll;
      }).length,
    };
    for (const cat of categories) {
      counts[cat.slug] = links.filter((l) => isLinkInCategory(l.categorySlug, cat)).length;
    }
    return counts;
  }, [links, categories, categoryMap]);

  // Filtered & Sorted links
  const filteredLinks = useMemo(() => {
    return links
      .filter((link) => {
        // Category filter
        if (selectedCategory === 'favorites') {
          if (!link.isFavorite) return false;
          // Never show links from private categories in the public favorites view
          const cat = categoryMap.get(link.categorySlug) || categories.find((c) => isLinkInCategory(link.categorySlug, c));
          if (cat?.hideFromAll) return false;
        } else if (selectedCategory === 'all') {
          // Exclude links in private categories that are marked as hidden from All Links
          const cat = categoryMap.get(link.categorySlug) || categories.find((c) => isLinkInCategory(link.categorySlug, c));
          if (cat?.hideFromAll) return false;
        } else {
          const activeCategory = categoryMap.get(selectedCategory) || categories.find((c) => isLinkInCategory(c.slug, { slug: selectedCategory }));
          if (!isLinkInCategory(link.categorySlug, activeCategory || { slug: selectedCategory })) return false;
        }

        // Tag filter
        if (selectedTag) {
          if (!link.tags?.includes(selectedTag)) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = link.title.toLowerCase().includes(q);
          const matchUrl = link.url.toLowerCase().includes(q);
          const matchDesc = link.description?.toLowerCase().includes(q);
          const matchTags = link.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchUrl && !matchDesc && !matchTags) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return b.createdAt - a.createdAt;
        if (sortBy === 'oldest') return a.createdAt - b.createdAt;
        if (sortBy === 'clicks') return (b.clickCount || 0) - (a.clickCount || 0);
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return 0;
      });
  }, [links, selectedCategory, selectedTag, searchQuery, sortBy, categoryMap]);

  // Category order mapping for directional transition calculation
  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    map.set('all', 0);
    map.set('favorites', 1);
    categories.forEach((cat, idx) => {
      map.set(cat.slug, idx + 2);
    });
    return map;
  }, [categories]);

  // Synchronously compute transition direction when switching categories
  const [prevCategoryForAnim, setPrevCategoryForAnim] = useState(selectedCategory);
  const [slideDirection, setSlideDirection] = useState(1);

  if (selectedCategory !== prevCategoryForAnim) {
    setPrevCategoryForAnim(selectedCategory);
    const prevIdx = categoryOrderMap.get(prevCategoryForAnim) ?? 0;
    const currentIdx = categoryOrderMap.get(selectedCategory) ?? 0;
    setSlideDirection(currentIdx >= prevIdx ? 1 : -1);
  }

  // Smooth slide-in animation variants for category transitions
  const linksContainerVariants = {
    enter: (direction: number) => ({
      x: direction >= 0 ? 18 : -18,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.22,
        ease: [0.16, 1, 0.3, 1],
      },
    },
    exit: (direction: number) => ({
      x: direction >= 0 ? -14 : 14,
      opacity: 0,
      transition: {
        duration: 0.14,
        ease: 'easeIn',
      },
    }),
  };

  return (
    <div
      className="min-h-screen bg-[#F3F7FC] dark:bg-[#070B14] text-[#0F172A] dark:text-[#F1F5F9] flex flex-col font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-700 dark:selection:text-cyan-300 transition-colors duration-300 relative overflow-x-hidden"
    >
      {/* Main Vault Content (smoothly animated with framer-motion when toggling isLocked) */}
      <AnimatePresence mode="wait">
        {!isLocked && (
          <motion.div
            key="vault-main-content"
            id="vault-main-content"
            initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
            transition={{ duration: 0.32, ease: 'easeInOut' }}
            className="flex-col flex-1 flex"
          >
        {/* Subtle Futuristic Ambient Glow (CSS only, high performance) */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-400/5 dark:bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/4 -right-40 w-96 h-96 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full bg-blue-500/5 dark:bg-blue-500/8 blur-3xl pointer-events-none" />
      </div>

      {/* Top Application Header */}
      <header
        id="app-header"
        className="sticky top-0 z-30 bg-white/90 dark:bg-[#070B14]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors duration-300 relative"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-xs shadow-cyan-500/20 shrink-0 border border-blue-500/30 dark:border-cyan-500/30 flex items-center justify-center bg-[#0D1422]">
                <img
                  src="/icon.svg"
                  alt="Link Vault Icon"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="font-extrabold text-sm sm:text-base md:text-lg text-[#0F172A] dark:text-[#F1F5F9] font-display tracking-tight leading-none whitespace-nowrap">
                    Link Vault
                  </h1>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300 border border-blue-200/60 dark:border-blue-800/60">
                    Cloud Sync
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] hidden sm:block">
                  Important links categorized across all your devices
                </p>
              </div>
            </div>

            {/* Quick Search */}
            <div className="flex-1 max-w-md hidden md:block">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="global-search-input"
                  type="text"
                  placeholder="Search by title, URL, tag, or note..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-100/80 hover:bg-slate-100 focus:bg-white dark:bg-[#111B2E]/90 dark:hover:bg-[#111B2E] dark:focus:bg-[#0D1422] border border-slate-200/80 dark:border-slate-800 focus:border-blue-500 dark:focus:border-cyan-400 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 transition-all text-[#0F172A] dark:text-[#F1F5F9] placeholder-slate-400 dark:placeholder-slate-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Day / Night Theme Toggle */}
              <button
                type="button"
                id="theme-toggle-btn"
                onClick={toggleTheme}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0D1422] hover:bg-slate-50 dark:hover:bg-[#111B2E] transition-all duration-200 text-xs text-slate-700 dark:text-slate-200 shadow-2xs font-medium shrink-0 group cursor-pointer"
                title={theme === 'dark' ? 'Switch to Day Mode (6:00 AM - 5:59 PM)' : 'Switch to Night Mode (6:00 PM - 5:59 AM)'}
                aria-label={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
              >
                {theme === 'dark' ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-cyan-400 shrink-0 transition-transform duration-200 group-hover:-rotate-12" />
                    <span className="hidden sm:inline text-xs font-semibold text-cyan-400">Night</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0 transition-transform duration-200 group-hover:rotate-45" />
                    <span className="hidden sm:inline text-xs font-semibold text-amber-600">Day</span>
                  </>
                )}
              </button>

              {/* PDF Backup Export Button */}
              <button
                type="button"
                id="export-pdf-header-btn"
                onClick={handleExportPdfBackup}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0D1422] hover:bg-slate-50 dark:hover:bg-[#111B2E] transition-all text-xs text-slate-700 dark:text-slate-200 shadow-2xs font-medium shrink-0 cursor-pointer"
                title="Export all links as PDF backup (Title then URL)"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {/* Scan QR Code Button */}
              <button
                type="button"
                id="scan-qr-header-btn"
                onClick={() => setIsQrScannerOpen(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-blue-200/80 dark:border-blue-900/60 hover:border-blue-300 dark:hover:border-blue-700 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 transition-all text-xs text-blue-700 dark:text-cyan-300 shadow-2xs font-semibold shrink-0"
                title="Scan QR Code from phone camera or upload QR screenshot"
              >
                <QrCode className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                <span className="hidden sm:inline">Scan QR</span>
              </button>

              {/* Lock Vault / Set PIN Button */}
              <button
                type="button"
                id="lock-vault-header-btn"
                onClick={hasPinSet ? handleLockVault : handleChangePin}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0D1422] hover:bg-slate-50 dark:hover:bg-[#111B2E] transition-all text-xs text-slate-700 dark:text-slate-200 shadow-2xs font-medium shrink-0"
                title={hasPinSet ? 'Lock Vault with 6-digit PIN' : 'Set 6-digit Security PIN'}
              >
                <Lock className={`w-3.5 h-3.5 shrink-0 ${hasPinSet ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="hidden md:inline">{hasPinSet ? 'Lock Vault' : 'Set PIN'}</span>
              </button>

              {/* Top-Right User Email & Sign In Widget */}
              <TopRightAuthWidget
                user={user}
                authInitialized={authInitialized}
                onOpenSyncModal={() => setIsSyncModalOpen(true)}
              />

              {/* Add Link Button */}
              <button
                id="add-link-header-btn"
                onClick={() => {
                  setEditingLink(null);
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 dark:from-blue-500 dark:to-cyan-500 dark:hover:from-blue-600 dark:hover:to-cyan-600 text-white rounded-xl text-xs font-semibold shadow-xs shadow-blue-500/20 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Link</span>
              </button>
            </div>
          </div>

          {/* Mobile Search Bar (Visible on mobile only) */}
          <div className="pb-3 md:hidden">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="mobile-search-input"
                type="text"
                placeholder="Search links, tags, URLs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-100 dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 text-[#0F172A] dark:text-[#F1F5F9] placeholder-slate-400 dark:placeholder-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col gap-6 relative z-10">
        {/* Category Filter Bar */}
        <section id="category-filter-section" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Categories
              </h2>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                ({categories.length})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollCategories('left')}
                className="p-1.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0D1422] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                title="Scroll categories left"
                aria-label="Scroll categories left"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollCategories('right')}
                className="p-1.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0D1422] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                title="Scroll categories right"
                aria-label="Scroll categories right"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                id="new-category-btn"
                onClick={() => {
                  setEditingCategory(null);
                  setIsCategoryModalOpen(true);
                }}
                className="text-xs text-blue-600 dark:text-cyan-400 hover:text-blue-800 dark:hover:text-cyan-300 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer pl-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Category</span>
              </button>
            </div>
          </div>

          {/* Category Pills List with Fluid Tab Drag-and-Drop & Auto Horizontal Scrolling */}
          <div
            id="categories-tabs-scroll-container"
            ref={categoriesScrollRef}
            className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin select-none relative touch-pan-x"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* All Links Pill (Static) */}
            <button
              id="filter-category-all-btn"
              onClick={() => setSelectedCategory('all')}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#0D1422] border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#111B2E]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Links</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  selectedCategory === 'all'
                    ? 'bg-slate-800 dark:bg-blue-700 text-slate-200'
                    : 'bg-slate-100 dark:bg-[#111B2E] text-slate-600 dark:text-slate-300'
                }`}
              >
                {categoryCounts.all || 0}
              </span>
            </button>

            {/* Starred / Favorites (Static) */}
            <button
              id="filter-category-favorites-btn"
              onClick={() => setSelectedCategory('favorites')}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'favorites'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white dark:bg-[#0D1422] border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#111B2E]'
              }`}
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  selectedCategory === 'favorites' ? 'fill-white' : 'text-amber-500 fill-amber-500'
                }`}
              />
              <span>Starred</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  selectedCategory === 'favorites'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-[#111B2E] text-slate-600 dark:text-slate-300'
                }`}
              >
                {categoryCounts.favorites || 0}
              </span>
            </button>

            {/* Reorderable Custom Category Tabs (Reorder.Group for physical fluid motion) */}
            <Reorder.Group
              as="div"
              axis="x"
              values={categories}
              onReorder={handleReorderCategoriesList}
              className="flex items-center gap-2 shrink-0 touch-pan-x"
            >
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.slug;
                const count = categoryCounts[cat.slug] || 0;
                const isDraggingThis = activeDraggingCatSlug === cat.slug;

                return (
                  <CategoryTabItem
                    key={cat.slug}
                    cat={cat}
                    isSelected={isSelected}
                    count={count}
                    isDraggingThis={isDraggingThis}
                    theme={theme}
                    categoriesScrollRef={categoriesScrollRef}
                    categoriesRef={categoriesRef}
                    autoScrollSpeedRef={autoScrollSpeedRef}
                    startAutoScroll={startAutoScroll}
                    stopAutoScroll={stopAutoScroll}
                    setActiveDraggingCatSlug={setActiveDraggingCatSlug}
                    commitCategoryOrderToCloud={commitCategoryOrderToCloud}
                    onSelectCategory={setSelectedCategory}
                    onEditCategory={(c) => {
                      setEditingCategory(c);
                      setIsCategoryModalOpen(true);
                    }}
                    onShareCategory={handleOpenQrShareForCategory}
                    onRequestDeleteCategory={handleRequestDeleteCategory}
                  />
                );
              })}
            </Reorder.Group>
          </div>
        </section>

        {/* Controls Toolbar: Active filter tags, Sort, View mode */}
        <section id="toolbar-section" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
          {/* Active Filter Indicators */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Showing {filteredLinks.length} {filteredLinks.length === 1 ? 'link' : 'links'}
              {selectedCategory === 'all' && hiddenInAllCount > 0 && (
                <span className="ml-1 text-slate-400 dark:text-slate-500 font-normal inline-flex items-center gap-1">
                  (<EyeOff className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {hiddenInAllCount} in private {hiddenInAllCount === 1 ? 'category' : 'categories'} hidden)
                </span>
              )}
            </span>

            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-cyan-300 text-xs font-medium">
                <span className="truncate max-w-[140px] sm:max-w-none">
                  Category: {selectedCategory === 'favorites' ? 'Starred' : categoryMap.get(selectedCategory)?.name || selectedCategory}
                </span>
                {categoryMap.get(selectedCategory)?.hideFromAll && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-cyan-200 font-semibold px-1.5 py-0.5 rounded shrink-0">
                    <EyeOff className="w-2.5 h-2.5" /> Private
                  </span>
                )}
                {selectedCategory !== 'favorites' && categoryMap.get(selectedCategory) && (
                  <button
                    type="button"
                    onClick={() => {
                      const cat = categoryMap.get(selectedCategory);
                      if (cat) {
                        setEditingCategory(cat);
                        setIsCategoryModalOpen(true);
                      }
                    }}
                    className="hover:text-blue-900 dark:hover:text-cyan-100 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shrink-0"
                    title="Edit category settings & privacy"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="hover:text-blue-900 dark:hover:text-cyan-100 ml-0.5 shrink-0"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedTag && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-[#111B2E] text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-800 text-xs font-medium shrink-0">
                <span>Tag: #{selectedTag}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className="hover:text-slate-900 dark:hover:text-white ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-[#111B2E] text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-800 text-xs font-medium shrink-0">
                <span className="truncate max-w-[140px] sm:max-w-none">Search: &ldquo;{searchQuery}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-slate-900 dark:hover:text-white ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {/* Sort and View Mode */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto shrink-0">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0D1422] border border-slate-200/90 dark:border-slate-800 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer [&>option]:bg-white [&>option]:text-slate-800 dark:[&>option]:bg-[#0D1422] dark:[&>option]:text-slate-200"
              >
                <option value="newest">Recently Added</option>
                <option value="oldest">Oldest First</option>
                <option value="clicks">Most Visited</option>
                <option value="title">Alphabetical (A-Z)</option>
              </select>
            </div>

            {/* Grid vs List View */}
            <div className="flex items-center bg-white dark:bg-[#0D1422] border border-slate-200/90 dark:border-slate-800 rounded-xl p-0.5 shadow-2xs shrink-0">
              <button
                type="button"
                id="view-grid-btn"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-slate-100 dark:bg-[#111B2E] text-slate-900 dark:text-cyan-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                id="view-list-btn"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-slate-100 dark:bg-[#111B2E] text-slate-900 dark:text-cyan-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="List View"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Private Category Info Banner */}
        <AnimatePresence mode="wait">
          {selectedCategory !== 'all' && selectedCategory !== 'favorites' && categoryMap.get(selectedCategory)?.hideFromAll && (
            <motion.div
              key={`private-banner-${selectedCategory}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-blue-50/80 dark:bg-[#0D1422] border border-blue-200/80 dark:border-blue-900/40 text-xs text-blue-950 dark:text-blue-100 shadow-2xs"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-cyan-600 text-white flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                  <EyeOff className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold flex items-center gap-2 flex-wrap">
                    <span>Private Category: {categoryMap.get(selectedCategory)?.name}</span>
                    <span className="text-[10px] bg-blue-200/70 dark:bg-blue-900/60 text-blue-900 dark:text-cyan-200 px-1.5 py-0.5 rounded font-semibold">
                      Hidden from All Links
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700/90 dark:text-blue-300/80 mt-0.5">
                    Links saved in this category are private and will not appear on the &quot;All Links&quot; page.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  id="share-category-qr-banner-btn"
                  onClick={() => {
                    const cat = categoryMap.get(selectedCategory);
                    if (cat) handleOpenQrShareForCategory(cat);
                  }}
                  className="px-2.5 py-1.5 bg-white dark:bg-[#111B2E] hover:bg-blue-50 dark:hover:bg-[#162238] border border-blue-200 dark:border-blue-800/70 rounded-lg text-blue-700 dark:text-cyan-300 font-semibold transition-colors text-xs inline-flex items-center gap-1.5"
                  title="Generate QR code to share this category and all its links"
                >
                  <QrCode className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                  <span>Share QR</span>
                </button>

                <button
                  type="button"
                  id="toggle-category-privacy-banner-btn"
                  onClick={() => handleToggleCategoryPrivacy(selectedCategory)}
                  className="px-2.5 py-1.5 bg-white dark:bg-[#111B2E] hover:bg-blue-50 dark:hover:bg-[#162238] border border-blue-200 dark:border-blue-800/70 rounded-lg text-blue-700 dark:text-cyan-300 font-semibold transition-colors text-xs"
                >
                  Make Public
                </button>
                <button
                  type="button"
                  id="edit-category-settings-banner-btn"
                  onClick={() => {
                    const cat = categoryMap.get(selectedCategory);
                    if (cat) {
                      setEditingCategory(cat);
                      setIsCategoryModalOpen(true);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-semibold transition-colors text-xs inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Settings2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Edit</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Links Grid or List with Subtle Directional Slide-in Animation */}
        <section id="links-container" className="flex-1 min-h-[300px] overflow-x-hidden">
          <AnimatePresence mode="wait" custom={slideDirection}>
            <motion.div
              key={selectedCategory}
              custom={slideDirection}
              variants={linksContainerVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full"
            >
              {filteredLinks.length === 0 ? (
                /* Empty State */
                <div
                  id="empty-links-state"
                  className="py-16 px-4 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-[#0D1422]/50 flex flex-col items-center justify-center max-w-lg mx-auto my-8"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-cyan-400 flex items-center justify-center mb-3">
                    <Bookmark className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F1F5F9] font-display">
                    {searchQuery || selectedTag || selectedCategory !== 'all'
                      ? 'No matching links found'
                      : 'Your link vault is empty'}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-sm">
                    {searchQuery || selectedTag || selectedCategory !== 'all'
                      ? 'Try clearing the search query or selecting a different category filter.'
                      : 'Start saving your favorite entertainment, study, and informational URLs with live cloud synchronization.'}
                  </p>
                  <div className="mt-5 flex gap-2">
                    {searchQuery || selectedTag || selectedCategory !== 'all' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedTag(null);
                          setSelectedCategory('all');
                        }}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#0D1422] border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-[#111B2E] transition-colors"
                      >
                        Reset Filters
                      </button>
                    ) : null}
                    <button
                      type="button"
                      id="empty-state-bulk-import-btn"
                      onClick={() => setIsBulkImportModalOpen(true)}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#0D1422] border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-[#111B2E] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                      <span>Import JSON / CSV</span>
                    </button>
                    <button
                      type="button"
                      id="empty-state-add-first-link-btn"
                      onClick={() => {
                        setEditingLink(null);
                        setIsAddModalOpen(true);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add First Link</span>
                    </button>
                  </div>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLinks.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      category={categoryMap.get(link.categorySlug)}
                      viewMode="grid"
                      onOpen={handleOpenLink}
                      onOpenOptions={handleOpenLaunchOptions}
                      onShareQr={handleOpenQrShareForLink}
                      onEdit={(l) => {
                        setEditingLink(l);
                        setIsAddModalOpen(true);
                      }}
                      onDelete={(id) => setDeleteConfirmationId(id)}
                      onToggleFavorite={handleToggleFavorite}
                      onSelectTag={(t) => setSelectedTag(t)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {filteredLinks.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      category={categoryMap.get(link.categorySlug)}
                      viewMode="list"
                      onOpen={handleOpenLink}
                      onOpenOptions={handleOpenLaunchOptions}
                      onShareQr={handleOpenQrShareForLink}
                      onEdit={(l) => {
                        setEditingLink(l);
                        setIsAddModalOpen(true);
                      }}
                      onDelete={(id) => setDeleteConfirmationId(id)}
                      onToggleFavorite={handleToggleFavorite}
                      onSelectTag={(t) => setSelectedTag(t)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Multi-Device Cloud Sync Banner */}
        <section
          id="cloud-sync-banner"
          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0D1B2E] via-[#0F1E36] to-[#0A111E] border border-blue-900/30 dark:border-slate-800/80 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-white font-display">
                Sync on your mobile phone and other computers
              </h3>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Open this app URL on any browser, sign in with your Google or Email account, and your links will be synced in real-time.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="open-sync-banner-btn"
            onClick={() => setIsSyncModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-white dark:bg-cyan-500 hover:bg-slate-100 dark:hover:bg-cyan-400 text-slate-900 dark:text-slate-950 font-semibold text-xs whitespace-nowrap transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            Pair / Link Device
          </button>
        </section>
      </main>

      {/* Engraved Footer */}
      <footer
        id="app-footer"
        className="w-full border-t border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-[#070B14]/40 backdrop-blur-xs py-6 mt-12 transition-colors duration-300 relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <p className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span>Made by</span>
            <span className="font-bold tracking-wider text-blue-700 dark:text-cyan-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/60 font-display">
              JITBHAI
            </span>
            <span>with</span>
            <span className="inline-block animate-pulse text-rose-500 text-sm leading-none" role="img" aria-label="love">
              ❤️
            </span>
            <span className="text-slate-500 dark:text-slate-400">and all rights reserved</span>
          </p>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} Link Vault · Fast, Private & Real-Time Sync
          </p>
        </div>
      </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div
          id="delete-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          onClick={() => setDeleteConfirmationId(null)}
        >
          <div
            id="delete-modal-container"
            className="bg-white dark:bg-[#0D1422] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Delete this saved link?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                This action will permanently remove this bookmark from your cloud vault across all connected devices.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmationId(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111B2E] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteLink(deleteConfirmationId)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer"
              >
                Delete Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Link Modal */}
      <AddEditLinkModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingLink(null);
        }}
        onSave={handleSaveLink}
        editingLink={editingLink}
        categories={categories}
        existingLinks={links}
        initialCategorySlug={
          selectedCategory !== 'all' && selectedCategory !== 'favorites'
            ? selectedCategory
            : undefined
        }
      />

      {/* Add / Edit Category Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSave={handleSaveCategory}
        existingCategories={categories}
        categoryToEdit={editingCategory}
        onDeleteCategory={handleDeleteCategory}
        onRequestDeleteCategory={handleRequestDeleteCategory}
      />

      {/* Delete Category Security Gate Modal (Requires App Lock PIN + Forgot Password Security Answer) */}
      <DeleteCategoryModal
        isOpen={isDeleteCategoryModalOpen}
        onClose={() => {
          setIsDeleteCategoryModalOpen(false);
          setCategoryToDelete(null);
        }}
        category={categoryToDelete}
        linkCount={
          categoryToDelete
            ? links.filter((l) => isLinkInCategory(l.categorySlug, categoryToDelete)).length
            : 0
        }
        onConfirmDelete={handleConfirmDeleteCategory}
        hasPinSet={hasPinSet}
        storedPinHash={storedPinHash}
        securityQuestion={securityQuestion}
        securityAnswerHash={securityAnswerHash}
        onOpenPinSetup={() => {
          setIsLocked(true);
        }}
        onOpenSecuritySettings={() => {
          setIsSyncModalOpen(true);
        }}
        onUpdateSecurityQuestion={handleUpdateSecurityQuestion}
      />

      {/* Multi-Device Cloud Sync Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        user={user}
        links={links}
        categories={categories}
        onImportLinks={handleImportLinks}
        isSyncing={isSyncing}
        hasPinSet={hasPinSet}
        securityQuestion={securityQuestion}
        onUpdateSecurityQuestion={handleUpdateSecurityQuestion}
        onLockNow={handleLockVault}
        onChangePin={handleChangePin}
        onRemovePin={handleResetPin}
        onOpenBulkImport={() => setIsBulkImportModalOpen(true)}
      />

      {/* 6-Digit PIN Security Lock Screen */}
      <PinLockScreen
        isLocked={isLocked}
        hasPinSet={hasPinSet}
        storedPinHash={storedPinHash}
        securityQuestion={securityQuestion}
        securityAnswerHash={securityAnswerHash}
        onUnlock={() => {
          setIsLocked(false);
        }}
        onPinConfigured={handlePinConfigured}
        onResetPin={handleResetPin}
        onCancelSetup={() => {
          setIsLocked(false);
        }}
      />

      {/* Open in Normal Tab vs Incognito Tab Modal */}
      <OpenLinkModal
        isOpen={isOpenLinkModalOpen}
        link={linkToOpen}
        category={linkToOpen ? categoryMap.get(linkToOpen.categorySlug) : undefined}
        onClose={() => {
          setIsOpenLinkModalOpen(false);
          setLinkToOpen(null);
        }}
        onOpenNormal={(link) => handleOpenLink(link)}
        onLinkOpened={(link) => handleOpenLink(link)}
      />

      {/* Generate & Display QR Code Modal */}
      <QrShareModal
        key={
          qrShareCategory
            ? `cat-${qrShareCategory.slug || qrShareCategory.id || qrShareCategory.name}`
            : qrShareLink
            ? `link-${qrShareLink.id}`
            : 'empty-qr'
        }
        isOpen={isQrShareModalOpen}
        category={qrShareCategory}
        categoryLinks={
          qrShareCategory
            ? links.filter((l) => isLinkInCategory(l.categorySlug, qrShareCategory))
            : []
        }
        links={links}
        singleLink={qrShareLink}
        link={qrShareLink}
        onClose={() => {
          setIsQrShareModalOpen(false);
          setQrShareCategory(null);
          setQrShareLink(null);
        }}
      />

      {/* In-App Camera / File QR Scanner Modal */}
      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onPayloadDecoded={(payload) => {
          setImportPayload(payload);
          setIsImportModalOpen(true);
        }}
      />

      {/* Cross-Device Import Shared Category / Link Confirmation Modal */}
      <ImportSharedModal
        isOpen={isImportModalOpen}
        payload={importPayload}
        existingCategories={categories}
        existingLinks={links}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportPayload(null);
        }}
        onImportCategoryAndLinks={handleImportCategoryAndLinks}
        onImportSingleLink={handleImportSingleLink}
      />

      {/* Dedicated Bulk Import (JSON / CSV) Modal */}
      <BulkImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        existingCategories={categories}
        existingLinks={links}
        currentCategorySlug={selectedCategory}
        onConfirmImport={handleConfirmBulkImport}
      />

      {/* Floating Import Confirmation Toast */}
      {importSuccessMessage && (
        <div
          id="import-success-toast"
          className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/60 max-w-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium leading-snug">{importSuccessMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setImportSuccessMessage(null)}
            className="text-slate-400 hover:text-white shrink-0 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cloud Bundle Fetching Loading Overlay */}
      {isImportLoading && (
        <div
          id="import-cloud-loading-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-[#0D1422] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col items-center gap-3 text-center max-w-xs">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-cyan-400 animate-spin" />
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Retrieving Shared Vault
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Connecting to cloud bundle & loading all links...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
