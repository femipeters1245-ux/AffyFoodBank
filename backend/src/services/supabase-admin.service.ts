// backend/src/services/supabase-admin.service.ts
// Supabase Admin client (uses SERVICE_ROLE key - server-side only, never expose to browser)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseAdminConfigured = Boolean(
  supabaseUrl &&
    supabaseServiceKey &&
    !supabaseUrl.includes('YOUR_PROJECT_ID') &&
    supabaseUrl.startsWith('https://')
);

// Admin client bypasses RLS — only used server-side to verify tokens
export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Verify a Supabase JWT access_token and return the authenticated user's email.
 * Used in the token-exchange endpoint.
 */
export async function verifySupabaseToken(accessToken: string): Promise<{ email: string; id: string } | null> {
  if (!supabaseAdmin) {
    console.warn('[SupabaseAdmin] Admin client not configured — cannot verify token.');
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data?.user) {
    console.warn('[SupabaseAdmin] Token verification failed:', error?.message);
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email!,
  };
}
