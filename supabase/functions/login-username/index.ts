// Edge Function: secure username -> session login.
//
// WHY: resolving a username to an email on the client (the old
// `email_for_username` RPC granted to `anon`) leaked PII and allowed username
// enumeration. This function keeps the email server-side and only returns a
// session when the password is correct. Every failure returns the same generic
// error, so a caller cannot tell whether a username exists.
//
// Deploy:  supabase functions deploy login-username
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are
//          injected automatically by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const fail = () => json({ error: 'Invalid login credentials.' }, 401);

  try {
    const { username, password } = await req.json();
    if (!username || !password) return fail();

    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Resolve the account by (case-insensitive) display name. Service role
    // bypasses RLS; the email is never sent back to the client.
    const { data: prof } = await admin
      .from('profiles').select('id').ilike('display_name', username).maybeSingle();
    if (!prof) return fail();

    const { data: userRes } = await admin.auth.admin.getUserById(prof.id);
    const email = userRes?.user?.email;
    if (!email) return fail();

    // Verify the password via a normal (anon) sign-in.
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: signIn, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !signIn?.session) return fail();

    return json({
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    });
  } catch (_e) {
    return fail();
  }
});
