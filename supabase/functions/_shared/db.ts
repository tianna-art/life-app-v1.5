import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Service-role client. Only Edge Functions hold this key; it bypasses RLS, so
 * every handler must first resolve the caller and scope its queries by user id.
 */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase service credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Resolves the calling user from the request's Authorization header. */
export async function requireUser(request: Request): Promise<{ id: string }> {
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('UNAUTHENTICATED');

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) throw new Error('Supabase credentials are not configured.');

  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('UNAUTHENTICATED');
  return { id: data.user.id };
}
