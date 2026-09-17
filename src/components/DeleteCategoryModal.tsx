import React, { useState, useEffect, useRef } from 'react';
import {
  Trash2,
  Lock,
  KeyRound,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Category } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { verifyPin, verifySecurityAnswer, hashSecurityAnswer, DEFAULT_SECURITY_QUESTIONS } from '../utils/pinHelper';

interface DeleteCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  linkCount: number;
  onConfirmDelete: (categorySlug: string) => Promise<void>;
  hasPinSet: boolean;
  storedPinHash: string | null;
  securityQuestion: string | null;
  securityAnswerHash: string | null;
  onOpenPinSetup: () => void;
  onOpenSecuritySettings?: () => void;
  onUpdateSecurityQuestion?: (question: string, answerHash: string) => Promise<void>;
}

export const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({
  isOpen,
  onClose,
  category,
  linkCount,
  onConfirmDelete,
  hasPinSet,
  storedPinHash,
  securityQuestion,
  securityAnswerHash,
  onOpenPinSetup,
  onOpenSecuritySettings,
  onUpdateSecurityQuestion,
}) => {
  const [pin, setPin] = useState('');
  const [revealPin, setRevealPin] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Missing question inline setup state
  const [isConfiguringQuestion, setIsConfiguringQuestion] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string>(DEFAULT_SECURITY_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [setupAnswer, setSetupAnswer] = useState('');
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setAnswer('');
      setError(null);
      setIsDeleting(false);
      setIsSuccess(false);
      setIsConfiguringQuestion(false);
      setSetupAnswer('');
      setCustomQuestion('');
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen || !category) return null;

  // Handler to configure the App Forgot Password Security Question directly if missing
  const handleSaveMissingSecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const questionToSave =
      selectedQuestion === 'custom' ? customQuestion.trim() : selectedQuestion;

    if (!questionToSave) {
      setError('Please select or write a security question.');
      return;
    }

    if (!setupAnswer.trim()) {
      setError('Please enter your secret answer.');
      return;
    }

    if (!onUpdateSecurityQuestion) {
      setError('Security configuration is not available.');
      return;
    }

    try {
      setIsSavingQuestion(true);
      const answerHash = await hashSecurityAnswer(setupAnswer);
      await onUpdateSecurityQuestion(questionToSave, answerHash);
      setIsConfiguringQuestion(false);
      setAnswer(setupAnswer.trim());
      setError(null);
    } catch (err: any) {
      console.error('Failed to configure security question:', err);
      setError('Failed to save security question. Please try again.');
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleVerifyAndDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If no App Lock PIN is configured
    if (!hasPinSet || !storedPinHash) {
      setError('Please set up your 6-digit App Lock PIN before deleting categories.');
      return;
    }

    // If no App Forgot Password Security Question is configured
    if (!securityQuestion || !securityAnswerHash) {
      setError('Please configure your App Forgot Password security question before deleting categories.');
      return;
    }

    // Validate 6-digit App Lock PIN format
    const cleanPin = pin.trim();
    if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      setError('Please enter your complete 6-digit App Lock PIN.');
      return;
    }

    // Validate Security Answer
    const cleanAnswer = answer.trim();
    if (!cleanAnswer) {
      setError('Please enter the answer to your App Forgot Password security question.');
      return;
    }

    try {
      setIsDeleting(true);

      // 1. Verify App Lock PIN against stored app lock hash
      const isPinValid = await verifyPin(cleanPin, storedPinHash);
      if (!isPinValid) {
        setError('Incorrect PIN. Please enter the same 6-digit PIN used to unlock Link Vault (App Lock).');
        setIsDeleting(false);
        return;
      }

      // 2. Verify Security Answer against stored app forgot password answer hash
      const isAnswerValid = await verifySecurityAnswer(cleanAnswer, securityAnswerHash);
      if (!isAnswerValid) {
        setError('Incorrect security answer. Please enter the same recovery answer configured for App Forgot Password.');
        setIsDeleting(false);
        return;
      }

      // Both verified!
      setIsSuccess(true);
      await onConfirmDelete(category.slug);

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'Failed to authorize category deletion.');
      setIsDeleting(false);
    }
  };

  return (
    <div
      id="delete-category-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="delete-category-modal-card"
        className="bg-white dark:bg-[#0D1422] rounded-2xl shadow-2xl border border-rose-200/80 dark:border-rose-900/40 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with warning styling */}
        <div className="px-6 py-4 border-b border-rose-100 dark:border-rose-950/60 bg-rose-50/70 dark:bg-rose-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800/60">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-['Space_Grotesk']">
                Confirm Category Deletion
              </h2>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Identity verification required (PIN + Security Answer)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-200 hover:text-slate-600 dark:hover:text-white hover:bg-rose-100/50 dark:hover:bg-rose-900/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-4">
          {/* Target Category Pill Summary */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111B2E] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: category.color }}
              >
                <CategoryIcon name={category.icon} color="#ffffff" className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {category.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {linkCount} saved {linkCount === 1 ? 'link' : 'links'} in this category
                </div>
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-md font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-900/50">
              Will be removed
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Deleting this category removes its tab and groupings. Links in this category will remain safe in your vault and will move to "General".
          </p>

          {/* Unified Credentials Note */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111B2E] border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Same as App Lock: </span>
              Use the identical <span className="font-semibold text-slate-900 dark:text-white">6-digit PIN</span> from your App Lock and your <span className="font-semibold text-slate-900 dark:text-white">App Forgot Password security question answer</span> to authorize deletion.
            </div>
          </div>

          {/* If user does not have App Lock PIN configured */}
          {(!hasPinSet || !storedPinHash) && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>App Lock & Recovery Question Required</span>
              </div>
              <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                To prevent unauthorized loss, category deletion requires the same 6-digit PIN and security question configured for your App Lock and App Forgot Password recovery. Please set up App Lock first.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPinSetup();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 text-white font-medium text-xs hover:bg-cyan-700 transition-colors shadow-2xs cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Set Up App Lock & Recovery Question</span>
              </button>
            </div>
          )}

          {/* If user has PIN but no security question yet */}
          {hasPinSet && (!securityQuestion || !securityAnswerHash) && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>App Forgot Password Question Required</span>
              </div>
              <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                Your App Lock PIN is active, but you haven't set an App Forgot Password security question yet. Please configure your recovery question below to enable category deletion.
              </p>
              {!isConfiguringQuestion ? (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsConfiguringQuestion(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 text-white font-medium text-xs hover:bg-cyan-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Set Security Question Now</span>
                  </button>
                  {onOpenSecuritySettings && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSecuritySettings();
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                    >
                      Open Security Settings
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSaveMissingSecurityQuestion} className="space-y-3 pt-2 border-t border-amber-200/80 dark:border-amber-900/60">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Choose Security Question (Same for App Forgot Password)
                    </label>
                    <select
                      value={selectedQuestion}
                      onChange={(e) => setSelectedQuestion(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                    >
                      {DEFAULT_SECURITY_QUESTIONS.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                      <option value="custom">Write custom question...</option>
                    </select>
                  </div>
                  {selectedQuestion === 'custom' && (
                    <div>
                      <input
                        type="text"
                        placeholder="Write your custom question..."
                        value={customQuestion}
                        onChange={(e) => setCustomQuestion(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Secret Answer
                    </label>
                    <input
                      type="text"
                      placeholder="Enter recovery answer..."
                      value={setupAnswer}
                      onChange={(e) => setSetupAnswer(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#070B14] border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsConfiguringQuestion(false)}
                      className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingQuestion || !setupAnswer.trim()}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors shadow-2xs"
                    >
                      {isSavingQuestion ? 'Saving...' : 'Save & Continue'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Verification Form */}
          {hasPinSet && securityQuestion && securityAnswerHash && (
            <form onSubmit={handleVerifyAndDelete} className="space-y-4">
              {/* Field 1: 6-Digit App Lock PIN */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Step 1: Enter App Lock 6-Digit PIN
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Same as App Unlock PIN
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-200 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    ref={pinInputRef}
                    id="delete-category-pin-input"
                    type={revealPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Enter your 6-digit App Lock PIN"
                    value={pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPin(val);
                      if (error) setError(null);
                    }}
                    className="w-full pl-9 pr-10 py-2.5 text-sm tracking-widest font-mono bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 text-slate-900 dark:text-slate-100"
                    disabled={isDeleting || isSuccess}
                  />
                  <button
                    type="button"
                    onClick={() => setRevealPin(!revealPin)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-slate-200 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    title={revealPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {revealPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 2: App Forgot Password Security Question Answer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Step 2: Answer App Forgot Password Question
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Same as Recovery Answer
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#111B2E]/90 border border-slate-200/80 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200">
                  <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                    Your Recovery Question:
                  </span>
                  {securityQuestion}
                </div>
                <div className="relative mt-1.5">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-200 pointer-events-none">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="delete-category-sec-answer-input"
                    type="text"
                    placeholder="Enter your recovery answer"
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      if (error) setError(null);
                    }}
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 text-slate-900 dark:text-slate-100"
                    disabled={isDeleting || isSuccess}
                  />
                </div>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-in fade-in duration-150">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span className="flex-1 leading-snug">{error}</span>
                </div>
              )}

              {/* Success Banner */}
              {isSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in duration-150">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold">Identity verified! Deleting category...</span>
                </div>
              )}

              {/* Forgot PIN helper hint */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPinSetup();
                  }}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 underline transition-colors cursor-pointer"
                >
                  Forgot your App Lock PIN or Answer?
                </button>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  id="cancel-delete-category-btn"
                  onClick={onClose}
                  disabled={isDeleting || isSuccess}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="confirm-delete-category-btn"
                  disabled={isDeleting || isSuccess || pin.length !== 6 || !answer.trim()}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-all shadow-xs shadow-rose-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                  <span>{isDeleting ? 'Verifying & Deleting...' : isSuccess ? 'Deleted' : 'Verify & Delete'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
