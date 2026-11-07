// backend/src/services/supabase-admin.service.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://jtwrnpqyvypvljgywwau.supabase.co';
const DEFAULT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0d3JucHF5dnlwdmxqZ3l3d2F1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTQ5Mjk1OCwiZXhwIjoyMTA3MDY4OTU4fQ.E1rdcNicpDbxVWGSLQnrLeEJFoWy5lE5FWBMEsNwFj0';

const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_KEY;

export const isSupabaseAdminConfigured = Boolean(
  supabaseUrl &&
    supabaseServiceKey &&
    !supabaseUrl.includes('YOUR_PROJECT_ID') &&
    supabaseUrl.startsWith('https://')
);

// Admin database and auth client — provides resilient data access across all environments
export const supabaseAdmin: SupabaseClient | null = isSupabaseAdminConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
