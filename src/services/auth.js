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

// Login by email OR username. If it's not an email, resolve the email
// from the name (via a server RPC) and then sign in with the password.
export async function signInWithIdentifier(identifier, password) {
  let email = (identifier || '').trim();
  if (!email.includes('@')) {
    const { data, error } = await supabase.rpc('email_for_username', { uname: email });
    if (error || !data) {
      // English message so friendlyAuthError maps it to auth.errUserNotFound.
      return { session: null, error: { message: 'User not found.' } };
    }
    email = data;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { session: data?.session ?? null, error };
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
