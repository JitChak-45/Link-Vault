import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
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
import { getFaviconUrl } from './utils/urlHelper';
import { CategoryIcon } from './components/CategoryIcon';
import { LinkCard } from './components/LinkCard';
import { AddEditLinkModal } from './components/AddEditLinkModal';
import { CategoryModal } from './components/CategoryModal';
import { SyncModal } from './components/SyncModal';
import { PinLockScreen } from './components/PinLockScreen';
import { OpenLinkModal } from './components/OpenLinkModal';
import { QrShareModal } from './components/QrShareModal';
import { QrScannerModal } from './components/QrScannerModal';
import { ImportSharedModal } from './components/ImportSharedModal';

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
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

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

  // Auto-lock vault on tab switch or when mobile app is hidden/switched
  useEffect(() => {
    if (!hasPinSet) return;

    const handleVisibilityChange = () => {
      // Whenever the user switches away from the tab or minimizes the app, secure the vault
      if (document.visibilityState === 'hidden') {
        setIsLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasPinSet]);

  // Futuristic Day / Night Theme: Auto-selects from local device time (6:00 AM - 5:59 PM: Light, 6:00 PM - 5:59 AM: Dark)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('link_vault_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18 ? 'light' : 'dark';
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

  const toggleTheme = () => {
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
        fullUrl.includes('#share=') ||
        fullUrl.includes('?share=') ||
        fullUrl.includes('#import=') ||
        fullUrl.includes('?import=') ||
        fullUrl.includes('#i=') ||
        fullUrl.includes('?i=') ||
        fullUrl.includes('#code=') ||
        fullUrl.includes('?code=') ||
        hash.startsWith('#s_');

      if (hasShareIndicator) {
        setIsImportLoading(true);
        const timeoutId = setTimeout(() => {
          setIsImportLoading(false);
        }, 4000);

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
          loadedCategories.sort((a, b) => a.createdAt - b.createdAt);
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
    const updated = [...cleaned, ...links];
    setLinks(updated);
    saveLocalLinks(updated);

    if (user) {
      const linksColRef = collection(db, 'users', user.uid, 'links');
      for (const item of cleaned) {
        const newRef = doc(linksColRef, item.id);
        await setDoc(newRef, item);
      }
    }
    setIsSyncing(false);
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

  return (
    <div
      className="min-h-screen bg-[#F3F7FC] dark:bg-[#070B14] text-[#0F172A] dark:text-[#F1F5F9] flex flex-col font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-700 dark:selection:text-cyan-300 transition-colors duration-300 relative overflow-x-hidden"
    >
      {/* Main Vault Content (blurred & non-interactive only when PIN locked) */}
      <div
        id="vault-main-content"
        className={`flex flex-col flex-1 transition-all duration-300 ${
          hasPinSet && isLocked ? 'filter blur-xl opacity-30 select-none pointer-events-none' : ''
        }`}
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

              {/* Cloud Sync Status Button */}
              <button
                id="open-sync-status-btn"
                onClick={() => setIsSyncModalOpen(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0D1422] hover:bg-slate-50 dark:hover:bg-[#111B2E] transition-all text-xs text-slate-700 dark:text-slate-200 shadow-2xs shrink-0"
                title="Configure multi-device cloud synchronization"
              >
                <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                      user ? 'bg-emerald-400' : 'bg-cyan-400'
                    } opacity-75`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 ${
                      user ? 'bg-emerald-500' : 'bg-cyan-500'
                    }`}
                  ></span>
                </span>
                <span className="font-medium hidden md:inline">
                  {user ? 'Synced' : 'Sync'}
                </span>
                <Cloud className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 hidden sm:block" />
              </button>

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
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Categories
            </h2>
            <button
              id="new-category-btn"
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
              className="text-xs text-blue-600 dark:text-cyan-400 hover:text-blue-800 dark:hover:text-cyan-300 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Category</span>
            </button>
          </div>

          {/* Category Pills List */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {/* All Links Pill */}
            <button
              id="filter-category-all-btn"
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
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

            {/* Starred / Favorites */}
            <button
              id="filter-category-favorites-btn"
              onClick={() => setSelectedCategory('favorites')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
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

            {/* Categories */}
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.slug;
              const count = categoryCounts[cat.slug] || 0;
              return (
                <div
                  key={cat.slug}
                  className={`relative group shrink-0 flex items-center rounded-xl transition-all border ${
                    isSelected
                      ? 'text-white shadow-xs border-transparent'
                      : 'bg-white dark:bg-[#0D1422] border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#111B2E]'
                  }`}
                  style={isSelected ? { backgroundColor: cat.color } : undefined}
                >
                  <button
                    type="button"
                    id={`filter-category-${cat.slug}-btn`}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className="flex items-center gap-2 pl-3.5 pr-2 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer"
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
                          isSelected ? 'bg-black/20 text-white' : 'text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-blue-950/60'
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
                    onClick={() => {
                      setEditingCategory(cat);
                      setIsCategoryModalOpen(true);
                    }}
                    className={`p-1.5 mr-0.5 rounded-lg transition-opacity ${
                      isSelected
                        ? 'opacity-80 hover:opacity-100 hover:bg-black/20 text-white'
                        : 'opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                    title={`Edit ${cat.name} settings and privacy`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>

                  {/* Share Category via QR Code */}
                  <button
                    type="button"
                    id={`share-category-qr-${cat.slug}-btn`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenQrShareForCategory(cat);
                    }}
                    className={`p-1.5 mr-1.5 rounded-lg transition-opacity ${
                      isSelected
                        ? 'opacity-80 hover:opacity-100 hover:bg-black/20 text-white'
                        : 'opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400'
                    }`}
                    title={`Share ${cat.name} (${count} links) via QR Code`}
                  >
                    <QrCode className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
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
        {selectedCategory !== 'all' && selectedCategory !== 'favorites' && categoryMap.get(selectedCategory)?.hideFromAll && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-blue-50/80 dark:bg-[#0D1422] border border-blue-200/80 dark:border-blue-900/40 text-xs text-blue-950 dark:text-blue-100 shadow-2xs">
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
          </div>
        )}

        {/* Links Grid or List */}
        <section id="links-container" className="flex-1">
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
      </div>

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
        onClose={() => {
          setIsImportModalOpen(false);
          setImportPayload(null);
        }}
        onImportCategoryAndLinks={handleImportCategoryAndLinks}
        onImportSingleLink={handleImportSingleLink}
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
