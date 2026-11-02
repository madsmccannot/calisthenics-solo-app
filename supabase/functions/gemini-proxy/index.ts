// Edge Function: Gemini proxy.
//
// WHY: the Gemini API key is a billable secret and must not ship in the mobile
// bundle. The client sends the request body here; this function adds the key
// (a SERVER secret) and forwards to Gemini. Only authenticated users may call
// it, so it is not an open relay on someone else's quota.
//
// Deploy:  supabase functions deploy gemini-proxy
// Secret:  supabase secrets set GEMINI_API_KEY=xxxx   (NOT an EXPO_PUBLIC var)
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Require a logged-in user (verify the caller's JWT).
    const authHeader = req.headers.get('Authorization') ?? '';
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return json({ error: 'proxy not configured' }, 500);

    const body = await req.json();
    const r = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return json(data, r.status); // relay Gemini's status + body
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
