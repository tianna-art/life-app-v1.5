import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { useLocalStore } from '@/lib/env';
import { getRepository } from '@/data';

export interface AuthState {
  loading: boolean;
  session: Session | null;
  /** True when the app may show its content: signed in, or local-store mode. */
  ready: boolean;
  error: string | null;
}

/** Supabase email auth. In local-store mode auth is bypassed entirely. */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    ready: false,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();

    if (useLocalStore || !supabase) {
      void getRepository()
        .ensureBootstrapped()
        .finally(() => {
          if (active) setState({ loading: false, session: null, ready: true, error: null });
        });
      return () => {
        active = false;
      };
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) {
        try {
          await getRepository().ensureBootstrapped();
        } catch {
          /* bootstrap is retried on the next sign-in */
        }
      }
      if (!active) return;
      setState({
        loading: false,
        session: data.session,
        ready: Boolean(data.session),
        error: null,
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        try {
          await getRepository().ensureBootstrapped();
        } catch {
          /* ignore */
        }
      }
      if (!active) return;
      setState({ loading: false, session, ready: Boolean(session), error: null });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setState((s) => ({ ...s, loading: false, error: error.message }));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setState((s) => ({ ...s, loading: false, error: error.message }));
    else setState((s) => ({ ...s, loading: false }));
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  return { ...state, signIn, signUp, signOut, isLocalMode: useLocalStore };
}
