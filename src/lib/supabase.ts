import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseConfig } from './env';

let client: SupabaseClient | null = null;

/**
 * Lazily-created Supabase client. Returns null when the project has not been
 * configured, so the app can fall back to the local store instead of crashing.
 */
export function getSupabase(): SupabaseClient | null {
  if (!hasSupabaseConfig) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export function requireSupabase(): SupabaseClient {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}
