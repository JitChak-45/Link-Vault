import React, { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  HelpCircle,
  ArrowLeft,
  ShieldAlert,
  ChevronDown,
  Fingerprint,
  ExternalLink,
} from 'lucide-react';
import {
  hashPin,
  verifyPin,
  DEFAULT_SECURITY_QUESTIONS,
  hashSecurityAnswer,
  verifySecurityAnswer,
} from '../utils/pinHelper';
import {
  checkBiometricSupport,
  authenticateWithFingerprint,
  registerDeviceFingerprint,
} from '../utils/biometricHelper';

interface PinDotsProps {
  currentDisplayPin: string;
  revealDigits: boolean;
}

const PinDots = React.memo<PinDotsProps>(({ currentDisplayPin, revealDigits }) => {
  return (
    <div id="pin-dots-container" className="flex items-center justify-center gap-3 my-3">
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const isFilled = index < currentDisplayPin.length;
        const digitVal = currentDisplayPin[index];

        return (
          <div
            key={index}
            className={`w-4 h-4 rounded-full transition-colors duration-75 flex items-center justify-center ${
              isFilled
                ? 'bg-blue-600 dark:bg-cyan-400 border border-blue-500 dark:border-cyan-300 shadow-xs'
                : 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700'
            }`}
          >
            {isFilled && revealDigits && (
              <span className="text-[10px] font-bold text-white dark:text-slate-950">
                {digitVal}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

interface KeypadDigitProps {
  digit: string;
  onPress: (digit: string) => void;
  disabled: boolean;
}

const KeypadDigit = React.memo<KeypadDigitProps>(({ digit, onPress, disabled }) => {
  return (
    <button
      type="button"
      id={`keypad-digit-${digit}`}
      onClick={() => onPress(digit)}
      disabled={disabled}
      className="h-12 sm:h-13 rounded-2xl bg-slate-50 dark:bg-[#111B2E] hover:bg-slate-100 dark:hover:bg-[#16233B] active:bg-blue-600 active:text-white dark:active:bg-cyan-500 dark:active:text-slate-950 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-lg sm:text-xl font-bold font-['Space_Grotesk'] transition-colors duration-75 flex items-center justify-center active:scale-95 disabled:opacity-50 select-none shadow-2xs cursor-pointer touch-manipulation"
    >
      {digit}
    </button>
  );
});

interface PinKeypadProps {
  onDigitPress: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  isSubmitting: boolean;
  hasInput: boolean;
  onFingerprintPress?: () => void;
  showFingerprintKey?: boolean;
  isBiometricScanning?: boolean;
}

const PinKeypad = React.memo<PinKeypadProps>(({
  onDigitPress,
  onClear,
  onBackspace,
  isSubmitting,
  hasInput,
  onFingerprintPress,
  showFingerprintKey = false,
  isBiometricScanning = false,
}) => {
  return (
    <div id="pin-keypad" className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full max-w-[260px] mb-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <KeypadDigit
          key={digit}
          digit={digit}
          onPress={onDigitPress}
          disabled={isSubmitting}
        />
      ))}

      {/* Bottom-left: Fingerprint key when no input entered, or Clear button when digits exist */}
      {showFingerprintKey && !hasInput ? (
        <button
          type="button"
          id="keypad-fingerprint-btn"
          onClick={onFingerprintPress}
          disabled={isSubmitting || isBiometricScanning}
          className="h-12 sm:h-13 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 active:bg-cyan-200 dark:active:bg-cyan-900/70 border border-cyan-200/80 dark:border-cyan-800/60 text-cyan-600 dark:text-cyan-400 transition-all duration-75 flex flex-col items-center justify-center select-none cursor-pointer text-[10px] font-bold touch-manipulation group active:scale-95 shadow-2xs"
          title="Unlock with Fingerprint"
        >
          <Fingerprint className={`w-5 h-5 ${isBiometricScanning ? 'animate-pulse text-cyan-500' : 'group-hover:scale-110'} transition-transform`} />
          <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-extrabold mt-0.5">
            {isBiometricScanning ? 'Scan' : 'Touch'}
          </span>
        </button>
      ) : (
        <button
          type="button"
          id="keypad-clear-btn"
          onClick={onClear}
          disabled={isSubmitting || !hasInput}
          className="h-12 sm:h-13 rounded-2xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 active:bg-slate-200 dark:active:bg-slate-800 transition-colors duration-75 flex items-center justify-center disabled:opacity-20 select-none cursor-pointer text-xs font-semibold touch-manipulation"
          title="Clear input"
        >
          Clear
        </button>
      )}

      {/* Zero digit */}
      <KeypadDigit
        digit="0"
        onPress={onDigitPress}
        disabled={isSubmitting}
      />

      {/* Backspace button */}
      <button
        type="button"
        id="keypad-backspace-btn"
        onClick={onBackspace}
        disabled={isSubmitting || !hasInput}
        className="h-12 sm:h-13 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 active:bg-slate-200 dark:active:bg-slate-800 transition-colors duration-75 flex items-center justify-center disabled:opacity-30 select-none cursor-pointer touch-manipulation"
        title="Delete digit"
      >
        <Delete className="w-5 h-5" />
      </button>
    </div>
  );
});

interface PinLockScreenProps {
  isLocked: boolean;
  hasPinSet: boolean;
  storedPinHash: string | null;
  securityQuestion: string | null;
  securityAnswerHash: string | null;
  onUnlock: () => void;
  onPinConfigured: (
    newPinHash: string,
    newSecurityQuestion?: string,
    newSecurityAnswerHash?: string
  ) => Promise<void>;
  onResetPin: () => Promise<void>;
  onCancelSetup?: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  isLocked,
  hasPinSet,
  storedPinHash,
  securityQuestion,
  securityAnswerHash,
  onUnlock,
  onPinConfigured,
  onResetPin,
  onCancelSetup,
}) => {
  // Mode: 'enter-pin' | 'forgot-verify' | 'setup-pin'
  const [mode, setMode] = useState<'enter-pin' | 'forgot-verify' | 'setup-pin'>('enter-pin');
  
  // PIN states
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm' | 'security'>('create');
  const [tempFirstPin, setTempFirstPin] = useState('');
  const [pendingPinHash, setPendingPinHash] = useState<string | null>(null);

  // Security question states
  const [selectedQuestion, setSelectedQuestion] = useState<string>(
    securityQuestion || DEFAULT_SECURITY_QUESTIONS[0]
  );
  const [customQuestion, setCustomQuestion] = useState('');
  const [securityAnswerInput, setSecurityAnswerInput] = useState('');
  const [isForgotRecovery, setIsForgotRecovery] = useState(false);

  // Status & feedback
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealDigits, setRevealDigits] = useState(false);

  // Biometrics states (Phone Fingerprint / Touch ID)
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(true);
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [iframeRestrictedNotice, setIframeRestrictedNotice] = useState(false);

  const answerInputRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef(pin);
  pinRef.current = pin;
  const confirmPinRef = useRef(confirmPin);
  confirmPinRef.current = confirmPin;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const setupStepRef = useRef(setupStep);
  setupStepRef.current = setupStep;
  const tempFirstPinRef = useRef(tempFirstPin);
  tempFirstPinRef.current = tempFirstPin;
  const storedPinHashRef = useRef(storedPinHash);
  storedPinHashRef.current = storedPinHash;
  const securityQuestionRef = useRef(securityQuestion);
  securityQuestionRef.current = securityQuestion;
  const securityAnswerHashRef = useRef(securityAnswerHash);
  securityAnswerHashRef.current = securityAnswerHash;
  const isForgotRecoveryRef = useRef(isForgotRecovery);
  isForgotRecoveryRef.current = isForgotRecovery;
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;
  const onUnlockRef = useRef(onUnlock);
  onUnlockRef.current = onUnlock;
  const onPinConfiguredRef = useRef(onPinConfigured);
  onPinConfiguredRef.current = onPinConfigured;

  // Reset or initialize state whenever locked or pin state changes
  useEffect(() => {
    setPin('');
    pinRef.current = '';
    setConfirmPin('');
    confirmPinRef.current = '';
    setTempFirstPin('');
    tempFirstPinRef.current = '';
    setPendingPinHash(null);
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(false);
    isSubmittingRef.current = false;
    setIsForgotRecovery(false);
    setSecurityAnswerInput('');
    setCustomQuestion('');

    if (hasPinSet) {
      setMode('enter-pin');
      setSetupStep('create');
    } else {
      setMode('setup-pin');
      setSetupStep('create');
    }

    if (securityQuestion) {
      setSelectedQuestion(securityQuestion);
    } else {
      setSelectedQuestion(DEFAULT_SECURITY_QUESTIONS[0]);
    }
  }, [isLocked, hasPinSet, securityQuestion]);

  // Detect whether device supports platform fingerprint / biometrics
  useEffect(() => {
    if (!isLocked) return;
    let isMounted = true;
    checkBiometricSupport().then((status) => {
      if (!isMounted) return;
      setBiometricSupported(status.supported);
      setBiometricEnrolled(status.enrolled);
      setBiometricEnabledState(status.enabled);
    });
    return () => {
      isMounted = false;
    };
  }, [isLocked]);

  // Focus answer input when entering forgot-verify or security step
  useEffect(() => {
    if (mode === 'forgot-verify' || setupStep === 'security') {
      setTimeout(() => {
        answerInputRef.current?.focus();
      }, 50);
    }
  }, [mode, setupStep]);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 350);
  }, []);

  const triggerShakeRef = useRef(triggerShake);
  triggerShakeRef.current = triggerShake;

  // Handle digit press on numeric keypad (Ref-based accumulator + synchronous flushSync batching for 0ms input latency)
  const handleDigitPress = useCallback((digit: string) => {
    if (isSubmittingRef.current) return;

    const currentMode = modeRef.current;
    const currentStep = setupStepRef.current;

    if (currentMode === 'enter-pin') {
      // --- UNLOCK MODE ---
      if (!storedPinHashRef.current) return;
      if (pinRef.current.length >= 6) return;

      const nextPin = pinRef.current + digit;
      pinRef.current = nextPin;

      // Synchronously flush state update to guarantee 0ms UI lag on digit entry
      flushSync(() => {
        setPin(nextPin);
        setError(null);
      });

      if (nextPin.length === 6) {
        (async () => {
          try {
            setIsSubmitting(true);
            isSubmittingRef.current = true;
            const targetHash = storedPinHashRef.current;
            if (!targetHash) return;

            const isValid = await verifyPin(nextPin, targetHash);
            if (isValid) {
              setSuccessMsg('Unlocked!');
              setTimeout(() => {
                onUnlockRef.current();
                pinRef.current = '';
                setPin('');
                setSuccessMsg(null);
              }, 100);
            } else {
              triggerShakeRef.current();
              setError('Incorrect PIN. Please try again.');
              pinRef.current = '';
              setPin('');
            }
          } catch (err) {
            console.error('PIN verification error:', err);
            setError('Verification error. Please try again.');
            pinRef.current = '';
            setPin('');
          } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
          }
        })();
      }
    } else if (currentMode === 'setup-pin') {
      // --- SETUP PIN MODE ---
      if (currentStep === 'create') {
        if (pinRef.current.length >= 6) return;

        const nextPin = pinRef.current + digit;
        pinRef.current = nextPin;

        if (nextPin.length === 6) {
          flushSync(() => {
            setTempFirstPin(nextPin);
            tempFirstPinRef.current = nextPin;
            setPin('');
            pinRef.current = '';
            setSetupStep('confirm');
            setupStepRef.current = 'confirm';
            setError(null);
          });
        } else {
          flushSync(() => {
            setPin(nextPin);
            setError(null);
          });
        }
      } else if (currentStep === 'confirm') {
        if (confirmPinRef.current.length >= 6) return;

        const nextConfirm = confirmPinRef.current + digit;
        confirmPinRef.current = nextConfirm;

        if (nextConfirm.length === 6) {
          flushSync(() => {
            setConfirmPin(nextConfirm);
            setError(null);
          });

          if (nextConfirm === tempFirstPinRef.current) {
            (async () => {
              try {
                setIsSubmitting(true);
                isSubmittingRef.current = true;
                const newHash = await hashPin(nextConfirm);

                // If coming from forgot password recovery or question already exists
                if (
                  isForgotRecoveryRef.current &&
                  securityQuestionRef.current &&
                  securityAnswerHashRef.current
                ) {
                  await onPinConfiguredRef.current(newHash);
                  setSuccessMsg('New PIN set & Vault unlocked!');
                  setTimeout(() => {
                    onUnlockRef.current();
                    setSuccessMsg(null);
                    setIsForgotRecovery(false);
                  }, 200);
                } else if (
                  securityQuestionRef.current &&
                  securityAnswerHashRef.current &&
                  !isForgotRecoveryRef.current
                ) {
                  // Changing PIN with existing security question
                  await onPinConfiguredRef.current(newHash);
                  setSuccessMsg('PIN updated & secured!');
                  setTimeout(() => {
                    onUnlockRef.current();
                    setSuccessMsg(null);
                  }, 200);
                } else {
                  // First time setup: require setting a security question!
                  setPendingPinHash(newHash);
                  setSetupStep('security');
                  setupStepRef.current = 'security';
                  setError(null);
                }
              } catch (err: any) {
                console.error('Error saving PIN:', err);
                setError('Failed to save PIN. Please try again.');
              } finally {
                setIsSubmitting(false);
                isSubmittingRef.current = false;
              }
            })();
          } else {
            triggerShakeRef.current();
            setError('PINs did not match. Please re-enter.');
            flushSync(() => {
              setConfirmPin('');
              confirmPinRef.current = '';
              setPin('');
              pinRef.current = '';
              setTempFirstPin('');
              tempFirstPinRef.current = '';
              setSetupStep('create');
              setupStepRef.current = 'create';
            });
          }
        } else {
          flushSync(() => {
            setConfirmPin(nextConfirm);
            setError(null);
          });
        }
      }
    }
  }, []);

  const handleBackspace = useCallback(() => {
    if (isSubmittingRef.current) return;
    setError(null);
    const currentMode = modeRef.current;
    const currentStep = setupStepRef.current;

    if (currentMode === 'enter-pin' || (currentMode === 'setup-pin' && currentStep === 'create')) {
      const next = pinRef.current.slice(0, -1);
      pinRef.current = next;
      flushSync(() => {
        setPin(next);
      });
    } else if (currentMode === 'setup-pin' && currentStep === 'confirm') {
      const next = confirmPinRef.current.slice(0, -1);
      confirmPinRef.current = next;
      flushSync(() => {
        setConfirmPin(next);
      });
    }
  }, []);

  const handleClear = useCallback(() => {
    if (isSubmittingRef.current) return;
    pinRef.current = '';
    confirmPinRef.current = '';
    flushSync(() => {
      setError(null);
      setPin('');
      setConfirmPin('');
    });
  }, []);

  // Physical keyboard listener for PIN numeric keypad (attached once, zero re-binding lag)
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if focus is inside an input field
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

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

  // Handle Verify Security Question during Forgot PIN
  const handleVerifySecurityAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!securityAnswerInput.trim()) {
      setError('Please enter your security answer.');
      return;
    }

    if (!securityAnswerHash) {
      // Edge case: PIN set without security question (legacy)
      // Allow proceeding to set new PIN directly
      setIsForgotRecovery(true);
      setMode('setup-pin');
      setSetupStep('create');
      setPin('');
      setConfirmPin('');
      setTempFirstPin('');
      setSuccessMsg('Please enter your new 6-digit PIN.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const isCorrect = await verifySecurityAnswer(securityAnswerInput, securityAnswerHash);

      if (isCorrect) {
        setSuccessMsg('Security answer verified! Enter your new 6-digit PIN.');
        setIsForgotRecovery(true);
        setMode('setup-pin');
        setSetupStep('create');
        setPin('');
        setConfirmPin('');
        setTempFirstPin('');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        triggerShake();
        setError('Incorrect security answer. Please try again.');
      }
    } catch (err: any) {
      setError('Verification error: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save PIN + Security Question during first-time setup
  const handleSavePinWithSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPinHash) return;

    const effectiveQuestion =
      selectedQuestion === 'custom' ? customQuestion.trim() : selectedQuestion;

    if (!effectiveQuestion) {
      setError('Please select or enter a security question.');
      return;
    }

    if (!securityAnswerInput.trim()) {
      setError('Please provide an answer to your security question.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const answerHash = await hashSecurityAnswer(securityAnswerInput);
      await onPinConfigured(pendingPinHash, effectiveQuestion, answerHash);

      setSuccessMsg('PIN & Security Question saved! Vault secured.');
      setTimeout(() => {
        onUnlock();
        setSuccessMsg(null);
      }, 350);
    } catch (err: any) {
      console.error('Error saving PIN and security question:', err);
      setError('Failed to save security settings. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle phone fingerprint authentication / registration
  const handleFingerprintUnlock = async () => {
    if (isBiometricScanning || isSubmitting) return;
    setError(null);
    setSuccessMsg(null);
    setIframeRestrictedNotice(false);
    setIsBiometricScanning(true);

    try {
      if (!biometricEnrolled) {
        // Enrolling device fingerprint for the first time
        const regRes = await registerDeviceFingerprint('Link Vault User');
        if (regRes.success) {
          setBiometricEnrolled(true);
          setBiometricEnabledState(true);
          setSuccessMsg('Fingerprint registered! Unlocking vault...');
          setTimeout(() => {
            onUnlock();
          }, 350);
        } else {
          setError(regRes.error || 'Fingerprint registration cancelled.');
          if (regRes.isIframeBlocked) {
            setIframeRestrictedNotice(true);
          }
        }
      } else {
        // Authenticate with existing enrolled fingerprint
        const authRes = await authenticateWithFingerprint();
        if (authRes.success) {
          setSuccessMsg('Fingerprint verified! Unlocking vault...');
          setTimeout(() => {
            onUnlock();
          }, 300);
        } else {
          setError(authRes.error || 'Fingerprint verification failed.');
          if (authRes.isIframeBlocked) {
            setIframeRestrictedNotice(true);
          }
        }
      }
    } catch (err: any) {
      console.warn('Biometric unlock caught:', err?.message || err);
      setError('Fingerprint sensor not accessible. Please enter your 6-digit PIN.');
    } finally {
      setIsBiometricScanning(false);
    }
  };

  const currentDisplayPin =
    mode === 'enter-pin'
      ? pin
      : setupStep === 'create'
      ? pin
      : setupStep === 'confirm'
      ? confirmPin
      : '';

  return (
    <AnimatePresence>
      {isLocked && (
        <motion.div
          id="pin-lock-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#070B14]/95 backdrop-blur-md select-none overflow-y-auto"
        >
          <motion.div
            id="pin-lock-card"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`relative bg-white dark:bg-[#0D1422] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 w-full max-w-sm flex flex-col items-center text-center transition-transform ${
              isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
            }`}
          >
        {/* Cancel button if initial setup and can skip */}
        {!hasPinSet && onCancelSetup && mode === 'setup-pin' && (
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
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-cyan-400 flex items-center justify-center mb-3 shadow-xs">
          {mode === 'forgot-verify' ? (
            <HelpCircle className="w-7 h-7 text-cyan-500" />
          ) : mode === 'setup-pin' && setupStep === 'security' ? (
            <ShieldCheck className="w-7 h-7 text-emerald-500" />
          ) : mode === 'enter-pin' ? (
            <Lock className="w-7 h-7" />
          ) : (
            <KeyRound className="w-7 h-7" />
          )}
        </div>

        {/* Title & Subtitle */}
        {mode === 'forgot-verify' ? (
          <>
            <h2 className="text-xl font-extrabold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] tracking-tight">
              Security Verification
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 leading-relaxed">
              Answer your security question to verify your identity and choose a new PIN.
            </p>
          </>
        ) : mode === 'setup-pin' && setupStep === 'security' ? (
          <>
            <h2 className="text-xl font-extrabold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] tracking-tight">
              Security Question
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 leading-relaxed">
              Required to reset your PIN if you ever forget it.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-extrabold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] tracking-tight">
              {mode === 'enter-pin'
                ? 'Enter Security PIN'
                : isForgotRecovery
                ? setupStep === 'create'
                  ? 'Set New 6-Digit PIN'
                  : 'Confirm New 6-Digit PIN'
                : setupStep === 'create'
                ? 'Create 6-Digit PIN'
                : 'Confirm 6-Digit PIN'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 leading-relaxed">
              {mode === 'enter-pin'
                ? 'Your vault is locked. Enter your 6-digit PIN to access your links'
                : setupStep === 'create'
                ? 'Choose a 6-digit passcode to lock and protect your vault'
                : 'Re-enter your 6-digit code to verify and activate PIN protection'}
            </p>
          </>
        )}

        {/* Feedback messages */}
        {error && (
          <div className="w-full mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs flex flex-col items-center justify-center gap-1.5 animate-in fade-in">
            <div className="flex items-center justify-center gap-1.5 text-center">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            {iframeRestrictedNotice && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-100/80 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 text-[11px] font-bold hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open in New Tab to use Fingerprint</span>
              </a>
            )}
          </div>
        )}
        {successMsg && (
          <div className="w-full mb-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: FORGOT PIN SECURITY QUESTION VERIFICATION             */}
        {/* ------------------------------------------------------------- */}
        {mode === 'forgot-verify' && (
          <form onSubmit={handleVerifySecurityAnswer} className="w-full space-y-3.5 text-left">
            <div className="p-3.5 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-900/50">
              <span className="text-[11px] font-bold text-cyan-800 dark:text-cyan-300 uppercase tracking-wider block mb-1">
                Your Security Question:
              </span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {securityQuestion || 'What was the name of your first pet?'}
              </p>
            </div>

            <div>
              <label
                htmlFor="security-answer-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Security Answer
              </label>
              <input
                ref={answerInputRef}
                id="security-answer-input"
                type="text"
                autoComplete="off"
                placeholder="Type your answer..."
                value={securityAnswerInput}
                onChange={(e) => {
                  setSecurityAnswerInput(e.target.value);
                  setError(null);
                }}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#111B2E] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all placeholder:text-slate-400"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Answer is not case-sensitive.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                id="back-to-pin-btn"
                onClick={() => {
                  setMode('enter-pin');
                  setError(null);
                  setSecurityAnswerInput('');
                }}
                className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                id="verify-security-answer-btn"
                disabled={isSubmitting || !securityAnswerInput.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-xs font-bold transition-all shadow-md shadow-cyan-500/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'Verifying...' : 'Verify & Set New PIN'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 2: SECURITY QUESTION SETUP (After 6 digits confirmed)     */}
        {/* ------------------------------------------------------------- */}
        {mode === 'setup-pin' && setupStep === 'security' && (
          <form onSubmit={handleSavePinWithSecurity} className="w-full space-y-3.5 text-left">
            <div>
              <label
                htmlFor="select-security-question"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Choose Recovery Question
              </label>
              <div className="relative">
                <select
                  id="select-security-question"
                  value={selectedQuestion}
                  onChange={(e) => {
                    setSelectedQuestion(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111B2E] border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-cyan-500 appearance-none pr-8 cursor-pointer"
                >
                  {DEFAULT_SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value="custom">Write custom question...</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {selectedQuestion === 'custom' && (
              <div>
                <label
                  htmlFor="custom-question-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Custom Question
                </label>
                <input
                  id="custom-question-input"
                  type="text"
                  placeholder="e.g. What is my secret childhood word?"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111B2E] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="setup-security-answer-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Your Answer
              </label>
              <input
                ref={answerInputRef}
                id="setup-security-answer-input"
                type="text"
                autoComplete="off"
                placeholder="Enter secret answer..."
                value={securityAnswerInput}
                onChange={(e) => {
                  setSecurityAnswerInput(e.target.value);
                  setError(null);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#111B2E] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                Saved with SHA-256 encryption. Used only if you forget PIN.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSetupStep('confirm');
                  setConfirmPin('');
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                id="save-pin-and-question-btn"
                disabled={isSubmitting || !securityAnswerInput.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving...' : 'Finish & Lock Vault'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 3: 6-DIGIT PIN KEYPAD & DOTS (Standard / Setup)          */}
        {/* ------------------------------------------------------------- */}
        {(mode === 'enter-pin' || (mode === 'setup-pin' && setupStep !== 'security')) && (
          <>
            {/* PIN Dots Indicator */}
            <PinDots currentDisplayPin={currentDisplayPin} revealDigits={revealDigits} />

            {/* Toggle show digits */}
            <button
              type="button"
              id="toggle-reveal-digits-btn"
              onClick={() => setRevealDigits((prev) => !prev)}
              className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 mb-2.5 cursor-pointer select-none transition-colors"
            >
              {revealDigits ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{revealDigits ? 'Hide numbers' : 'Show numbers'}</span>
            </button>

            {/* Fingerprint Unlock Switch Key */}
            {mode === 'enter-pin' && (
              <button
                type="button"
                id="fingerprint-unlock-switch-btn"
                onClick={handleFingerprintUnlock}
                disabled={isBiometricScanning || isSubmitting}
                className="w-full max-w-[260px] flex items-center justify-between gap-2 px-3.5 py-2 mb-3 rounded-2xl bg-slate-100/90 dark:bg-[#111B2E] hover:bg-cyan-50 dark:hover:bg-cyan-950/40 active:bg-cyan-100 dark:active:bg-cyan-900/50 border border-slate-200/90 dark:border-slate-800 hover:border-cyan-400/60 dark:hover:border-cyan-600/60 transition-all cursor-pointer group shadow-2xs select-none active:scale-[0.98]"
                title="Unlock with your phone's fingerprint"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-cyan-500/10 dark:bg-cyan-400/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Fingerprint className={`w-4 h-4 ${isBiometricScanning ? 'animate-pulse text-cyan-500' : ''}`} />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                      {isBiometricScanning
                        ? 'Scanning Fingerprint...'
                        : biometricEnrolled
                        ? 'Unlock with Fingerprint'
                        : 'Enable Fingerprint Unlock'}
                    </span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500 -mt-0.5">
                      {biometricEnrolled ? 'Use phone screen lock sensor' : 'Tap to enable 1-touch unlock'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 dark:bg-cyan-400/10 px-2 py-0.5 rounded-lg border border-cyan-500/20 uppercase tracking-wider">
                  {isBiometricScanning ? 'Scan' : 'Key'}
                </span>
              </button>
            )}

            {/* Numeric Keypad (Memoized, 0ms input latency, stable callbacks) */}
            <PinKeypad
              onDigitPress={handleDigitPress}
              onClear={handleClear}
              onBackspace={handleBackspace}
              isSubmitting={isSubmitting}
              hasInput={currentDisplayPin.length > 0}
              showFingerprintKey={mode === 'enter-pin'}
              onFingerprintPress={handleFingerprintUnlock}
              isBiometricScanning={isBiometricScanning}
            />

            {/* Footer action: Forgot PIN button */}
            {mode === 'enter-pin' && (
              <div className="w-full pt-2">
                <button
                  type="button"
                  id="forgot-pin-btn"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setSecurityAnswerInput('');
                    setMode('forgot-verify');
                  }}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:text-cyan-400 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Forgot PIN? Answer security question</span>
                </button>
              </div>
            )}
          </>
        )}
          </motion.div>

          <style>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              20%, 60% { transform: translateX(-8px); }
              40%, 80% { transform: translateX(8px); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
