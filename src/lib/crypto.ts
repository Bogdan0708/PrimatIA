import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.CNP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("CNP_ENCRYPTION_KEY/ENCRYPTION_KEY is not set");
  return Buffer.from(key, "hex");
}

/**
 * Encrypt CNP using AES-256-GCM.
 * Returns Buffer: [IV (12 bytes) | AuthTag (16 bytes) | Ciphertext]
 */
export function encryptCnp(cnp: string): Buffer {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(cnp, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt CNP from AES-256-GCM encrypted buffer.
 */
export function decryptCnp(encryptedData: Buffer): string {
  const key = getEncryptionKey();
  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = encryptedData.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Encrypt an arbitrary string using AES-256-GCM.
 * Returns a base64 string suitable for VarChar storage.
 */
export function encryptString(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a base64-encoded AES-256-GCM encrypted string.
 */
export function decryptString(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedBase64, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Generate a SHA-256 hash of CNP with per-tenant salt for lookup.
 */
export function hashCnp(cnp: string, tenantId: string): string {
  const salt =
    process.env.CNP_TENANT_SALT_SECRET || process.env.TENANT_SALT_SECRET;
  if (!salt) {
    throw new Error(
      "CNP_TENANT_SALT_SECRET/TENANT_SALT_SECRET is not set"
    );
  }

  return createHash("sha256")
    .update(`${tenantId}:${salt}:${cnp}`)
    .digest("hex");
}
