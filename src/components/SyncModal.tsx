import React, { useState } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  Smartphone,
  Laptop,
  Copy,
  Check,
  LogIn,
  LogOut,
  Download,
  Upload,
  AlertCircle,
  RefreshCw,
  Share2,
  Lock,
  KeyRound,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  Sparkles,
  Fingerprint,
  ExternalLink,
  FileDown,
} from 'lucide-react';
import { exportLinksToPdf } from '../utils/pdfExport';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fbSignOut,
  type User,
} from '../firebase';
import { SavedLink, Category } from '../types';
import {
  DEFAULT_SECURITY_QUESTIONS,
  hashSecurityAnswer,
} from '../utils/pinHelper';
import {
  checkBiometricSupport,
  registerDeviceFingerprint,
  removeDeviceFingerprint,
  authenticateWithFingerprint,
} from '../utils/biometricHelper';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  links: SavedLink[];
  categories: Category[];
  onImportLinks: (links: SavedLink[]) => Promise<void>;
  isSyncing: boolean;
  hasPinSet: boolean;
  securityQuestion?: string | null;
  onUpdateSecurityQuestion?: (question: string, answerHash: string) => Promise<void>;
  onLockNow: () => void;
  onChangePin: () => void;
  onRemovePin?: () => Promise<void>;
  onOpenBulkImport?: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  user,
  links,
  categories,
  onImportLinks,
  isSyncing,
  hasPinSet,
  securityQuestion,
  onUpdateSecurityQuestion,
  onLockNow,
  onChangePin,
  onRemovePin,
  onOpenBulkImport,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Security Question inline edit state
  const [showEditSecurityQ, setShowEditSecurityQ] = useState(false);
  const [selectedSecQ, setSelectedSecQ] = useState(securityQuestion || DEFAULT_SECURITY_QUESTIONS[0]);
  const [customSecQ, setCustomSecQ] = useState('');
  const [secAnswerInput, setSecAnswerInput] = useState('');
  const [secSaving, setSecSaving] = useState(false);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);
  const [secError, setSecError] = useState<string | null>(null);

  // Biometrics (Fingerprint / Touch ID) state
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [bioIframeRestricted, setBioIframeRestricted] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioMsg, setBioMsg] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    checkBiometricSupport().then((status) => {
      setBioSupported(status.supported);
      setBioEnrolled(status.enrolled);
      setBioIframeRestricted(status.iframeRestricted);
    });
  }, [isOpen]);

  const handleRegisterBio = async () => {
    try {
      setBioLoading(true);
      setBioError(null);
      setBioMsg(null);
      const res = await registerDeviceFingerprint('Link Vault User');
      if (res.success) {
        setBioEnrolled(true);
        setBioMsg('Fingerprint registered! You can now use fingerprint unlock.');
        setTimeout(() => setBioMsg(null), 3000);
      } else {
        setBioError(res.error || 'Fingerprint registration was cancelled.');
        if (res.isIframeBlocked) {
          setBioIframeRestricted(true);
        }
      }
    } catch (err: any) {
      setBioError(err?.message || 'Fingerprint error');
    } finally {
      setBioLoading(false);
    }
  };

  const handleTestBio = async () => {
    try {
      setBioLoading(true);
      setBioError(null);
      setBioMsg(null);
      const res = await authenticateWithFingerprint();
      if (res.success) {
        setBioMsg('Fingerprint verified successfully!');
        setTimeout(() => setBioMsg(null), 3000);
      } else {
        setBioError(res.error || 'Fingerprint verification failed.');
        if (res.isIframeBlocked) {
          setBioIframeRestricted(true);
        }
      }
    } catch (err: any) {
      setBioError(err?.message || 'Verification error');
    } finally {
      setBioLoading(false);
    }
  };

  const handleRemoveBio = () => {
    removeDeviceFingerprint();
    setBioEnrolled(false);
    setBioMsg('Fingerprint removed from this device.');
    setTimeout(() => setBioMsg(null), 2500);
  };


  if (!isOpen) return null;

  const appUrl = window.location.origin;

  const handleCopyAppUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        // User closed or dismissed popup - normal cancellation
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked by your browser. Please allow popups or use email sign in.');
        return;
      }
      console.warn('Google Sign In:', err?.message || err);
      setAuthError(err.message || 'Google sign-in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      setAuthLoading(true);
      setAuthError(null);
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setAuthLoading(true);
      await fbSignOut(auth);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleExportJson = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      links,
      categories,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `link-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const importedLinks = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.links)
            ? parsed.links
            : null;

        if (!importedLinks) {
          setImportStatus('Invalid backup file format');
          return;
        }

        await onImportLinks(importedLinks);
        setImportStatus(`Successfully imported ${importedLinks.length} links!`);
        setTimeout(() => setImportStatus(null), 3000);
      } catch (err: any) {
        setImportStatus(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const isAnonymous = !user || user.isAnonymous;

  return (
    <div
      id="sync-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        id="sync-modal-content"
        className="bg-white dark:bg-[#0D1422] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#111B2E]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/40">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] tracking-tight">
                Multi-Device Cloud Sync
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Access your categorized vault from any phone, tablet, or computer
              </p>
            </div>
          </div>
          <button
            id="close-sync-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111B2E] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 bg-white dark:bg-[#0D1422]">
          {/* Sync Status Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 dark:from-blue-950/30 dark:to-cyan-950/20 border border-blue-100 dark:border-blue-900/40">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${user ? 'bg-emerald-400' : 'bg-cyan-400'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${user ? 'bg-emerald-500' : 'bg-cyan-500'}`}></span>
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {user ? 'Real-Time Cloud Sync Active' : 'Local Vault Active'}
                </span>
              </div>
              {isSyncing && (
                <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              {user
                ? `Signed in as ${user.email || 'User'}. All links and categories are automatically mirrored to Firestore in real-time.`
                : 'Your links are stored safely on this device. Sign in with Google or Email below to enable real-time cloud synchronization across your phone, tablet, and other computers.'}
            </p>

            <div className="mt-3 pt-3 border-t border-blue-100/80 dark:border-blue-900/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Vault Statistics:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {links.length} saved links · {categories.length} categories
              </span>
            </div>
          </div>

          {/* Cross Device Instructions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              How Cross-Device Sync Works
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111B2E]/40 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium text-xs">
                  <Laptop className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                  <span>Desktop / Laptop</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Sign in with your Google or Email account. Any link saved here is stored in your private cloud partition.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111B2E]/40 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium text-xs">
                  <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Phone / Tablet</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Open this application URL on your mobile browser, sign in with the same account, and your links appear instantly.
                </p>
              </div>
            </div>

            {/* App URL Share */}
            <div className="flex items-center gap-2 p-2.5 bg-slate-100/80 dark:bg-[#111B2E] rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
              <Share2 className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <div className="truncate flex-1 font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                {appUrl}
              </div>
              <button
                id="copy-app-url-btn"
                onClick={handleCopyAppUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0 text-xs cursor-pointer"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Account Authentication */}
          <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Account Sync Settings
            </h3>

            {user && !isAnonymous ? (
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Connected Account
                    </span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-medium">
                    Permanent Sync
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Email: <span className="font-semibold text-slate-800 dark:text-slate-200">{user.email}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    id="copy-sync-uid-btn"
                    onClick={handleCopyUid}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>User Sync ID: {user.uid.slice(0, 8)}...</span>
                  </button>
                  <button
                    id="signout-btn"
                    onClick={handleSignOut}
                    disabled={authLoading}
                    className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {authError && (
                  <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Google Sign In */}
                <button
                  id="google-sync-btn"
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#070B14] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center justify-center gap-2 shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 dark:border-slate-800 w-full"></div>
                  <span className="bg-white dark:bg-[#0D1422] px-2 text-[10px] text-slate-400 uppercase tracking-wider absolute">
                    or with email
                  </span>
                </div>

                {/* Email Form */}
                <form onSubmit={handleEmailAuth} className="space-y-2.5">
                  <input
                    id="sync-email-input"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all text-[#0F172A] dark:text-[#F1F5F9] bg-white dark:bg-[#070B14]"
                  />
                  <input
                    id="sync-password-input"
                    type="password"
                    placeholder="Password (minimum 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 transition-all text-[#0F172A] dark:text-[#F1F5F9] bg-white dark:bg-[#070B14]"
                  />
                  <button
                    id="sync-email-submit-btn"
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{isRegistering ? 'Create Account & Sync' : 'Sign In & Sync'}</span>
                  </button>
                  <button
                    id="toggle-register-btn"
                    type="button"
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="w-full text-center text-[11px] text-blue-600 dark:text-cyan-400 hover:underline pt-1 cursor-pointer"
                  >
                    {isRegistering
                      ? 'Already have an account? Sign in'
                      : "Don't have an account? Create one"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* PIN Security Settings */}
          <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Vault Security & PIN Lock
            </h3>

            {/* PIN Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#111B2E]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/40 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                    <span>6-Digit Security PIN</span>
                    {hasPinSet ? (
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
                        Not Set
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {hasPinSet
                      ? 'Vault requires 6-digit PIN to open'
                      : 'Set a 6-digit passcode to protect your links'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
                {hasPinSet && onRemovePin && (
                  <button
                    type="button"
                    id="remove-pin-btn"
                    onClick={async () => {
                      if (window.confirm('Turn off PIN protection? Anyone on this browser will be able to view links.')) {
                        await onRemovePin();
                      }
                    }}
                    className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Remove PIN
                  </button>
                )}
                <button
                  type="button"
                  id="change-pin-btn"
                  onClick={() => {
                    onClose();
                    onChangePin();
                  }}
                  className="px-2.5 py-1.5 bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {hasPinSet ? 'Change PIN' : 'Set PIN'}
                </button>
                {hasPinSet && (
                  <button
                    type="button"
                    id="modal-lock-now-btn"
                    onClick={() => {
                      onClose();
                      onLockNow();
                    }}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Lock Now</span>
                  </button>
                )}
              </div>
            </div>

            {/* Security Question Card */}
            {hasPinSet && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#111B2E]/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-100 dark:border-cyan-900/40 shrink-0">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                        <span>Recovery Security Question</span>
                        {securityQuestion ? (
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                            Configured
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
                            Not Configured
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {securityQuestion
                          ? `Q: "${securityQuestion}"`
                          : 'Used to verify your identity before allowing a PIN reset'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    id="toggle-edit-sec-q-btn"
                    onClick={() => {
                      setShowEditSecurityQ((prev) => !prev);
                      setSecError(null);
                      setSecSuccess(null);
                    }}
                    className="self-start sm:self-auto px-2.5 py-1.5 bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {showEditSecurityQ ? 'Cancel' : securityQuestion ? 'Update Question' : 'Set Question'}
                  </button>
                </div>

                {/* Inline edit security question form */}
                {showEditSecurityQ && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const effectiveQ =
                        selectedSecQ === 'custom' ? customSecQ.trim() : selectedSecQ;
                      if (!effectiveQ) {
                        setSecError('Please choose or enter a security question.');
                        return;
                      }
                      if (!secAnswerInput.trim()) {
                        setSecError('Please enter an answer to your question.');
                        return;
                      }

                      try {
                        setSecSaving(true);
                        setSecError(null);
                        const answerHash = await hashSecurityAnswer(secAnswerInput);
                        if (onUpdateSecurityQuestion) {
                          await onUpdateSecurityQuestion(effectiveQ, answerHash);
                        }
                        setSecSuccess('Security question saved!');
                        setTimeout(() => {
                          setShowEditSecurityQ(false);
                          setSecSuccess(null);
                          setSecAnswerInput('');
                        }, 1200);
                      } catch (err: any) {
                        setSecError('Failed to save: ' + err.message);
                      } finally {
                        setSecSaving(false);
                      }
                    }}
                    className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5 animate-in fade-in"
                  >
                    {secError && (
                      <div className="p-2 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-lg">
                        {secError}
                      </div>
                    )}
                    {secSuccess && (
                      <div className="p-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                        {secSuccess}
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Question
                      </label>
                      <div className="relative">
                        <select
                          value={selectedSecQ}
                          onChange={(e) => setSelectedSecQ(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 appearance-none pr-8 cursor-pointer"
                        >
                          {DEFAULT_SECURITY_QUESTIONS.map((q) => (
                            <option key={q} value={q}>
                              {q}
                            </option>
                          ))}
                          <option value="custom">Write custom question...</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {selectedSecQ === 'custom' && (
                      <div>
                        <input
                          type="text"
                          placeholder="Your custom question..."
                          value={customSecQ}
                          onChange={(e) => setCustomSecQ(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Your Secret Answer
                      </label>
                      <input
                        type="text"
                        placeholder="Type answer..."
                        value={secAnswerInput}
                        onChange={(e) => setSecAnswerInput(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowEditSecurityQ(false)}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={secSaving || !secAnswerInput.trim()}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                      >
                        {secSaving ? 'Saving...' : 'Save Question'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Fingerprint / Biometric Unlock Card */}
            {hasPinSet && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#111B2E]/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-100 dark:border-cyan-900/40 shrink-0">
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                        <span>Fingerprint & Face Unlock</span>
                        {bioSupported ? (
                          bioEnrolled ? (
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                              Enrolled & Ready
                            </span>
                          ) : bioIframeRestricted ? (
                            <span className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800/60">
                              Requires New Tab / Phone
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800/60">
                              Device Supported
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
                            Sensor Not Detected
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {bioEnrolled
                          ? 'Your phone fingerprint can be used to unlock the vault instantly'
                          : 'Use the same fingerprint sensor you use to unlock your phone'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {bioEnrolled ? (
                      <>
                        <button
                          type="button"
                          id="test-fingerprint-btn"
                          onClick={handleTestBio}
                          disabled={bioLoading}
                          className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Fingerprint className="w-3.5 h-3.5" />
                          <span>{bioLoading ? 'Scanning...' : 'Test Sensor'}</span>
                        </button>
                        <button
                          type="button"
                          id="remove-fingerprint-btn"
                          onClick={handleRemoveBio}
                          disabled={bioLoading}
                          className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        id="setup-fingerprint-btn"
                        onClick={handleRegisterBio}
                        disabled={bioLoading}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span>{bioLoading ? 'Scanning...' : 'Set Up Fingerprint'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {bioMsg && (
                  <div className="p-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">
                    {bioMsg}
                  </div>
                )}
                {bioError && (
                  <div className="p-2.5 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200/50 dark:border-rose-800/50 flex flex-col items-start gap-2">
                    <div>{bioError}</div>
                    {bioIframeRestricted && (
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-100/80 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 text-[11px] font-bold hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Link Vault in New Tab</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab Switch Auto-Lock Status Banner */}
            {hasPinSet && (
              <div className="p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-300">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                <span>
                  <strong>Tab Switch Auto-Lock is Active:</strong> Whenever you switch tabs or open a new window, LinkVault automatically prompts for your 6-digit PIN before showing links.
                </span>
              </div>
            )}
          </div>

          {/* Backup & Transfer */}
          <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Data Backup & Migration
            </h3>
            {importStatus && (
              <div className="p-2.5 text-xs rounded-lg bg-slate-100 dark:bg-[#111B2E] text-slate-700 dark:text-slate-200 font-medium">
                {importStatus}
              </div>
            )}
            {/* Bulk Import Wizard Button */}
            {onOpenBulkImport && (
              <button
                type="button"
                id="open-bulk-import-from-sync-btn"
                onClick={() => {
                  onClose();
                  onOpenBulkImport();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/50 dark:hover:to-cyan-900/50 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-cyan-300 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Open Bulk Import Wizard (JSON / CSV / Bookmarks)</span>
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                id="export-links-pdf-btn"
                type="button"
                onClick={() => {
                  if (links.length === 0) {
                    setImportStatus('No links to export');
                    setTimeout(() => setImportStatus(null), 3000);
                    return;
                  }
                  const res = exportLinksToPdf(links, categories);
                  if (res.success) {
                    setImportStatus(`Exported ${res.count} links to PDF!`);
                  } else {
                    setImportStatus(`Export failed: ${res.error}`);
                  }
                  setTimeout(() => setImportStatus(null), 4000);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 text-blue-700 dark:text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>

              <button
                id="export-links-json-btn"
                onClick={handleExportJson}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Export JSON</span>
              </button>

              <label
                id="import-links-json-label"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Import JSON</span>
                <input
                  id="import-links-json-input"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onClick={() => {
                    (window as any).__linkVaultFilePickerActive = true;
                  }}
                  onChange={(e) => {
                    (window as any).__linkVaultFilePickerActive = false;
                    handleImportJson(e);
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#111B2E]/60 flex justify-end">
          <button
            id="close-sync-modal-footer-btn"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-[#111B2E] dark:hover:bg-slate-800 text-white font-medium text-xs transition-colors cursor-pointer border border-transparent dark:border-slate-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
