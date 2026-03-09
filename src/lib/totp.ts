import { createHmac, randomBytes } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;

function normalizeBase32(input: string): string {
  return input.toUpperCase().replace(/=+$/g, "").replace(/[\s-]/g, "");
}

/** Generate a new TOTP secret for a user. */
export function generateTotpSecret(bytes = 20): string {
  const buffer = randomBytes(bytes);
  let output = "";
  let bits = 0;
  let value = 0;

  for (let index = 0; index < buffer.length; index++) {
    const byte = buffer[index];
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/** Format secret for manual entry. */
export function formatTotpSecret(secret: string): string {
  return normalizeBase32(secret).match(/.{1,4}/g)?.join(" ") ?? secret;
}

export function decodeBase32(secret: string): Buffer {
  const normalized = normalizeBase32(secret);
  if (!normalized || /[^A-Z2-7]/.test(normalized)) {
    throw new Error("Invalid base32 secret");
  }

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** Generate a 6-digit TOTP code. */
export function generateTotpCode(
  secret: string,
  timestampMs = Date.now(),
  stepSeconds = DEFAULT_STEP_SECONDS,
  digits = DEFAULT_DIGITS
): string {
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** Verify a TOTP code against a secret. */
export function verifyTotpCode(
  secret: string,
  code: string,
  options?: {
    timestampMs?: number;
    stepSeconds?: number;
    digits?: number;
    window?: number;
  }
): boolean {
  const normalizedCode = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const timestampMs = options?.timestampMs ?? Date.now();
  const stepSeconds = options?.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const digits = options?.digits ?? DEFAULT_DIGITS;
  const window = options?.window ?? 1;

  for (let offset = -window; offset <= window; offset++) {
    const candidate = generateTotpCode(
      secret,
      timestampMs + offset * stepSeconds * 1000,
      stepSeconds,
      digits
    );
    if (candidate === normalizedCode) {
      return true;
    }
  }

  return false;
}

/** Build an otpauth URL for authenticator apps. */
export function buildOtpAuthUrl(params: {
  secret: string;
  accountName: string;
  issuer: string;
}) {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const issuer = encodeURIComponent(params.issuer);
  const secret = encodeURIComponent(normalizeBase32(params.secret));
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${DEFAULT_DIGITS}&period=${DEFAULT_STEP_SECONDS}`;
}

// Aliases for backward compatibility
export const generateTOTPSecret = generateTotpSecret;
export const verifyTOTPToken = (secret: string, token: string) => verifyTotpCode(secret, token);
export const generateTOTPKeyURI = (email: string, secret: string) => buildOtpAuthUrl({
  secret,
  accountName: email,
  issuer: "PrimarIA"
});
