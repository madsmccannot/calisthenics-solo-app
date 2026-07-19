// Camada do Feed: junta os marcos do próprio utilizador (reais, guardados em
// gameState.feedEvents) com a atividade de "outros".
//
// Hoje os "outros" são simulados localmente (feedSim). Quando existir backend,
// basta trocar `getOthersFeed` por um fetch real — o merge e a UI não mudam.

import { getFeedEvents } from './progressStore';
import { generateOthersFeed } from '../config/feedSim';
import { fetchOthers, fetchOwn } from './feedRemote';
import { supabaseEnabled } from './supabase';

async function getOthersFeedLocal() {
  // Sem Supabase: usa Express legado se existir, senão simulado.
  const remote = await fetchOthers(50);
  if (remote !== null) return remote;
  return generateOthersFeed(Date.now());
}

const byTs = (a, b) => b.ts - a.ts;

// filter: 'all' (próprio + outros) | 'me' (só o próprio)
export async function getFeed(filter = 'all') {
  if (supabaseEnabled) {
    // Online: TUDO vem da nuvem. Os próprios eventos persistem entre logins
    // (guardados em feed_events com o teu user_id).
    const own = (await fetchOwn(50)) || [];
    if (filter === 'me') return own.sort(byTs);
    const others = (await fetchOthers(50)) || [];
    return [...own, ...others].sort(byTs);
  }

  // Local: próprios do gameState, outros simulados.
  const own = (await getFeedEvents()).map((e) => ({ ...e, who: 'you' }));
  if (filter === 'me') return own.sort(byTs);
  const others = await getOthersFeedLocal();
  return [...own, ...others].sort(byTs);
}

export function formatRelative(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d}d`;
}
