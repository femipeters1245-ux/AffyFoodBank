// backend/src/services/supabase-admin.service.ts
// Supabase Admin client for Database access only (RLS bypass for admin database tables)
// Supabase Auth has been completely removed in favor of Resend OTP and native sessions.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseAdminConfigured = Boolean(
  supabaseUrl &&
    supabaseServiceKey &&
    !supabaseUrl.includes('YOUR_PROJECT_ID') &&
    supabaseUrl.startsWith('https://')
);

// Admin database client — used strictly for database operations (products, inventory, etc.)
export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
