// ONLINE FEED. With Supabase configured, uses the `feed_events` table (real
// real milestones from other users, with the name stored in each event). Without
// Supabase, it falls back to the legacy HTTP client (EXPO_PUBLIC_FEED_API_URL) and, without that,
// feed.js uses the simulated fallback.

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

// Other people's milestones. `null` = no backend at all (feed.js picks the simulated one).
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

// The user's OWN milestones (from the cloud). `null` = no Supabase (use local).
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

// Publishes one of the user's milestones (fire-and-forget).
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
    // offline / error
  }
}
