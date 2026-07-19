// Camada de autenticação (email + password por agora; Google/Apple ligam depois
// quando os providers estiverem configurados no Supabase).

import { supabase, supabaseEnabled } from './supabase';

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
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  // Se o Supabase exigir confirmação de email, data.session vem null.
  return { session: data?.session ?? null, needsConfirmation: !data?.session && !error, error };
}

// Login por email OU nome de utilizador. Se não for email, resolve o email a
// partir do nome (via RPC no servidor) e depois entra com password.
export async function signInWithIdentifier(identifier, password) {
  let email = (identifier || '').trim();
  if (!email.includes('@')) {
    const { data, error } = await supabase.rpc('email_for_username', { uname: email });
    if (error || !data) {
      return { session: null, error: { message: 'Utilizador não encontrado.' } };
    }
    email = data;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { session: data?.session ?? null, error };
}

export async function signOut() {
  if (supabaseEnabled) await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabaseEnabled) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

// Subscreve mudanças de sessão (login/logout/refresh). Devolve unsubscribe.
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
