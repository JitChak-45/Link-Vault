import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Camera,
  Upload,
  Clipboard,
  AlertCircle,
  RefreshCw,
  Sparkles,
  FileImage,
  Zap,
  Loader2,
} from 'lucide-react';
import jsQR from 'jsqr';
import { decodeShareData, decodeShareDataAsync } from '../utils/qrHelper';
import { QrSharePayload } from '../types';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPayloadDecoded: (payload: QrSharePayload) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onPayloadDecoded,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'paste'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      const decoded = (await decodeShareDataAsync(code.data)) || decodeShareData(code.data);
      if (decoded) {
        stopCamera();
        onPayloadDecoded(decoded);
        onClose();
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [onClose, onPayloadDecoded, stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser or container.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsScanning(true);
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: unknown) {
      console.warn('Camera error:', err);
      const msg = err instanceof Error ? err.message : 'Unable to access camera';
      setCameraError(msg);
      setActiveTab('upload');
    }
  }, [facingMode, scanFrame, stopCamera]);

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, startCamera, stopCamera]);

  if (!isOpen) return null;

  // Handle uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data) {
          const decoded = (await decodeShareDataAsync(code.data)) || decodeShareData(code.data);
          if (decoded) {
            onPayloadDecoded(decoded);
            onClose();
            return;
          }
        }
        setPasteError('No valid Link Vault QR code found in this image. Try another screenshot.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handlePasteSubmit = async () => {
    setPasteError(null);
    const cleaned = pasteInput.trim();
    if (!cleaned) return;

    try {
      setIsResolving(true);
      const decoded =
        (await decodeShareDataAsync(cleaned)) || decodeShareData(cleaned);
      if (decoded) {
        onPayloadDecoded(decoded);
        stopCamera();
        onClose();
      } else {
        setPasteError('Invalid or expired code or link. Please verify your 6-digit Quick Code or share URL.');
      }
    } catch (err) {
      setPasteError('Failed to load shared bundle. Please check your network or code.');
    } finally {
      setIsResolving(false);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div
      id="qr-scanner-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => {
        stopCamera();
        onClose();
      }}
    >
      <div
        id="qr-scanner-modal-dialog"
        className="w-full max-w-md bg-white dark:bg-[#0D1422] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111B2E]/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk'] text-sm sm:text-base">Scan QR & Import</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Instantly import categories, links, and private settings
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-qr-scanner-modal-btn"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#111B2E] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#070B14]/40 p-1.5 gap-1 text-xs font-semibold">
          <button
            type="button"
            id="tab-camera-btn"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-white dark:bg-[#111B2E] text-blue-600 dark:text-cyan-400 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera</span>
          </button>
          <button
            type="button"
            id="tab-upload-btn"
            onClick={() => {
              stopCamera();
              setActiveTab('upload');
            }}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-[#111B2E] text-blue-600 dark:text-cyan-400 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
          <button
            type="button"
            id="tab-paste-btn"
            onClick={() => {
              stopCamera();
              setActiveTab('paste');
            }}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'bg-white dark:bg-[#111B2E] text-blue-600 dark:text-cyan-400 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-cyan-400" />
            <span>Quick Code / URL</span>
          </button>
        </div>

        {/* Tab 1: Live Camera Scanner */}
        {activeTab === 'camera' && (
          <div className="p-4 sm:p-5 flex flex-col items-center bg-white dark:bg-[#0D1422]">
            {cameraError ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 text-xs text-center space-y-3 w-full">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto" />
                <p className="font-semibold">Camera Access Unavailable</p>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  {cameraError}. You can still upload a QR code image/screenshot or paste the link directly!
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Upload QR Image
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative w-full aspect-square max-w-[280px] rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Target Frame / Reticle Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-cyan-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(15,23,42,0.6)]">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
                    {/* Animated scan line */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                </div>

                {/* Camera Flip Button */}
                <button
                  type="button"
                  id="flip-camera-btn"
                  onClick={toggleCamera}
                  className="absolute bottom-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
                  title="Switch camera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
              Point your camera at a Link Vault QR code to automatically detect and import links.
            </p>
          </div>
        )}

        {/* Tab 2: Upload Image */}
        {activeTab === 'upload' && (
          <div className="p-5 sm:p-6 text-center space-y-4 bg-white dark:bg-[#0D1422]">
            <label
              htmlFor="qr-file-upload-input"
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-cyan-400 rounded-2xl bg-slate-50/60 dark:bg-[#111B2E]/40 hover:bg-blue-50/30 dark:hover:bg-cyan-950/20 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <FileImage className="w-6 h-6" />
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                Click or drag QR image here
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Upload a screenshot, photo, or saved QR code
              </span>
              <input
                id="qr-file-upload-input"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {pasteError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                {pasteError}
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Quick Code / URL */}
        {activeTab === 'paste' && (
          <div className="p-5 sm:p-6 space-y-3 bg-white dark:bg-[#0D1422]">
            <label htmlFor="paste-code-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Enter 6-Digit Quick Code or Share Link:
            </label>
            <input
              id="paste-code-input"
              type="text"
              value={pasteInput}
              onChange={(e) => {
                setPasteInput(e.target.value);
                setPasteError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePasteSubmit();
                }
              }}
              placeholder="e.g. 742 918 or https://...#s=..."
              className="w-full text-sm font-mono p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#070B14] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-hidden focus:border-blue-600 dark:focus:border-cyan-400 focus:ring-1 focus:ring-blue-600 dark:focus:ring-cyan-400"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Enter the 6-digit code or paste any Link Vault share URL.
            </p>

            {pasteError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                {pasteError}
              </p>
            )}

            <button
              type="button"
              id="submit-pasted-code-btn"
              onClick={handlePasteSubmit}
              disabled={!pasteInput.trim() || isResolving}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-2"
            >
              {isResolving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading Bundle...</span>
                </>
              ) : (
                <span>Load & Import Links</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
