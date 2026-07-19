// Camada de autenticação (email + password por agora; Google/Apple ligam depois
// quando os providers estiverem configurados no Supabase).

import { supabase, supabaseEnabled } from './supabase';

// Regra de força da password (a condizer com a policy do Supabase).
export function passwordIssues(pw = '') {
  const issues = [];
  if (pw.length < 8) issues.push('pelo menos 8 caracteres');
  if (!/[a-z]/.test(pw)) issues.push('uma letra minúscula');
  if (!/[A-Z]/.test(pw)) issues.push('uma letra maiúscula');
  if (!/[0-9]/.test(pw)) issues.push('um número');
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

// Traduz erros do Supabase para PT (mensagens amigáveis).
export function friendlyAuthError(error) {
  if (!error) return null;
  const m = (error.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email ou password errados.';
  if (m.includes('already registered') || m.includes('already exists')) return 'Este email já tem conta.';
  if (m.includes('password')) return 'A password não cumpre os requisitos.';
  if (m.includes('email')) return 'Email inválido.';
  if (m.includes('network') || m.includes('fetch')) return 'Sem ligação. Verifica a internet.';
  return error.message || 'Algo correu mal. Tenta de novo.';
}
