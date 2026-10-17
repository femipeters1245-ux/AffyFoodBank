// backend/src/services/durable-otp.store.ts
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma/client';

export interface OtpRecord {
  id: string;
  email: string;
  hashedOtp: string;
  purpose: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  resendAfter: Date;
  consumedAt?: Date | null;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Local persistent file fallback for serverless warm cache or environments where DB table is initializing
const fallbackDir = path.resolve(process.cwd(), '.data');
const fallbackFilePath = path.join(fallbackDir, 'durable-otps.json');

// In-memory mirror for ultra-fast access and process fallback
const memoryStore = new Map<string, OtpRecord>();

// DB health tracking: If DB is unreachable, back off briefly to prevent hanging connections
let lastDbFailure = 0;
const DB_BACKOFF_MS = 15000;

function isDbTemporarilyUnavailable(): boolean {
  return Date.now() - lastDbFailure < DB_BACKOFF_MS;
}

function markDbFailure() {
  lastDbFailure = Date.now();
}

function withTimeout<T>(promise: Promise<T>, ms = 1500): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Database query timed out')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// Ensure fallback file exists and load
try {
  if (!fs.existsSync(fallbackDir)) {
    fs.mkdirSync(fallbackDir, { recursive: true });
  }
  if (fs.existsSync(fallbackFilePath)) {
    const raw = fs.readFileSync(fallbackFilePath, 'utf-8');
    const records: OtpRecord[] = JSON.parse(raw);
    const now = Date.now();
    for (const r of records) {
      if (new Date(r.expiresAt).getTime() > now) {
        memoryStore.set(r.id, {
          ...r,
          expiresAt: new Date(r.expiresAt),
          resendAfter: new Date(r.resendAfter),
          consumedAt: r.consumedAt ? new Date(r.consumedAt) : null,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        });
      }
    }
  }
} catch {
  // Ignore filesystem errors in restricted environments
}

function persistFallbackFile() {
  try {
    const records = Array.from(memoryStore.values());
    fs.writeFileSync(fallbackFilePath, JSON.stringify(records, null, 2), 'utf-8');
  } catch {
    // Ignore file write errors if disk is read-only
  }
}

export function getOtpSecret(): string {
  const secret = process.env.JWT_SECRET || 'affy-foodbank-secure-jwt-secret-otp-fallback';
  return secret;
}

/**
 * Compute SHA256-HMAC of OTP combined with normalized email and server secret.
 * The raw plaintext OTP is NEVER written to durable storage or logs.
 */
export function hashOtp(email: string, otp: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();
  const secret = getOtpSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`${normalizedEmail}:${cleanOtp}`)
    .digest('hex');
}

/**
 * Timing-safe comparison to prevent timing attacks
 */
export function verifyOtpHash(email: string, candidateOtp: string, expectedHash: string): boolean {
  try {
    const computed = hashOtp(email, candidateOtp);
    const bufA = Buffer.from(computed, 'hex');
    const bufB = Buffer.from(expectedHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export const durableOtpStore = {
  /**
   * Find the most recent active OTP for this email
   */
  async getLatestActiveOtp(email: string, purpose?: string): Promise<OtpRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    // 1. Try Prisma Database if healthy
    if (!isDbTemporarilyUnavailable()) {
      try {
        const dbRecord: any = await withTimeout<any>(
          (prisma as any).otpVerification.findFirst({
            where: {
              email: normalizedEmail,
              consumedAt: null,
              expiresAt: { gt: now },
              ...(purpose ? { purpose } : {}),
            },
            orderBy: { createdAt: 'desc' },
          }),
          1500
        );

        if (dbRecord) {
          return {
            id: dbRecord.id,
            email: dbRecord.email,
            hashedOtp: dbRecord.hashedOtp,
            purpose: dbRecord.purpose,
            attempts: dbRecord.attempts,
            maxAttempts: dbRecord.maxAttempts,
            expiresAt: dbRecord.expiresAt,
            resendAfter: dbRecord.resendAfter,
            consumedAt: dbRecord.consumedAt,
            metadata: dbRecord.metadata,
            createdAt: dbRecord.createdAt,
            updatedAt: dbRecord.updatedAt,
          };
        }
      } catch {
        markDbFailure();
      }
    }

    // 2. Fallback to Local Persistent Store
    let latest: OtpRecord | null = null;
    for (const record of memoryStore.values()) {
      if (
        record.email === normalizedEmail &&
        !record.consumedAt &&
        record.expiresAt.getTime() > now.getTime() &&
        (!purpose || record.purpose === purpose)
      ) {
        if (!latest || record.createdAt.getTime() > latest.createdAt.getTime()) {
          latest = record;
        }
      }
    }

    return latest;
  },

  /**
   * Save a newly generated hashed OTP into durable storage
   */
  async saveOtp(params: {
    email: string;
    hashedOtp: string;
    purpose: string;
    expiresAt: Date;
    resendAfter: Date;
    maxAttempts?: number;
    metadata?: any;
  }): Promise<OtpRecord> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const id = crypto.randomUUID();
    const maxAttempts = params.maxAttempts || 5;
    const now = new Date();

    const recordData: OtpRecord = {
      id,
      email: normalizedEmail,
      hashedOtp: params.hashedOtp,
      purpose: params.purpose,
      attempts: 0,
      maxAttempts,
      expiresAt: params.expiresAt,
      resendAfter: params.resendAfter,
      consumedAt: null,
      metadata: params.metadata || null,
      createdAt: now,
      updatedAt: now,
    };

    // Mirror in local durable fallback immediately
    memoryStore.set(id, recordData);
    persistFallbackFile();

    // Persist to PostgreSQL database (Supabase) if available
    if (!isDbTemporarilyUnavailable()) {
      try {
        const created: any = await withTimeout<any>(
          (prisma as any).otpVerification.create({
            data: {
              id,
              email: normalizedEmail,
              hashedOtp: params.hashedOtp,
              purpose: params.purpose,
              attempts: 0,
              maxAttempts,
              expiresAt: params.expiresAt,
              resendAfter: params.resendAfter,
              consumedAt: null,
              metadata: params.metadata || undefined,
            },
          }),
          1500
        );

        return {
          id: created.id,
          email: created.email,
          hashedOtp: created.hashedOtp,
          purpose: created.purpose,
          attempts: created.attempts,
          maxAttempts: created.maxAttempts,
          expiresAt: created.expiresAt,
          resendAfter: created.resendAfter,
          consumedAt: created.consumedAt,
          metadata: created.metadata,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };
      } catch (err: any) {
        markDbFailure();
      }
    }

    return recordData;
  },

  /**
   * Record a failed attempt and return the new attempt count
   */
  async incrementAttempts(id: string): Promise<number> {
    let attempts = 1;

    // Update memory/file store immediately
    const local = memoryStore.get(id);
    if (local) {
      local.attempts += 1;
      local.updatedAt = new Date();
      attempts = local.attempts;
      persistFallbackFile();
    }

    // Update database if available
    if (!isDbTemporarilyUnavailable()) {
      try {
        const updated: any = await withTimeout<any>(
          (prisma as any).otpVerification.update({
            where: { id },
            data: {
              attempts: { increment: 1 },
              updatedAt: new Date(),
            },
          }),
          1500
        );
        return updated.attempts;
      } catch {
        markDbFailure();
      }
    }

    return attempts;
  },

  /**
   * Mark OTP as successfully consumed so it cannot be reused
   */
  async markConsumed(id: string): Promise<void> {
    const now = new Date();

    const local = memoryStore.get(id);
    if (local) {
      local.consumedAt = now;
      local.updatedAt = now;
      persistFallbackFile();
    }

    if (!isDbTemporarilyUnavailable()) {
      try {
        await withTimeout(
          (prisma as any).otpVerification.update({
            where: { id },
            data: {
              consumedAt: now,
              updatedAt: now,
            },
          }),
          1500
        );
      } catch {
        markDbFailure();
      }
    }
  },

  /**
   * Invalidate/revoke an OTP (e.g. exceeded attempts)
   */
  async revokeOtp(id: string): Promise<void> {
    await this.markConsumed(id);
  },
};
