/**
 * TOTP (Time-based One-Time Password) helpers for staff MFA.
 * Uses otplib which implements RFC 6238.
 */

import { generateSecret as otplibGenerateSecret, verifySync } from "otplib";

/** Generate a new TOTP secret for a user. */
export function generateTOTPSecret(): string {
  return otplibGenerateSecret();
}

/**
 * Generate an otpauth:// URI for QR code scanning.
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 */
export function generateTOTPKeyURI(email: string, secret: string): string {
  const encodedIssuer = encodeURIComponent("PrimarIA");
  const encodedLabel = encodeURIComponent(`PrimarIA:${email}`);
  return `otpauth://totp/${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/** Verify a TOTP code against a secret. */
export function verifyTOTPToken(secret: string, token: string): boolean {
  try {
    const result = verifySync({ token, secret, period: 30, digits: 6 });
    // otplib v4 returns { valid: boolean, delta: number, ... }
    return (result as { valid: boolean }).valid === true;
  } catch {
    return false;
  }
}
