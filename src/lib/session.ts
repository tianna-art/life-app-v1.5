import { getSupabase } from './supabase';

/**
 * Ends the session. The root layout listens for the auth change and swaps the
 * app back to the gate on its own, so nothing here navigates.
 *
 * In local-store mode there is no session to end and this is a no-op — which
 * is why the menu hides the item entirely rather than offering a dead one.
 */
export async function signOutEverywhere(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}
