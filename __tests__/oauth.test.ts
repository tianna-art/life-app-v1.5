/**
 * OAuth sign-in: the native path must hand the code back itself, and a user
 * closing the browser is not an error.
 */
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { oauthRedirectTo, signInWithProvider } from '@/lib/oauth';
import type { SupabaseClient } from '@supabase/supabase-js';

function fakeClient(overrides: {
  oauth?: { data?: { url?: string }; error?: { message: string } };
  exchange?: { error?: { message: string } };
}) {
  return {
    auth: {
      signInWithOAuth: jest.fn(async () => overrides.oauth ?? { data: { url: 'https://provider/auth' }, error: null }),
      exchangeCodeForSession: jest.fn(async () => overrides.exchange ?? { error: null }),
    },
  } as unknown as SupabaseClient;
}

describe('oauthRedirectTo', () => {
  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('uses the app scheme on a device so the provider can return to us', () => {
    Platform.OS = 'ios';
    expect(oauthRedirectTo()).toBe('crincran://auth-callback');
  });

  it('returns to the site root on web, so no extra route has to exist', () => {
    Platform.OS = 'web';
    // The native test environment has no window.location; stand one in.
    const globals = globalThis as { window?: unknown };
    const previous = globals.window;
    globals.window = { location: { origin: 'https://crincran.example' } };
    try {
      expect(oauthRedirectTo()).toBe('https://crincran.example');
    } finally {
      if (previous === undefined) delete globals.window;
      else globals.window = previous;
    }
  });
});

describe('signInWithProvider (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  it('exchanges the returned code for a session', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      url: 'crincran://auth-callback?code=abc123',
    });
    const client = fakeClient({});
    const result = await signInWithProvider(client, 'google');

    expect(result.ok).toBe(true);
    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
  });

  it('treats a closed browser as a cancel, not a failure to report', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({ type: 'cancel' });
    const client = fakeClient({});
    const result = await signInWithProvider(client, 'google');

    expect(result).toEqual({ ok: false, cancelled: true });
    expect(result.error).toBeUndefined();
    expect(client.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports a redirect that carries no code', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      url: 'crincran://auth-callback?error=access_denied',
    });
    const result = await signInWithProvider(fakeClient({}), 'google');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/authorization code/);
  });

  it('surfaces a provider error', async () => {
    const client = fakeClient({ oauth: { error: { message: 'provider is disabled' } } });
    const result = await signInWithProvider(client, 'google');
    expect(result).toEqual({ ok: false, error: 'provider is disabled' });
  });
});

describe('signInWithProvider (web)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'web';
  });

  it('lets the page redirect instead of opening an in-app browser', async () => {
    const client = fakeClient({});
    const result = await signInWithProvider(client, 'google');

    expect(result.ok).toBe(true);
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
    expect(client.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
