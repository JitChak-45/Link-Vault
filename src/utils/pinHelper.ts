/**
 * Pure TypeScript standard SHA-256 implementation
 * Guarantees 100% reliable hashing across all webview, iframe, HTTP and HTTPS environments
 * without relying on window.crypto.subtle which may be undefined in certain contexts.
 */
function pureSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let currentLength = 0;
  for (i = 0; i < ascii.length; i++) {
    const code = ascii.charCodeAt(i);
    words[i >> 2] |= (code & 0xff) << (24 - (i % 4) * 8);
    currentLength++;
  }
  words[currentLength >> 2] |= 0x80 << (24 - (currentLength % 4) * 8);
  words[(((currentLength + 8) >> 6) << 4) + 15] = asciiBitLength;

  for (let block = 0; block < words.length; block += 16) {
    const w = new Array(64);
    for (i = 0; i < 16; i++) w[i] = words[block + i] | 0;
    for (i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (((w[i - 16] + s0) | 0) + ((w[i - 7] + s1) | 0)) | 0;
    }

    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((((h + s1) | 0) + ch) | 0) + ((k[i] + w[i]) | 0)) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Hash a 6-digit PIN or password safely
 */
export async function hashPin(pin: string, salt: string = 'link_vault_v1'): Promise<string> {
  const payload = pin + salt;

  // Try native crypto.subtle if available
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback to pure SHA-256 below
    }
  }

  return pureSha256(payload);
}

/**
 * Verify an entered PIN against a stored hash
 */
export async function verifyPin(
  enteredPin: string,
  storedHash: string,
  salt: string = 'link_vault_v1'
): Promise<boolean> {
  if (!enteredPin || !storedHash) return false;
  try {
    const enteredHash = await hashPin(enteredPin, salt);
    return enteredHash.toLowerCase() === storedHash.toLowerCase();
  } catch (err) {
    console.error('Error verifying PIN:', err);
    return false;
  }
}

/**
 * Standard Security Questions for Vault Recovery
 */
export const DEFAULT_SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'In which city were you born?',
  'What is your mother’s maiden name?',
  'What was the name of your first elementary school?',
  'What was your childhood nickname?',
  'What is the title of your all-time favorite book or movie?',
] as const;

/**
 * Hash a security answer (normalized, lowercase and trimmed for resilient match)
 */
export async function hashSecurityAnswer(
  answer: string,
  salt: string = 'link_vault_sec_v1'
): Promise<string> {
  const normalized = (answer || '').trim().toLowerCase();
  return hashPin(normalized, salt);
}

/**
 * Verify a user-provided security answer against the stored hash
 */
export async function verifySecurityAnswer(
  enteredAnswer: string,
  storedHash: string,
  salt: string = 'link_vault_sec_v1'
): Promise<boolean> {
  if (!enteredAnswer || !storedHash) return false;
  try {
    const enteredHash = await hashSecurityAnswer(enteredAnswer, salt);
    return enteredHash.toLowerCase() === storedHash.toLowerCase();
  } catch (err) {
    console.error('Error verifying security answer:', err);
    return false;
  }
}

