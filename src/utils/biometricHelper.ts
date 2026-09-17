/**
 * WebAuthn Platform Biometrics Helper (Fingerprint / Touch ID / Face ID)
 * Uses the native Web Authentication API with platform authenticators (authenticatorAttachment: 'platform')
 * to allow users to unlock Link Vault with their phone or device fingerprint.
 */

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

const STORAGE_CRED_ID = 'link_vault_biometric_cred_id';
const STORAGE_ENABLED = 'link_vault_biometric_enabled';

/**
 * Checks if the current document is embedded in an iframe (e.g. preview environment)
 */
export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Checks if WebAuthn platform biometrics are permitted by the current document's Permissions Policy
 */
export function isWebAuthnPermittedInFrame(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  // 1. Check Permissions Policy (W3C standard in Chromium / Safari)
  const permissionsPolicy = (document as any).permissionsPolicy;
  if (permissionsPolicy && typeof permissionsPolicy.allowsFeature === 'function') {
    try {
      if (!permissionsPolicy.allowsFeature('publickey-credentials-create')) {
        return false;
      }
    } catch {
      // ignore
    }
  }

  // 2. Check legacy Feature Policy
  const featurePolicy = (document as any).featurePolicy;
  if (featurePolicy && typeof featurePolicy.allowsFeature === 'function') {
    try {
      if (!featurePolicy.allowsFeature('publickey-credentials-create')) {
        return false;
      }
    } catch {
      // ignore
    }
  }

  return true;
}

/**
 * Checks if the browser and operating system support user-verifying platform biometrics (fingerprint / Face ID)
 */
export async function checkBiometricSupport(): Promise<{
  supported: boolean;
  enrolled: boolean;
  enabled: boolean;
  iframeRestricted: boolean;
}> {
  if (typeof window === 'undefined') {
    return { supported: false, enrolled: false, enabled: false, iframeRestricted: false };
  }

  const inIframe = isRunningInIframe();
  const permittedInFrame = isWebAuthnPermittedInFrame();
  const iframeRestricted = inIframe && !permittedInFrame;

  const hasWebAuthn = Boolean(window.PublicKeyCredential && navigator.credentials);
  let hasPlatformAuthenticator = false;

  if (hasWebAuthn) {
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        hasPlatformAuthenticator = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } else {
        hasPlatformAuthenticator = true;
      }
    } catch {
      hasPlatformAuthenticator = false;
    }
  }

  const enrolled = Boolean(localStorage.getItem(STORAGE_CRED_ID));
  const enabledSetting = localStorage.getItem(STORAGE_ENABLED);
  // Default to enabled if enrolled or if user hasn't explicitly disabled it
  const enabled = enabledSetting !== 'false';

  return {
    supported: hasWebAuthn && hasPlatformAuthenticator,
    enrolled,
    enabled,
    iframeRestricted,
  };
}

/**
 * Registers / Enrolls the device's native fingerprint with Link Vault
 */
export async function registerDeviceFingerprint(username = 'Link Vault User'): Promise<{
  success: boolean;
  error?: string;
  isIframeBlocked?: boolean;
}> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
      return { success: false, error: 'Biometrics are not supported on this browser or device.' };
    }

    if (!isWebAuthnPermittedInFrame()) {
      return {
        success: false,
        error: 'Fingerprint sensor is restricted inside the preview iframe. Open Link Vault in a separate browser tab or on your phone.',
        isIframeBlocked: true,
      };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Link Vault',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256 (P-256 curve, widely supported)
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Enforces on-device biometric sensor (Fingerprint / Touch ID / Face ID)
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!credential || !credential.rawId) {
      return { success: false, error: 'Registration did not complete.' };
    }

    const credIdBase64 = bufferToBase64(credential.rawId);
    localStorage.setItem(STORAGE_CRED_ID, credIdBase64);
    localStorage.setItem(STORAGE_ENABLED, 'true');

    return { success: true };
  } catch (err: any) {
    const msg = String(err?.message || '');
    const isPermissionsPolicy =
      err?.name === 'SecurityError' ||
      msg.includes('publickey-credentials') ||
      msg.includes('Permissions Policy') ||
      msg.includes('feature is not enabled') ||
      msg.includes('not enabled in this document') ||
      msg.includes('cross-origin') ||
      msg.includes('child frame') ||
      msg.includes('delegat');

    if (isPermissionsPolicy) {
      console.warn('WebAuthn biometrics restricted in frame:', msg);
      return {
        success: false,
        error: 'Fingerprint sensor requires opening Link Vault in a separate browser tab or on your phone.',
        isIframeBlocked: true,
      };
    }

    console.warn('Biometric registration did not complete:', msg);
    if (err?.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Fingerprint registration was cancelled or timed out. You can use your 6-digit PIN anytime.',
      };
    }
    return {
      success: false,
      error: msg || 'Failed to register device fingerprint.',
    };
  }
}

/**
 * Prompts the native phone/device fingerprint sensor to authenticate the user
 */
export async function authenticateWithFingerprint(): Promise<{
  success: boolean;
  error?: string;
  isIframeBlocked?: boolean;
}> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
      return { success: false, error: 'Biometrics are not supported on this browser.' };
    }

    if (!isWebAuthnPermittedInFrame()) {
      return {
        success: false,
        error: 'Fingerprint sensor is restricted inside the preview iframe. Open Link Vault in a separate browser tab or on your phone.',
        isIframeBlocked: true,
      };
    }

    const storedCredIdBase64 = localStorage.getItem(STORAGE_CRED_ID);
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (storedCredIdBase64) {
      try {
        allowCredentials.push({
          id: base64ToBuffer(storedCredIdBase64),
          type: 'public-key',
          transports: ['internal'],
        });
      } catch (e) {
        // Fallback without specific credential ID
      }
    }

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      rpId: window.location.hostname,
      userVerification: 'required',
      ...(allowCredentials.length > 0 ? { allowCredentials } : {}),
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    });

    if (assertion) {
      return { success: true };
    }
    return { success: false, error: 'Authentication failed.' };
  } catch (err: any) {
    const msg = String(err?.message || '');
    const isPermissionsPolicy =
      err?.name === 'SecurityError' ||
      msg.includes('publickey-credentials') ||
      msg.includes('Permissions Policy') ||
      msg.includes('feature is not enabled') ||
      msg.includes('not enabled in this document') ||
      msg.includes('cross-origin') ||
      msg.includes('child frame') ||
      msg.includes('delegat');

    if (isPermissionsPolicy) {
      console.warn('WebAuthn authentication restricted in frame:', msg);
      return {
        success: false,
        error: 'Fingerprint sensor requires opening Link Vault in a separate browser tab or on your phone.',
        isIframeBlocked: true,
      };
    }

    console.warn('Fingerprint verification could not complete:', msg);
    if (err?.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Fingerprint prompt was cancelled or timed out. You can use your 6-digit PIN anytime.',
      };
    }
    return {
      success: false,
      error: msg || 'Fingerprint verification failed.',
    };
  }
}

/**
 * Enable or disable biometric unlock toggle
 */
export function setBiometricEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_ENABLED, enabled ? 'true' : 'false');
}

/**
 * Remove enrolled fingerprint credential
 */
export function clearBiometricCredential(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_CRED_ID);
  localStorage.removeItem(STORAGE_ENABLED);
}

export const removeDeviceFingerprint = clearBiometricCredential;
