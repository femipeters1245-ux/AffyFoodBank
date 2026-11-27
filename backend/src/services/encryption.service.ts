// backend/src/services/encryption.service.ts
import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * AES-256-GCM Application-Level Encryption for Sensitive Financial Data (Bank Account Numbers)
 * Key requirements:
 * - 32-byte (256-bit) encryption key from BANK_ENCRYPTION_KEY environment variable.
 * - Random 12-byte IV (initialization vector) per encryption operation.
 * - 16-byte authentication tag for tamper detection (GCM mode).
 * - Format: `${ivHex}:${authTagHex}:${encryptedHex}`
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

// Fallback key only for test/development environments if not set in process.env
const DEFAULT_DEV_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function getEncryptionKey(): Buffer {
  const hexKey = process.env.BANK_ENCRYPTION_KEY || DEFAULT_DEV_KEY;
  if (hexKey.length !== 64) {
    throw new Error('BANK_ENCRYPTION_KEY must be a 64-character hex string (32 bytes / 256 bits)');
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypt sensitive plain text (e.g., 10-digit NUBAN account number)
 * Returns IV + AuthTag + Ciphertext as a colon-delimited string
 */
export function encryptSensitiveData(plainText: string): string {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('Invalid plainText for encryption');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plainText.trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt cipher text back to plain text with authentication tag verification.
 * Only callable by authorized server code (Finance / Admin operations).
 */
export function decryptSensitiveData(encryptedPayload: string): string {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload structure');
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks an account number for safe public and customer-facing display.
 * Example: '0123456789' -> '******6789'
 */
export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || typeof accountNumber !== 'string') return '******';
  const clean = accountNumber.trim();
  if (clean.length <= 4) return '****' + clean;
  const lastFour = clean.slice(-4);
  return '*'.repeat(Math.max(4, clean.length - 4)) + lastFour;
}
