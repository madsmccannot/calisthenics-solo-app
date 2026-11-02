// Local <-> cloud sync (Supabase). Offline-first model:
//   - the app keeps reading/writing AsyncStorage as always (works offline)
//   - after each change, pushes a snapshot to the cloud (debounced)
//   - on login: if the account already has data -> pull; if not -> push (migration)
// Conflict strategy: last-write-wins (simple; 1 user per account).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseEnabled } from './supabase';
import { withGameLock } from './gameStateLock';

const K = {
  profile: 'userProfile',
  game: 'gameState',
  plan: 'workoutPlan',
  planClass: 'planClass',
  streak: 'streakData',
  weight: 'weightLog',
};
const OWNER_KEY = 'localOwnerId'; // which account the local data belongs to

async function getLocalOwner() {
  return AsyncStorage.getItem(OWNER_KEY);
}
async function setLocalOwner(uid) {
  if (uid) await AsyncStorage.setItem(OWNER_KEY, uid);
}
async function clearLocal() {
  await AsyncStorage.multiRemove([
    K.profile, K.game, K.plan, K.planClass, K.streak, K.weight, 'planStartDate', 'displayName',
  ]);
}

export async function getDisplayName() {
  return AsyncStorage.getItem('displayName');
}

export async function setDisplayName(name) {
  if (!name) return;
  await AsyncStorage.setItem('displayName', name);
  if (supabaseEnabled && currentUserId) {
    try {
      await supabase.from('profiles').update({ display_name: name }).eq('id', currentUserId);
    } catch {
      /* offline — goes on the next sync */
    }
  }
}

// Claims a username (checks uniqueness on the server).
// Returns { ok } or { ok:false, reason:'taken'|'error'|'offline' }.
export async function claimUsername(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { ok: false, reason: 'error' };
  if (!supabaseEnabled || !currentUserId) {
    await AsyncStorage.setItem('displayName', trimmed);
    return { ok: true };
  }
  const { error } = await supabase.from('profiles')
    .update({ display_name: trimmed })
    .eq('id', currentUserId);
  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'taken' }; // unique violation
    return { ok: false, reason: 'error' };
  }
  await AsyncStorage.setItem('displayName', trimmed);
  return { ok: true };
}

let currentUserId = null;
let timer = null;

export function setSyncUser(id) {
  currentUserId = id || null;
}

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// Surfaces a sync error instead of swallowing it. Sanitized: op name + message
// only — never the payload, tokens or personal data.
function reportSyncError(op, error) {
  if (!error) return false;
  const msg = error.message || error.code || String(error);
  if (typeof console !== 'undefined' && console.warn) console.warn(`[sync] ${op}: ${msg}`);
  return true;
}

// PostgREST `in` value list, each item double-quoted: ("01/01","02/01").
export function pgDateList(dates = []) {
  const items = (dates || []).map((d) => `"${String(d).replace(/"/g, '')}"`);
  return `(${items.join(',')})`;
}

// Pure mappers between local gameState and the `progress` table row.
export function gameToRow(game = {}) {
  return {
    xp: game.xp || 0,
    coins: game.coins || 0,
    season: game.season || 1,
    avatar: game.avatar || {},
    owned_items: game.ownedItems || [],
    medals: game.medals || {},
    stats: game.stats || {},
    missions: game.missions || null,
    rewarded_workouts: game.rewardedWorkouts || {},
  };
}

export function rowToGame(row = {}, prevFeed = []) {
  return {
    version: 1,
    xp: row.xp || 0,
    coins: row.coins || 0,
    season: row.season || 1,
    avatar: row.avatar || {},
    ownedItems: row.owned_items || [],
    medals: row.medals || {},
    stats: row.stats || {},
    missions: row.missions || null,
    rewardedWorkouts: row.rewarded_workouts || {},
    // Never discard local feed history on a pull.
    feedEvents: Array.isArray(prevFeed) ? prevFeed : [],
  };
}

// True when the last push left unsent changes (retried on reconnect/foreground).
let pendingPush = false;
export function hasPendingSync() {
  return pendingPush;
}

async function readLocal() {
  const [profile, game, plan, planClass, streak, weight, displayName] = await Promise.all([
    AsyncStorage.getItem(K.profile),
    AsyncStorage.getItem(K.game),
    AsyncStorage.getItem(K.plan),
    AsyncStorage.getItem(K.planClass),
    AsyncStorage.getItem(K.streak),
    AsyncStorage.getItem(K.weight),
    AsyncStorage.getItem('displayName'),
  ]);
  const parse = (s, fb) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };
  return {
    profile: parse(profile, null),
    game: parse(game, null),
    plan: parse(plan, null),
    planClass: planClass || null,
    streak: parse(streak, null),
    weight: parse(weight, []),
    displayName: displayName || null,
  };
}

// ── push the local state to the cloud ─────────────────────────────────────
// Non-destructive: every record is upserted (never delete-then-recreate), each
// operation's error is inspected and surfaced, and any failure marks the sync
// pending so it is retried. Returns { ok, failed }.
export async function pushSnapshot() {
  if (!supabaseEnabled || !currentUserId) return { ok: true, skipped: true };
  const uid = currentUserId;
  const d = await readLocal();
  const now = new Date().toISOString();
  const failed = [];

  const run = async (op, builder) => {
    try {
      const { error } = (await builder) || {};
      if (error) { reportSyncError(op, error); failed.push(op); }
    } catch (e) {
      reportSyncError(op, e); failed.push(op);
    }
  };

  if (d.profile || d.displayName) {
    const upd = { updated_at: now };
    if (d.profile) {
      upd.weight = num(d.profile.weight);
      upd.height = num(d.profile.height);
      upd.class = d.profile.level || 'Iniciante';
    }
    if (d.displayName) upd.display_name = d.displayName;
    await run('profiles', supabase.from('profiles').update(upd).eq('id', uid));
  }
  if (d.game) {
    await run('progress', supabase.from('progress').upsert({ user_id: uid, ...gameToRow(d.game), updated_at: now }));
  }
  if (d.plan) {
    await run('plans', supabase.from('plans').upsert({
      user_id: uid,
      season: d.game?.season || 1,
      plan_class: d.planClass,
      days: d.plan,
      updated_at: now,
    }));
  }
  if (d.streak) {
    await run('streaks', supabase.from('streaks').upsert({
      user_id: uid,
      current: d.streak.current || 0,
      best: d.streak.best || 0,
      last_completed_date: d.streak.lastCompletedDate || null,
    }));
  }

  // weight_log: upsert the current entries first (so nothing is lost if a later
  // step fails), then prune ONLY the rows the user removed — never delete-all.
  const weight = Array.isArray(d.weight) ? d.weight : [];
  if (weight.length) {
    await run('weight_log.upsert', supabase.from('weight_log').upsert(
      weight.map((w) => ({ user_id: uid, date: w.date, weight: num(w.weight) })),
      { onConflict: 'user_id,date' }
    ));
    await run('weight_log.prune', supabase
      .from('weight_log').delete().eq('user_id', uid)
      .not('date', 'in', pgDateList(weight.map((w) => w.date))));
  } else {
    // no local entries -> the user cleared them; drop the cloud copies
    await run('weight_log.clear', supabase.from('weight_log').delete().eq('user_id', uid));
  }

  const ok = failed.length === 0;
  pendingPush = !ok;
  return { ok, failed };
}

// ── pull the state from the cloud into local ──────────────────────────────
export async function pullSnapshot() {
  if (!supabaseEnabled || !currentUserId) return;
  const uid = currentUserId;
  try {
    const [prog, plan, streak, weight, prof] = await Promise.all([
      supabase.from('progress').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('plans').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('streaks').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('weight_log').select('date,weight,created_at').eq('user_id', uid).order('created_at'),
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    ]);

    for (const [op, r] of [['progress', prog], ['plans', plan], ['streaks', streak], ['weight_log', weight], ['profiles', prof]]) {
      if (r && r.error) reportSyncError(`pull.${op}`, r.error);
    }

    if (prog.data) {
      // Overwrite the local gameState under the same lock as local mutations, so
      // a pull can't land between a local read and its write (and vice-versa).
      // Reading the current feed and writing the merged state must be one atomic
      // step, otherwise a feed milestone logged in between would be lost.
      await withGameLock(async () => {
        let prevFeed = [];
        try { prevFeed = JSON.parse((await AsyncStorage.getItem(K.game)) || 'null')?.feedEvents || []; } catch {}
        await AsyncStorage.setItem(K.game, JSON.stringify(rowToGame(prog.data, prevFeed)));
      });
    }
    if (plan.data?.days) {
      await AsyncStorage.setItem(K.plan, JSON.stringify(plan.data.days));
      if (plan.data.plan_class) await AsyncStorage.setItem(K.planClass, plan.data.plan_class);
    }
    if (streak.data) {
      await AsyncStorage.setItem(K.streak, JSON.stringify({
        current: streak.data.current || 0,
        best: streak.data.best || 0,
        lastCompletedDate: streak.data.last_completed_date || null,
      }));
    }
    if (weight.data) {
      await AsyncStorage.setItem(K.weight, JSON.stringify(
        weight.data.map((w) => ({ date: w.date, weight: w.weight }))
      ));
    }
    if (prof.data && (prof.data.weight != null || prof.data.height != null)) {
      await AsyncStorage.setItem(K.profile, JSON.stringify({
        weight: prof.data.weight != null ? String(prof.data.weight) : '',
        height: prof.data.height != null ? String(prof.data.height) : '',
        level: prof.data.class || 'Iniciante',
      }));
    }
    if (prof.data?.display_name) {
      await AsyncStorage.setItem('displayName', prof.data.display_name);
    }
  } catch (e) {
    reportSyncError('pull', e); // offline / error -> keep whatever is in local
  }
}

async function cloudHasData() {
  try {
    const { data: plan } = await supabase.from('plans').select('user_id').eq('user_id', currentUserId).maybeSingle();
    if (plan) return true;
    const { data: p } = await supabase.from('progress').select('xp,stats').eq('user_id', currentUserId).maybeSingle();
    if (p && (p.xp > 0 || (p.stats && p.stats.totalWorkouts > 0))) return true;
    return false;
  } catch {
    return false;
  }
}

// FRESH auth (the user just registered or signed in). Deterministic:
// the local state now reflects the account EXACTLY.
//   - register (isNew): clear local -> account starts empty (SetupScreen)
//   - login: clear local and pull the account data
// Not called on session restore (reopening the app) -> there local is kept
// (offline-first).
export async function freshAuthSync(userId, isNew) {
  if (!supabaseEnabled) return;
  currentUserId = userId;
  await clearLocal();
  if (!isNew) await pullSnapshot(); // login brings the account data
  await setLocalOwner(userId);
}

// Debounced push (called after local changes).
export function scheduleSync() {
  if (!supabaseEnabled || !currentUserId) return;
  clearTimeout(timer);
  timer = setTimeout(() => { pushSnapshot(); }, 2500);
}

// Retries a previously failed push (e.g. on reconnect / app foreground).
export async function retrySync() {
  if (!supabaseEnabled || !currentUserId || !pendingPush) return;
  await pushSnapshot();
}

// Push now (e.g. app going to background).
export async function flushSync() {
  if (!supabaseEnabled || !currentUserId) return;
  clearTimeout(timer);
  await pushSnapshot();
}

// Clears the account's cloud data (used by "Reset Everything"). Does not delete the account.
export async function resetCloud() {
  if (!supabaseEnabled || !currentUserId) return;
  const uid = currentUserId;
  clearTimeout(timer);
  try {
    await supabase.from('plans').delete().eq('user_id', uid);
    await supabase.from('weight_log').delete().eq('user_id', uid);
    await supabase.from('progress').update({
      xp: 0, coins: 0, season: 1, avatar: {}, owned_items: [],
      medals: {}, stats: {}, missions: null,
    }).eq('user_id', uid);
    await supabase.from('streaks').update({
      current: 0, best: 0, last_completed_date: null,
    }).eq('user_id', uid);
  } catch {
    // offline / error — try again later
  }
}
