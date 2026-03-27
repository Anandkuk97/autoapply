import { createClient } from '@supabase/supabase-js';

/**
 * Admin Supabase client using the service role key.
 * This bypasses Row Level Security (RLS) — use ONLY in server-side code (API routes).
 * NEVER expose this client or the service role key to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey || serviceRoleKey === 'your_service_role_key_here') {
    console.warn(
      '[supabase-admin] SUPABASE_SERVICE_ROLE_KEY not configured. Falling back to anon key. ' +
      'Set it in .env.local from Supabase Dashboard > Settings > API Keys > service_role secret.'
    );
    // Fallback to anon key (will still be subject to RLS)
    return createClient(
      url || '',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || ''
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
