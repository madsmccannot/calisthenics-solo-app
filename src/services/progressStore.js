// Fonte de verdade da progressão: XP, nível, moedas, missões, medalhas,
// avatar, season e stats vivem todos aqui, numa única key `gameState`.
// Toda a gamificação pendura neste serviço.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateDailyMissions } from '../config/missions';
import { streakBonus } from '../config/xpTable';
import { MEDALS } from '../config/medals';
import { getItem, DEFAULT_OWNED, SLOTS, defaultItemForSlot } from '../config/shopCatalog';

const GAME_KEY = 'gameState';

const DEFAULT_STATE = {
  version: 1,
  xp: 0, // XP total acumulado (o nível é derivado disto)
  coins: 0,
  season: 1,
  medals: {}, // { medalId: unlockedAtISO } — usado a partir da Fase 2
  avatar: {
    skin: 'default',
    hair: 'none',
    gloves: 'none',
    band: 'none',
    frame: 'none',
    theme: 'default',
  },
  ownedItems: [], // compras na loja — Fase 3
  missions: null, // { date, items:[...], claimed }
  stats: {
    totalWorkouts: 0,
    totalExercises: 0,
    totalReps: 0,
    totalSeconds: 0,
    totalXpEarned: 0,
    repsByExercise: {}, // { exerciseId: reps } — usado pelas medalhas
  },
};

// ---------- Curva de XP ----------
// XP necessário para subir DE `level` para level+1. Cresce linearmente.
// 125 x nível bate certo com o exemplo do dono (nível 8 -> 1000 para o 9).
export function xpForLevelUp(level) {
  return 125 * level;
}

// Dado o XP total, devolve o nível e o progresso dentro dele.
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

// ---------- Títulos ----------
const TITLES = [
  { min: 50, name: 'Titã' },
  { min: 35, name: 'Lenda' },
  { min: 20, name: 'Elite' },
  { min: 10, name: 'Atleta' },
  { min: 5, name: 'Discípulo' },
  { min: 1, name: 'Novato' },
];

export function titleForLevel(level) {
  return TITLES.find((t) => level >= t.min)?.name || 'Novato';
}

// ---------- Persistência ----------
export async function getGameState() {
  try {
    const saved = await AsyncStorage.getItem(GAME_KEY);
    if (!saved) return structuredCopy(DEFAULT_STATE);
    // merge com defaults para tolerar estados antigos sem campos novos
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
  return state;
}

function structuredCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function todayKey() {
  return new Date().toDateString();
}

// ---------- Resumo para o header do Dashboard ----------
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

// ---------- XP e moedas ----------
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

// Fecha um treino: soma XP (exercícios + bónus + streak), regista stats e
// marca a missão de treino como feita. Uma só leitura/escrita.
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

  // acumula reps por exercício (para medalhas tipo "1000 flexões")
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

// ---------- Missões ----------
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

// Reclama a recompensa das missões diárias (só se todas completas).
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

// XP simples (usado pelos dias de recuperação).
export async function rewardRecovery(amount) {
  return addXp(amount);
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

// Rótulo de tier por season: 1-3 numeradas, depois Elite/Master/Legend.
export function seasonTier(season = 1) {
  if (season >= 10) return 'Legend';
  if (season >= 7) return 'Master';
  if (season >= 4) return 'Elite';
  return null;
}

// Marca a missão de treino do dia como feita sem creditar XP de treino
// (usado quando um dia de recuperação é concluído).
export async function markWorkoutMissionForToday() {
  const state = await getGameState();
  ensureMissions(state);
  const wm = state.missions.items.find((i) => i.id === 'workout');
  if (wm) wm.done = true;
  await save(state);
  return state.missions;
}

// ---------- Medalhas ----------
function buildMedalContext(state, { streak, weightLog }) {
  return {
    stats: state.stats,
    level: getLevelInfo(state.xp).level,
    streak: streak || { current: 0, best: 0 },
    weightLog: weightLog || [],
  };
}

// Avalia todas as medalhas ainda por desbloquear. As recém-desbloqueadas são
// gravadas, dão moedas, e devolvidas para mostrar na UI.
export async function checkMedals({ streak, weightLog } = {}) {
  const state = await getGameState();
  const ctx = buildMedalContext(state, { streak, weightLog });
  const newly = [];
  for (const m of MEDALS) {
    if (state.medals[m.id]) continue;
    if (m.condition(ctx)) {
      state.medals[m.id] = new Date().toISOString();
      state.coins += m.coins;
      newly.push(m);
    }
  }
  if (newly.length) await save(state);
  return newly;
}

// ---------- Loja / Avatar ----------
function ownedSet(state) {
  return new Set([...DEFAULT_OWNED, ...(state.ownedItems || [])]);
}

// Normaliza o avatar: cada slot -> id válido e possuído, senão o item grátis.
function normalizeAvatar(avatar = {}, owned) {
  const out = {};
  for (const slot of SLOTS) {
    const id = avatar[slot];
    const item = getItem(id);
    out[slot] = item && item.slot === slot && owned.has(id) ? id : defaultItemForSlot(slot);
  }
  return out;
}

// Estado para o ecrã de aparência/loja.
export async function getLockerState() {
  const state = await getGameState();
  const owned = ownedSet(state);
  return {
    avatar: normalizeAvatar(state.avatar, owned),
    owned: Array.from(owned),
    coins: state.coins,
  };
}

// Só o avatar normalizado (para desenhar em qualquer sítio).
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
  // compra equipa logo
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

// Lista completa de medalhas com o estado de desbloqueio (para a parede).
export async function getMedalsStatus() {
  const state = await getGameState();
  return MEDALS.map((m) => ({
    id: m.id,
    emoji: m.emoji,
    tier: m.tier,
    title: m.title,
    desc: m.desc,
    coins: m.coins,
    unlocked: !!state.medals[m.id],
    unlockedAt: state.medals[m.id] || null,
  }));
}
