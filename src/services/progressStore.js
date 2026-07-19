// Source of truth for progression: XP, level, coins, missions, medals, avatar,
// season and stats all live here, under a single `gameState` key.
// The whole gamification layer hangs off this service.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateDailyMissions } from '../config/missions';
import { streakBonus } from '../config/xpTable';
import { MEDALS } from '../config/medals';
import { getItem, DEFAULT_OWNED, SLOTS, defaultItemForSlot } from '../config/shopCatalog';
import { publishEvent } from './feedRemote';
import { scheduleSync } from './cloudSync';

const GAME_KEY = 'gameState';

const DEFAULT_STATE = {
  version: 1,
  xp: 0, // total accumulated XP (level is derived from this)
  coins: 0,
  season: 1,
  medals: {}, // { medalId: unlockedAtISO }
  avatar: {
    skin: 'default',
    hair: 'none',
    gloves: 'none',
    band: 'none',
    frame: 'none',
    theme: 'default',
  },
  ownedItems: [], // shop purchases
  missions: null, // { date, items:[...], claimed }
  feedEvents: [], // the user's own Feed milestones (most recent first)
  stats: {
    totalWorkouts: 0,
    totalExercises: 0,
    totalReps: 0,
    totalSeconds: 0,
    totalXpEarned: 0,
    repsByExercise: {}, // { exerciseId: reps } — used by medals
  },
};

// ---------- XP curve ----------
// XP needed to go FROM `level` to level+1. Grows linearly.
// 125 x level fits the owner's example (level 8 -> 1000 to reach 9).
export function xpForLevelUp(level) {
  return 125 * level;
}

// Given the total XP, returns the level and the progress within it.
export function getLevelInfo(totalXp) {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= xpForLevelUp(level)) {
    remaining -= xpForLevelUp(level);
    level += 1;
  }
  const xpForNext = xpForLevelUp(level);
  return {
    level,
    xpIntoLevel: remaining,
    xpForNext,
    progress: xpForNext > 0 ? remaining / xpForNext : 0,
  };
}

// ---------- Titles ----------
// Returns an i18n key; the screens translate it with t().
const TITLES = [
  { min: 50, key: 'title.titan' },
  { min: 35, key: 'title.legend' },
  { min: 20, key: 'title.elite' },
  { min: 10, key: 'title.athlete' },
  { min: 5, key: 'title.disciple' },
  { min: 1, key: 'title.novice' },
];

export function titleForLevel(level) {
  return TITLES.find((t) => level >= t.min)?.key || 'title.novice';
}

// ---------- Persistence ----------
export async function getGameState() {
  try {
    const saved = await AsyncStorage.getItem(GAME_KEY);
    if (!saved) return structuredCopy(DEFAULT_STATE);
    // merge with defaults to tolerate old states missing new fields
    const parsed = JSON.parse(saved);
    return {
      ...structuredCopy(DEFAULT_STATE),
      ...parsed,
      stats: { ...DEFAULT_STATE.stats, ...(parsed.stats || {}) },
      avatar: { ...DEFAULT_STATE.avatar, ...(parsed.avatar || {}) },
    };
  } catch {
    return structuredCopy(DEFAULT_STATE);
  }
}

async function save(state) {
  await AsyncStorage.setItem(GAME_KEY, JSON.stringify(state));
  scheduleSync(); // mirror to the cloud (debounced; no-op if offline/no account)
  return state;
}

function structuredCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function todayKey() {
  return new Date().toDateString();
}

// ---------- Summary for the Dashboard header ----------
export async function getProgressSummary() {
  const state = await getGameState();
  const info = getLevelInfo(state.xp);
  return {
    ...info,
    title: titleForLevel(info.level),
    coins: state.coins,
    xpTotal: state.xp,
    season: state.season,
    stats: state.stats,
  };
}

// ---------- XP and coins ----------
export async function addXp(amount) {
  const state = await getGameState();
  const before = getLevelInfo(state.xp);
  state.xp += amount;
  state.stats.totalXpEarned += amount;
  const after = getLevelInfo(state.xp);
  await save(state);
  return {
    xpAdded: amount,
    leveledUp: after.level > before.level,
    fromLevel: before.level,
    toLevel: after.level,
    levelInfo: after,
    title: titleForLevel(after.level),
  };
}

export async function addCoins(amount) {
  const state = await getGameState();
  state.coins += amount;
  await save(state);
  return state.coins;
}

// Closes a workout: adds XP (exercises + bonus + streak), records stats and
// marks the workout mission as done. A single read/write.
export async function completeWorkout({
  exercisesXp = 0,
  bonus = 0,
  streak = 0,
  exerciseCount = 0,
  reps = 0,
  seconds = 0,
  repsById = {},
}) {
  const state = await getGameState();
  const before = getLevelInfo(state.xp);
  const sBonus = streakBonus(streak);
  const total = exercisesXp + bonus + sBonus;
  const coinsEarned = Math.max(5, Math.round((exercisesXp + bonus) / 12));

  state.xp += total;
  state.coins += coinsEarned;
  state.stats.totalXpEarned += total;
  state.stats.totalWorkouts += 1;
  state.stats.totalExercises += exerciseCount;
  state.stats.totalReps += reps;
  state.stats.totalSeconds += seconds;

  // accumulate reps per exercise (for medals like "1000 push-ups")
  for (const [id, n] of Object.entries(repsById)) {
    state.stats.repsByExercise[id] = (state.stats.repsByExercise[id] || 0) + n;
  }

  ensureMissions(state);
  const wm = state.missions.items.find((i) => i.id === 'workout');
  if (wm) wm.done = true;

  await save(state);
  const after = getLevelInfo(state.xp);
  return {
    total,
    exercisesXp,
    bonus,
    streakBonus: sBonus,
    coinsEarned,
    leveledUp: after.level > before.level,
    fromLevel: before.level,
    toLevel: after.level,
    levelInfo: after,
    title: titleForLevel(after.level),
    coins: state.coins,
  };
}

// ---------- Missions ----------
function missionsValid(m) {
  return (
    m &&
    Array.isArray(m.items) &&
    m.items.length > 0 &&
    m.items.every((i) => i && i.id && typeof i.xp === 'number')
  );
}

function ensureMissions(state) {
  const today = todayKey();
  if (!missionsValid(state.missions) || state.missions.date !== today) {
    state.missions = generateDailyMissions(today);
  }
  return state.missions;
}

export async function getDailyMissions() {
  const state = await getGameState();
  const before = JSON.stringify(state.missions);
  ensureMissions(state);
  if (JSON.stringify(state.missions) !== before) await save(state);
  return state.missions;
}

export async function toggleMission(id) {
  const state = await getGameState();
  ensureMissions(state);
  const item = state.missions.items.find((i) => i.id === id);
  if (item && !item.auto) item.done = !item.done;
  await save(state);
  return state.missions;
}

// Claims the daily missions reward (only if all are complete).
export async function claimMissions() {
  const state = await getGameState();
  ensureMissions(state);
  const m = state.missions;
  if (m.claimed || !m.items.every((i) => i.done)) return null;

  const before = getLevelInfo(state.xp);
  const xp = m.items.reduce((a, i) => a + i.xp, 0);
  const coins = m.items.reduce((a, i) => a + i.coins, 0);
  m.claimed = true;
  state.xp += xp;
  state.coins += coins;
  state.stats.totalXpEarned += xp;
  await save(state);
  const after = getLevelInfo(state.xp);
  return {
    xp,
    coins,
    leveledUp: after.level > before.level,
    fromLevel: before.level,
    toLevel: after.level,
    levelInfo: after,
    title: titleForLevel(after.level),
  };
}

// Simple XP (used by recovery days).
export async function rewardRecovery(amount) {
  return addXp(amount);
}

// ---------- Feed (the user's own milestones) ----------
function pushFeed(state, event) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    who: 'you',
    ...event,
  };
  state.feedEvents = [item, ...(state.feedEvents || [])].slice(0, 50);
  publishEvent(item); // fire-and-forget: publica no backend se estiver configurado
}

export async function logFeedEvent(event) {
  const state = await getGameState();
  pushFeed(state, event);
  await save(state);
}

export async function getFeedEvents() {
  return (await getGameState()).feedEvents || [];
}

// ---------- Seasons ----------
export async function getSeason() {
  return (await getGameState()).season || 1;
}

export async function advanceSeason() {
  const state = await getGameState();
  state.season = (state.season || 1) + 1;
  await save(state);
  return state.season;
}

// Season tier i18n key: 1-3 numbered, then Elite/Master/Legend.
export function seasonTier(season = 1) {
  if (season >= 10) return 'tier.legend';
  if (season >= 7) return 'tier.master';
  if (season >= 4) return 'tier.elite';
  return null;
}

// Marks the day's workout mission as done without crediting workout XP
// (used when a recovery day is completed).
export async function markWorkoutMissionForToday() {
  const state = await getGameState();
  ensureMissions(state);
  const wm = state.missions.items.find((i) => i.id === 'workout');
  if (wm) wm.done = true;
  await save(state);
  return state.missions;
}

// ---------- Medals ----------
function buildMedalContext(state, { streak, weightLog }) {
  return {
    stats: state.stats,
    level: getLevelInfo(state.xp).level,
    streak: streak || { current: 0, best: 0 },
    weightLog: weightLog || [],
  };
}

// Evaluates all medals not yet unlocked. Newly unlocked ones are saved, grant
// coins, and are returned to show in the UI.
// `t` is the translator (optional): the medal's feed event is created in the
// user's current language at unlock time.
export async function checkMedals({ streak, weightLog, t } = {}) {
  const state = await getGameState();
  const ctx = buildMedalContext(state, { streak, weightLog });
  const newly = [];
  for (const m of MEDALS) {
    if (state.medals[m.id]) continue;
    if (m.condition(ctx)) {
      state.medals[m.id] = new Date().toISOString();
      state.coins += m.coins;
      newly.push(m);
      const title = t ? t('medal.' + m.id + '.title') : m.id;
      pushFeed(state, { emoji: m.emoji, title });
    }
  }
  if (newly.length) await save(state);
  return newly;
}

// ---------- Shop / Avatar ----------
function ownedSet(state) {
  return new Set([...DEFAULT_OWNED, ...(state.ownedItems || [])]);
}

// Normalizes the avatar: each slot -> a valid owned id, else the free item.
function normalizeAvatar(avatar = {}, owned) {
  const out = {};
  for (const slot of SLOTS) {
    const id = avatar[slot];
    const item = getItem(id);
    out[slot] = item && item.slot === slot && owned.has(id) ? id : defaultItemForSlot(slot);
  }
  return out;
}

// State for the appearance/shop screen.
export async function getLockerState() {
  const state = await getGameState();
  const owned = ownedSet(state);
  return {
    avatar: normalizeAvatar(state.avatar, owned),
    owned: Array.from(owned),
    coins: state.coins,
  };
}

// Just the normalized avatar (to draw anywhere).
export async function getAvatar() {
  const state = await getGameState();
  return normalizeAvatar(state.avatar, ownedSet(state));
}

export async function buyItem(itemId) {
  const state = await getGameState();
  const item = getItem(itemId);
  if (!item) return { ok: false, reason: 'invalid' };
  if (ownedSet(state).has(itemId)) return { ok: false, reason: 'owned' };
  if (state.coins < item.cost) return { ok: false, reason: 'coins', coins: state.coins };
  state.coins -= item.cost;
  state.ownedItems = Array.from(new Set([...(state.ownedItems || []), itemId]));
  // buying equips right away
  state.avatar = { ...normalizeAvatar(state.avatar, ownedSet(state)), [item.slot]: itemId };
  await save(state);
  return { ok: true, coins: state.coins };
}

export async function equipItem(slot, itemId) {
  const state = await getGameState();
  const item = getItem(itemId);
  if (!item || item.slot !== slot || !ownedSet(state).has(itemId)) return null;
  state.avatar = { ...normalizeAvatar(state.avatar, ownedSet(state)), [slot]: itemId };
  await save(state);
  return state.avatar;
}

// Full list of medals with their unlock state (for the wall).
export async function getMedalsStatus() {
  const state = await getGameState();
  return MEDALS.map((m) => ({
    id: m.id,
    emoji: m.emoji,
    tier: m.tier,
    coins: m.coins,
    unlocked: !!state.medals[m.id],
    unlockedAt: state.medals[m.id] || null,
  }));
}
