import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  Delete,
  AlertCircle,
  KeyRound,
  RotateCcw,
  Eye,
  EyeOff,
  X,
  CheckCircle2,
} from 'lucide-react';
import { hashPin, verifyPin } from '../utils/pinHelper';

interface PinLockScreenProps {
  isLocked: boolean;
  hasPinSet: boolean;
  storedPinHash: string | null;
  onUnlock: () => void;
  onPinConfigured: (newPinHash: string) => Promise<void>;
  onResetPin: () => Promise<void>;
  onCancelSetup?: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  isLocked,
  hasPinSet,
  storedPinHash,
  onUnlock,
  onPinConfigured,
  onResetPin,
  onCancelSetup,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [tempFirstPin, setTempFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const [revealDigits, setRevealDigits] = useState(false);

  // Clear state whenever locked or pin existence changes
  useEffect(() => {
    setPin('');
    setConfirmPin('');
    setSetupStep('create');
    setTempFirstPin('');
    setError(null);
    setSuccessMsg(null);
    setShowForgotConfirm(false);
    setIsSubmitting(false);
  }, [isLocked, hasPinSet]);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  }, []);

  // Handle digit input with guaranteed try/finally
  const handleDigitPress = useCallback(
    async (digit: string) => {
      if (isSubmitting) return;

      if (hasPinSet && storedPinHash) {
        // --- UNLOCK MODE ---
        if (pin.length < 6) {
          const nextPin = pin + digit;
          setPin(nextPin);
          setError(null);

          if (nextPin.length === 6) {
            try {
              setIsSubmitting(true);
              const isValid = await verifyPin(nextPin, storedPinHash);
              if (isValid) {
                setSuccessMsg('Unlocked!');
                setTimeout(() => {
                  onUnlock();
                  setPin('');
                  setSuccessMsg(null);
                }, 200);
              } else {
                triggerShake();
                setError('Incorrect PIN. Please try again.');
                setPin('');
              }
            } catch (err: any) {
              console.error('PIN verification error:', err);
              setError('Verification error. Please try again.');
              setPin('');
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      } else {
        // --- SETUP MODE ---
        if (setupStep === 'create') {
          if (pin.length < 6) {
            const nextPin = pin + digit;
            setPin(nextPin);
            setError(null);

            if (nextPin.length === 6) {
              setTempFirstPin(nextPin);
              setPin('');
              setSetupStep('confirm');
            }
          }
        } else if (setupStep === 'confirm') {
          if (confirmPin.length < 6) {
            const nextConfirm = confirmPin + digit;
            setConfirmPin(nextConfirm);
            setError(null);

            if (nextConfirm.length === 6) {
              if (nextConfirm === tempFirstPin) {
                try {
                  setIsSubmitting(true);
                  const newHash = await hashPin(nextConfirm);
                  await onPinConfigured(newHash);
                  setSuccessMsg('PIN Saved & Vault Secured!');
                  setTimeout(() => {
                    onUnlock();
                    setSuccessMsg(null);
                  }, 300);
                } catch (err: any) {
                  console.error('Error saving PIN:', err);
                  setError('Failed to save PIN. Please try again.');
                } finally {
                  setIsSubmitting(false);
                }
              } else {
                triggerShake();
                setError('PINs did not match. Please re-enter.');
                setConfirmPin('');
                setPin('');
                setTempFirstPin('');
                setSetupStep('create');
              }
            }
          }
        }
      }
    },
    [
      isSubmitting,
      hasPinSet,
      storedPinHash,
      pin,
      confirmPin,
      setupStep,
      tempFirstPin,
      onUnlock,
      onPinConfigured,
      triggerShake,
    ]
  );

  const handleBackspace = useCallback(() => {
    if (isSubmitting) return;
    setError(null);
    if (hasPinSet) {
      setPin((prev) => prev.slice(0, -1));
    } else {
      if (setupStep === 'create') {
        setPin((prev) => prev.slice(0, -1));
      } else {
        setConfirmPin((prev) => prev.slice(0, -1));
      }
    }
  }, [isSubmitting, hasPinSet, setupStep]);

  // Physical keyboard support (0-9, Backspace)
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, handleDigitPress, handleBackspace]);

  if (!isLocked) return null;

  const currentDisplayPin = hasPinSet
    ? pin
    : setupStep === 'create'
      ? pin
      : confirmPin;

  return (
    <div
      id="pin-lock-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all"
    >
      <div
        id="pin-lock-card"
        className={`relative bg-white dark:bg-[#0D1422] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-7 sm:p-8 w-full max-w-sm flex flex-col items-center text-center transition-transform ${
          isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
        }`}
      >
        {/* Cancel button if setting up and want to exit */}
        {!hasPinSet && onCancelSetup && (
          <button
            type="button"
            id="cancel-pin-setup-btn"
            onClick={onCancelSetup}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111B2E] transition-colors cursor-pointer"
            title="Cancel and enter vault without PIN"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-cyan-400 flex items-center justify-center mb-4 shadow-xs">
          {hasPinSet ? <Lock className="w-7 h-7" /> : <KeyRound className="w-7 h-7" />}
        </div>

        {/* Title */}
        <h2 className="text-xl font-extrabold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] tracking-tight">
          {hasPinSet
            ? 'Enter Security PIN'
            : setupStep === 'create'
              ? 'Create 6-Digit PIN'
              : 'Confirm 6-Digit PIN'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5 max-w-xs">
          {hasPinSet
            ? 'Your vault is locked. Enter your 6-digit PIN to access your links'
            : setupStep === 'create'
              ? 'Choose a 6-digit code to protect your saved links across all devices'
              : 'Re-enter your 6-digit code to verify and activate PIN protection'}
        </p>

        {/* 6-Digit Dots / Numbers Display */}
        <div className="mb-5 flex items-center justify-center gap-2">
          <div
            id="pin-dots-container"
            className="flex items-center justify-center gap-2 sm:gap-3.5 px-3 sm:px-4 py-2 rounded-2xl bg-slate-50 dark:bg-[#070B14] border border-slate-200/80 dark:border-slate-800"
          >
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const isFilled = index < currentDisplayPin.length;
              const digitVal = currentDisplayPin[index];
              return (
                <div
                  key={index}
                  className={`w-5 sm:w-6 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs sm:text-sm transition-all duration-150 ${
                    isFilled
                      ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-xs scale-105'
                      : 'bg-slate-200/90 dark:bg-slate-800 text-transparent border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {isFilled ? (revealDigits ? digitVal : '•') : ''}
                </div>
              );
            })}
          </div>

          {/* Reveal digits toggle */}
          <button
            type="button"
            onClick={() => setRevealDigits(!revealDigits)}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111B2E] transition-colors shrink-0 cursor-pointer"
            title={revealDigits ? 'Hide digits' : 'Show digits'}
          >
            {revealDigits ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Feedback: Error or Success */}
        {error && (
          <div className="mb-4 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-1.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div
          id="pin-keypad"
          className="grid grid-cols-3 gap-3 w-full max-w-[270px] mb-3"
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              id={`keypad-${digit}-btn`}
              onClick={() => handleDigitPress(digit)}
              disabled={isSubmitting}
              className="h-13 sm:h-14 rounded-2xl bg-slate-50 dark:bg-[#111B2E] hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xl font-bold transition-all active:scale-95 shadow-2xs flex items-center justify-center select-none cursor-pointer"
            >
              {digit}
            </button>
          ))}

          {/* Clear Button */}
          <div className="flex items-center justify-center">
            {currentDisplayPin.length > 0 && (
              <button
                type="button"
                id="keypad-clear-btn"
                onClick={() => {
                  setPin('');
                  setConfirmPin('');
                  setError(null);
                }}
                className="text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 uppercase tracking-wider px-2 py-1 rounded cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Digit 0 */}
          <button
            type="button"
            id="keypad-0-btn"
            onClick={() => handleDigitPress('0')}
            disabled={isSubmitting}
            className="h-13 sm:h-14 rounded-2xl bg-slate-50 dark:bg-[#111B2E] hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xl font-bold transition-all active:scale-95 shadow-2xs flex items-center justify-center select-none cursor-pointer"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            id="keypad-backspace-btn"
            onClick={handleBackspace}
            disabled={isSubmitting || currentDisplayPin.length === 0}
            className="h-13 sm:h-14 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 active:bg-slate-100 dark:active:bg-slate-800 transition-all flex items-center justify-center disabled:opacity-30 select-none cursor-pointer"
            title="Delete digit"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Footer actions */}
        {hasPinSet ? (
          <div className="w-full pt-2">
            {!showForgotConfirm ? (
              <button
                type="button"
                id="forgot-pin-btn"
                onClick={() => setShowForgotConfirm(true)}
                className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
              >
                Forgot PIN? Reset & unlock vault
              </button>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-left space-y-2 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in">
                <p className="font-bold text-slate-900 dark:text-slate-100">Forgot or need to reset PIN?</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  You can reset the PIN to unlock your vault immediately. All your saved links and categories remain completely safe.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotConfirm(false)}
                    className="px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/40 rounded font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="confirm-reset-pin-btn"
                    onClick={async () => {
                      try {
                        setIsSubmitting(true);
                        await onResetPin();
                        setShowForgotConfirm(false);
                      } catch (err: any) {
                        setError('Reset failed: ' + err.message);
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="px-3 py-1 text-[11px] bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition-colors shadow-2xs cursor-pointer"
                  >
                    Reset & Unlock Now
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full pt-1 flex flex-col items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Secured with client-side SHA-256</span>
            </div>
            {onCancelSetup && (
              <button
                type="button"
                onClick={onCancelSetup}
                className="text-blue-600 dark:text-cyan-400 hover:underline font-medium text-xs mt-1 cursor-pointer"
              >
                Cancel / Skip for now
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
};
