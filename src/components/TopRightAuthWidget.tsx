import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  LogOut,
  Mail,
  Lock,
  ChevronDown,
  X,
  Cloud,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Shield,
  ArrowRight,
} from 'lucide-react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fbSignOut,
  type User as FirebaseUser,
} from '../firebase';

interface TopRightAuthWidgetProps {
  user: FirebaseUser | null;
  authInitialized: boolean;
  onOpenSyncModal: () => void;
}

// Crisp Google multicolor "G" logo
const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
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
);

export const TopRightAuthWidget: React.FC<TopRightAuthWidgetProps> = ({
  user,
  authInitialized,
  onOpenSyncModal,
}) => {
  // Floating prompt visibility (Google One Tap style card in top right)
  const [isPromptDismissed, setIsPromptDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('link_vault_auth_prompt_dismissed') === 'true';
  });
  const [isManualOpen, setIsManualOpen] = useState(false);

  // User Account Dropdown menu
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);

  // Quick sign-in form state inside prompt
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Auto-close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
      if (
        isManualOpen &&
        promptRef.current &&
        !promptRef.current.contains(event.target as Node)
      ) {
        setIsManualOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isManualOpen]);

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
      setIsManualOpen(false);
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        // User closed or dismissed the popup window - normal cancellation
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked by your browser. Please enable popups or sign in with email.');
        return;
      }
      console.warn('Google Sign In:', err?.message || err);
      setAuthError(err?.message || 'Google sign-in could not be completed.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Email / Password authentication
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    if (!showPasswordField) {
      setShowPasswordField(true);
      return;
    }

    if (!passwordInput) {
      setAuthError('Please enter your password.');
      return;
    }

    try {
      setAuthLoading(true);
      setAuthError(null);
      if (isSigningUp) {
        await createUserWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      } else {
        await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      }
      setEmailInput('');
      setPasswordInput('');
      setShowPasswordField(false);
      setIsManualOpen(false);
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      let msg = err?.message || 'Authentication failed.';
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        msg = 'Incorrect password. Please try again.';
      } else if (err?.code === 'auth/user-not-found') {
        msg = 'No account found with this email. Switch to Sign Up below.';
      } else if (err?.code === 'auth/email-already-in-use') {
        msg = 'An account already exists with this email. Please sign in.';
      } else if (err?.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      }
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      setAuthLoading(true);
      await fbSignOut(auth);
      setIsUserMenuOpen(false);
    } catch (err: any) {
      console.error('Sign Out Error:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDismissPrompt = () => {
    setIsPromptDismissed(true);
    setIsManualOpen(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('link_vault_auth_prompt_dismissed', 'true');
    }
  };

  // Check if the floating prompt should be shown
  const shouldShowFloatingPrompt =
    authInitialized && !user && (!isPromptDismissed || isManualOpen);

  return (
    <div className="relative inline-flex items-center">
      {/* 1. Header Pill in Top-Right Corner */}
      {user ? (
        // SIGNED IN: Show Email ID and Avatar
        <div className="relative" ref={userMenuRef}>
          <button
            id="top-right-user-menu-btn"
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 sm:pr-3 py-1 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0D1422] hover:bg-slate-50 dark:hover:bg-[#111B2E] transition-all text-xs shadow-2xs font-medium shrink-0 cursor-pointer group"
            title={`Signed in as ${user.email || 'User'}`}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="true"
          >
            {/* User Avatar / Photo */}
            <div className="relative flex items-center justify-center w-6 h-6 rounded-lg overflow-hidden bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-bold text-xs shrink-0 shadow-2xs">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || user.email || 'User'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{(user.email?.[0] || 'U').toUpperCase()}</span>
              )}
              {/* Online Green dot */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-[#0D1422]" />
            </div>

            {/* Email Address */}
            <span className="text-slate-700 dark:text-slate-200 font-semibold max-w-[90px] sm:max-w-[140px] md:max-w-[170px] truncate">
              {user.email || 'Signed in'}
            </span>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform" />
          </button>

          {/* User Account Dropdown */}
          <AnimatePresence>
            {isUserMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#0F172A] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 overflow-hidden"
              >
                {/* Account info */}
                <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Cloud Synced
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {user.email}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-mono mt-0.5">
                    ID: {user.uid}
                  </p>
                </div>

                {/* Actions */}
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenSyncModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <Cloud className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                  <span>Cloud Sync & Security Settings</span>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={authLoading}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        // NOT SIGNED IN: Prominent Top-Right "Sign In" Button
        <button
          id="top-right-signin-btn"
          type="button"
          onClick={() => setIsManualOpen((prev) => !prev)}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl border border-blue-200/90 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-cyan-300 transition-all text-xs font-semibold shadow-2xs shrink-0 cursor-pointer"
          title="Sign in with your Email or Google account to sync your links"
        >
          <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
          <span>Sign In</span>
        </button>
      )}

      {/* 2. Floating Google One-Tap / Top-Right Sign-in Prompt Card */}
      <AnimatePresence>
        {shouldShowFloatingPrompt && (
          <motion.div
            ref={promptRef}
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed top-16 right-3 sm:right-6 z-50 w-[330px] sm:w-[350px] max-w-[calc(100vw-1.5rem)] bg-white/95 dark:bg-[#0D1422]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4"
          >
            {/* Header with Google logo and Close (X) */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-2xs shrink-0">
                  <GoogleIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Sign in to Link Vault
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sync & backup your links
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="dismiss-auth-prompt-btn"
                onClick={handleDismissPrompt}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error banner if any */}
            {authError && (
              <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-[11px] text-rose-700 dark:text-rose-300">
                {authError}
              </div>
            )}

            {/* One-Click Continue with Google Button */}
            <button
              id="google-one-tap-btn"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#131E35] hover:bg-slate-50 dark:hover:bg-[#1A2846] text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
            >
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-cyan-400" />
              ) : (
                <GoogleIcon className="w-4 h-4 shrink-0" />
              )}
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white dark:bg-[#0D1422] px-2 text-slate-400 font-medium">
                  or sign in with email
                </span>
              </div>
            </div>

            {/* Quick Email & Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-2">
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  id="top-right-email-input"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Enter your email ID"
                  required
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#131E35] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-cyan-500"
                />
              </div>

              {/* Password field - appears after email or directly */}
              {showPasswordField && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="relative"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    id="top-right-password-input"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={isSigningUp ? 'Choose a password (min 6 chars)' : 'Enter password'}
                    required
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#131E35] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-cyan-500"
                  />
                </motion.div>
              )}

              <button
                type="submit"
                id="top-right-submit-auth-btn"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-xs font-semibold shadow-2xs transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
              >
                {authLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>
                      {showPasswordField
                        ? isSigningUp
                          ? 'Create Account'
                          : 'Sign In'
                        : 'Continue with Email'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Toggle Sign Up / Sign In mode */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setIsSigningUp(!isSigningUp);
                    setAuthError(null);
                    setShowPasswordField(true);
                  }}
                  className="hover:text-blue-600 dark:hover:text-cyan-400 underline underline-offset-2 transition-colors cursor-pointer"
                >
                  {isSigningUp
                    ? 'Already have an account? Sign In'
                    : 'New here? Create account'}
                </button>
                <button
                  type="button"
                  onClick={onOpenSyncModal}
                  className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  More options
                </button>
              </div>
            </form>

            {/* Privacy note */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
              <Shield className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>Your links are stored securely in your private cloud vault.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
