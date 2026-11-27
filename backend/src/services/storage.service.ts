// backend/src/services/storage.service.ts
import { supabaseAdmin } from './supabase-admin.service';
import logger from '../utils/logger';

export const ADP_DOCS_BUCKET = 'adp-verification-docs';

/**
 * Service for managing private student identity documents in Supabase Storage.
 * Security Rules:
 * - Bucket is strictly PRIVATE (not public).
 * - Documents are stored with path: `operators/${userId}/${timestamp}_${sanitizedFilename}`
 * - Download access is strictly via time-limited signed URLs (default 15 minutes) issued to authorized staff.
 */
export class StorageService {
  /**
   * Generates a signed upload URL for secure client-side direct upload to Supabase Storage.
   * This bypasses Vercel 4.5MB request payload limit.
   */
  async createSignedUploadUrl(
    userId: string,
    originalFileName: string
  ): Promise<{ signedUrl: string; token: string; path: string }> {
    const timestamp = Date.now();
    const sanitized = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `operators/${userId}/${timestamp}_${sanitized}`;

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not configured');
    }

    const { data, error } = await supabaseAdmin.storage
      .from(ADP_DOCS_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      logger.error('[StorageService] createSignedUploadUrl failed:', error);
      throw new Error(`Failed to initialize secure upload: ${error?.message || 'Storage error'}`);
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: storagePath,
    };
  }

  /**
   * Generates a short-lived (15 min) signed download URL for an authorized officer.
   */
  async createSignedDownloadUrl(
    storagePath: string,
    expiresInSeconds = 900 // 15 minutes
  ): Promise<string> {
    if (!storagePath) {
      throw new Error('Storage path is required');
    }

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not configured');
    }

    const { data, error } = await supabaseAdmin.storage
      .from(ADP_DOCS_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      logger.error('[StorageService] createSignedDownloadUrl failed:', error);
      throw new Error(`Failed to generate document download link: ${error?.message || 'Storage error'}`);
    }

    return data.signedUrl;
  }
}

export const storageService = new StorageService();
