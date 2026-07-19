// FEED ONLINE. Com Supabase configurado, usa a tabela `feed_events` (marcos
// reais de outros utilizadores, com o nome guardado em cada evento). Sem
// Supabase, cai no cliente HTTP legado (EXPO_PUBLIC_FEED_API_URL) e, sem isso,
// o feed.js usa o fallback simulado.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseEnabled } from './supabase';
import { getClientId } from './localStore';

const BASE = process.env.EXPO_PUBLIC_FEED_API_URL;

export function remoteEnabled() {
  return supabaseEnabled || !!BASE;
}

async function currentUid() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch {
    return null;
  }
}

// Marcos de outros. `null` = sem qualquer backend (feed.js decide o simulado).
export async function fetchOthers(limit = 50) {
  if (supabaseEnabled) {
    try {
      const uid = await currentUid();
      let q = supabase
        .from('feed_events')
        .select('id, ts, emoji, title, subtitle, name')
        .order('ts', { ascending: false })
        .limit(limit);
      if (uid) q = q.neq('user_id', uid);
      const { data, error } = await q;
      if (error || !data) return [];
      return data.map((e) => ({
        id: String(e.id),
        ts: Number(e.ts) || Date.now(),
        who: 'other',
        name: e.name || 'Alguém',
        emoji: e.emoji || '💪',
        title: e.title || '',
        subtitle: e.subtitle || undefined,
      }));
    } catch {
      return [];
    }
  }

  if (!BASE) return null;
  try {
    const clientId = await getClientId();
    const res = await fetch(`${BASE}/feed?limit=${limit}&clientId=${encodeURIComponent(clientId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((e) => ({
      id: String(e.id ?? `${e.ts}-${e.name}`),
      ts: Number(e.ts) || Date.now(),
      who: 'other',
      name: e.name || 'Alguém',
      emoji: e.emoji || '💪',
      title: e.title || '',
      subtitle: e.subtitle,
    }));
  } catch {
    return [];
  }
}

// Marcos DO PRÓPRIO (da nuvem). `null` = sem Supabase (usar o local).
export async function fetchOwn(limit = 50) {
  if (!supabaseEnabled) return null;
  try {
    const uid = await currentUid();
    if (!uid) return [];
    const { data, error } = await supabase
      .from('feed_events')
      .select('id, ts, emoji, title, subtitle')
      .eq('user_id', uid)
      .order('ts', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((e) => ({
      id: String(e.id),
      ts: Number(e.ts) || Date.now(),
      who: 'you',
      emoji: e.emoji || '💪',
      title: e.title || '',
      subtitle: e.subtitle || undefined,
    }));
  } catch {
    return [];
  }
}

// Publica um marco do próprio (fire-and-forget).
export async function publishEvent(item) {
  if (supabaseEnabled) {
    try {
      const uid = await currentUid();
      if (!uid) return;
      const name = (await AsyncStorage.getItem('displayName')) || null;
      await supabase.from('feed_events').insert({
        user_id: uid,
        name,
        ts: item.ts,
        emoji: item.emoji,
        title: item.title,
        subtitle: item.subtitle || null,
      });
    } catch {
      /* offline / erro — falha silenciosa */
    }
    return;
  }

  if (!BASE) return;
  try {
    const clientId = await getClientId();
    await fetch(`${BASE}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        ts: item.ts,
        emoji: item.emoji,
        title: item.title,
        subtitle: item.subtitle,
      }),
    });
  } catch {
    // offline / erro
  }
}
