// Auth layer (email + password for now; Google/Apple wired later
// when the providers are configured in Supabase).

import * as Linking from 'expo-linking';
import { supabase, supabaseEnabled } from './supabase';

// Deep link the email confirmation redirects back to.
// Standalone build: calisthenicssolo://auth-callback · Expo Go: exp://.../--/auth-callback
export function authRedirectUrl() {
  return Linking.createURL('auth-callback');
}

// Password strength (matches the Supabase policy). Returns translation keys.
export const PW_RULES = ['auth.pw8', 'auth.pwLower', 'auth.pwUpper', 'auth.pwDigit'];

export function passwordIssues(pw = '') {
  const issues = [];
  if (pw.length < 8) issues.push('auth.pw8');
  if (!/[a-z]/.test(pw)) issues.push('auth.pwLower');
  if (!/[A-Z]/.test(pw)) issues.push('auth.pwUpper');
  if (!/[0-9]/.test(pw)) issues.push('auth.pwDigit');
  return issues;
}
export function passwordStrong(pw) {
  return passwordIssues(pw).length === 0;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: authRedirectUrl() },
  });
  // If Supabase requires email confirmation, data.session is null.
  return { session: data?.session ?? null, needsConfirmation: !data?.session && !error, error };
}

// Completes the session from a deep link (email confirmation / magic link).
// Returns { session, error } or null if the URL is not an auth callback.
export async function handleAuthUrl(url) {
  if (!url || !supabaseEnabled) return null;
  try {
    const fragment = url.split('#')[1] || '';
    const query = (url.split('?')[1] || '').split('#')[0];
    const params = new URLSearchParams(fragment || query);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const code = params.get('code');
    const errDesc = params.get('error_description') || params.get('error');

    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return { session: data?.session ?? null, error };
    }
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      return { session: data?.session ?? null, error };
    }
    if (errDesc) return { session: null, error: { message: errDesc } };
    return null; // not an auth callback
  } catch (e) {
    return { session: null, error: e };
  }
}

// Login by email OR username.
// - email: a normal client-side password sign-in.
// - username: resolved by a SECURE Edge Function (`login-username`) that looks
//   up the email server-side and only returns a session when the password is
//   correct. The email is NEVER exposed to the client, and failures are generic
//   so a username cannot be enumerated. Requires the function to be deployed
//   (see docs/SECURITY.md); if it is not, username login fails closed.
export async function signInWithIdentifier(identifier, password) {
  const id = (identifier || '').trim();

  if (id.includes('@')) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: id, password });
    return { session: data?.session ?? null, error };
  }

  try {
    const { data, error } = await supabase.functions.invoke('login-username', {
      body: { username: id, password },
    });
    if (error || !data?.access_token) {
      // Generic message -> friendlyAuthError maps it to auth.errWrong (no
      // "user exists?" signal leaks to the client).
      return { session: null, error: { message: 'Invalid login credentials.' } };
    }
    const { data: sess, error: setErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    return { session: sess?.session ?? null, error: setErr };
  } catch (e) {
    return { session: null, error: { message: 'Invalid login credentials.' } };
  }
}

// Confirms a signup with the 6-digit code from the email (no deep link needed).
export async function verifySignupOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: (email || '').trim(),
    token: (token || '').trim(),
    type: 'signup',
  });
  return { session: data?.session ?? null, error };
}

// Resends the signup confirmation email/code.
export async function resendSignup(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: (email || '').trim() });
  return { error };
}

export async function signOut() {
  if (supabaseEnabled) await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabaseEnabled) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

// Subscribes to session changes (login/logout/refresh). Returns unsubscribe.
export function onAuthChange(cb) {
  if (!supabaseEnabled) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

// Maps a Supabase auth error to a translation key (the screen calls t()).
export function friendlyAuthError(error) {
  if (!error) return null;
  const m = (error.message || '').toLowerCase();
  if (m.includes('not found')) return 'auth.errUserNotFound';
  if (m.includes('invalid login')) return 'auth.errWrong';
  if (m.includes('already registered') || m.includes('already exists')) return 'auth.errExists';
  if (m.includes('password')) return 'auth.errPw';
  if (m.includes('email')) return 'auth.errEmail';
  if (m.includes('network') || m.includes('fetch')) return 'auth.errNetwork';
  return 'auth.errGeneric';
}
