# Security — secrets & auth hardening

This documents the two fixes from "Tarefa 5" and what you must deploy for them.

## 1. Username login no longer leaks emails

**Before:** the client called a `security definer` SQL function
`email_for_username` that was granted to `anon`. Anyone, unauthenticated, could
send a username and get back that account's **email** → PII disclosure + user
enumeration.

**Now:**
- The function is **dropped** (`supabase/schema.sql`).
- Username login goes through the **`login-username`** Edge Function, which
  resolves the email server-side (service role) and returns a session **only**
  when the password is correct. The email never reaches the client, and every
  failure returns the same generic error (no enumeration).
- Email login is unchanged (direct client sign-in).

### Deploy
```bash
supabase functions deploy login-username
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by Supabase automatically — no extra secrets needed.

> If this function is **not** deployed, username login fails closed (users can
> still log in with their email). Nothing leaks either way.

## 2. Gemini API key is out of the client bundle

**Before:** `EXPO_PUBLIC_GEMINI_API_KEY` shipped in the app bundle and was put
in the request URL. `EXPO_PUBLIC_*` values are embedded in the client → the
billable key was extractable from the APK.

**Now:**
- Production AI calls go through the **`gemini-proxy`** Edge Function, which
  holds the key as a **server secret** and requires an authenticated caller.
- The direct `EXPO_PUBLIC_GEMINI_API_KEY` path is **dev-only** (logs a warning)
  and should never be in a release build.
- With neither configured, the app uses the **deterministic generator** — plans
  still work offline, with no AI and no key.

### Deploy
```bash
supabase secrets set GEMINI_API_KEY=your_key      # NOT an EXPO_PUBLIC var
supabase functions deploy gemini-proxy
```
Then enable the proxy in the app build env:
```
EXPO_PUBLIC_GEMINI_PROXY=1
```
and **remove** `EXPO_PUBLIC_GEMINI_API_KEY` from any production/EAS build env.

## Checklist before a public release
- [ ] `email_for_username` dropped (run the updated `supabase/schema.sql`).
- [ ] `login-username` + `gemini-proxy` deployed.
- [ ] `GEMINI_API_KEY` set as a Supabase secret.
- [ ] `EXPO_PUBLIC_GEMINI_API_KEY` **absent** from the release build env.
- [ ] `EXPO_PUBLIC_GEMINI_PROXY=1` in the release build env.
