/**
 * Client environment. Only public values ever reach the bundle:
 * the Supabase URL + anon key (protected by RLS). LLM keys live exclusively in
 * Edge Function secrets and are never referenced from this directory.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const FORCE_LOCAL = process.env.EXPO_PUBLIC_USE_LOCAL_STORE === '1';

export const hasSupabaseConfig = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * Supabase is the shipped persistence layer. The on-device store is a
 * development fallback used only when the project is not configured yet.
 */
export const useLocalStore = FORCE_LOCAL || !hasSupabaseConfig;
