// Feed layer: merges the user's own milestones (real, stored in
// gameState.feedEvents) with "other people's" activity.
//
// Today the "others" are simulated locally (feedSim). When there is a backend,
// just swap `getOthersFeed` for a real fetch — the merge and UI don't change.

import { getFeedEvents } from './progressStore';
import { generateOthersFeed } from '../config/feedSim';
import { fetchOthers, fetchOwn } from './feedRemote';
import { supabaseEnabled } from './supabase';

async function getOthersFeedLocal() {
  // No Supabase: use legacy Express if present, otherwise simulated.
  const remote = await fetchOthers(50);
  if (remote !== null) return remote;
  return generateOthersFeed(Date.now());
}

const byTs = (a, b) => b.ts - a.ts;

// filter: 'all' (own + others) | 'me' (own only)
export async function getFeed(filter = 'all') {
  if (supabaseEnabled) {
    // Online: EVERYTHING comes from the cloud. Own events persist across logins
    // (stored in feed_events with your user_id).
    const own = (await fetchOwn(50)) || [];
    if (filter === 'me') return own.sort(byTs);
    const others = (await fetchOthers(50)) || [];
    return [...own, ...others].sort(byTs);
  }

  // Local: own from gameState, others simulated.
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
