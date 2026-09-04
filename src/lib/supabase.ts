import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
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
        // PKCE keeps the OAuth code exchange safe on a device, where there is
        // no server to hold a client secret.
        flowType: 'pkce',
        // On web the provider redirects back to the page itself, so the client
        // picks the code out of the URL. On native we hand it over explicitly
        // after the in-app browser closes.
        detectSessionInUrl: Platform.OS === 'web',
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
