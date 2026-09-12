import { getSupabase } from './supabase';

/**
 * The session, as マイページ needs to see it.
 *
 * Signing out lives here rather than in the screen so there is exactly one of
 * it: `useAuth` calls this too. Two sign-out paths is how one of them ends up
 * forgetting to do something the other does.
 */

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

/**
 * Who is signed in, for the one line マイページ shows above ログアウト.
 *
 * The address is shown because signing out of the wrong account, or moving
 * records to one, is a thing someone does deliberately — and cannot do
 * deliberately without being told which account they are in.
 */
export async function currentAccount(): Promise<{ email: string | null } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { email: data.user.email ?? null };
}
