/**
 * OAuth sign-in (Google).
 *
 * Web: Supabase redirects the page to the provider and back; the client is
 * configured with detectSessionInUrl, so the session appears on return.
 *
 * Native: the provider URL is opened in an in-app browser session that closes
 * on the app's own scheme, and the returned code is exchanged here.
 */
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { SupabaseClient, Provider } from '@supabase/supabase-js';

// Finishes any auth session left dangling by a browser redirect on web.
WebBrowser.maybeCompleteAuthSession();

export interface OAuthResult {
  ok: boolean;
  /** Populated only when the attempt failed for a reportable reason. */
  error?: string;
  /** True when the user closed the browser without finishing. */
  cancelled?: boolean;
}

export function oauthRedirectTo(): string {
  // On web, come back to the site root rather than a path: Expo Router would
  // otherwise have to match an /auth-callback route, and the client reads the
  // code straight out of the URL wherever it lands.
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.location
      ? window.location.origin
      : '/';
  }
  // Native: the in-app browser closes on this scheme and hands the code back.
  return Linking.createURL('auth-callback');
}

export async function signInWithProvider(
  supabase: SupabaseClient,
  provider: Provider
): Promise<OAuthResult> {
  const redirectTo = oauthRedirectTo();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) return { ok: false, error: error.message };

  // Web: the browser is already navigating away.
  if (Platform.OS === 'web') return { ok: true };

  if (!data?.url) return { ok: false, error: 'No authorization URL was returned.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, cancelled: true };
  }
  if (result.type !== 'success') return { ok: false, error: 'Sign-in did not complete.' };

  const code = new URL(result.url).searchParams.get('code');
  if (!code) return { ok: false, error: 'The provider returned no authorization code.' };

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return { ok: false, error: exchangeError.message };
  return { ok: true };
}
