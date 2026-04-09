import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Whether Supabase is configured. When false, the app falls back to
 * localStorage / file-based storage.
 */
export const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseServiceKey.length > 0;

/**
 * Server-side Supabase client with service role key (full access).
 * Only use this in API routes / server code — never import in client components.
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : (null as unknown as SupabaseClient);
