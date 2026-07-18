// Fonte de verdade da progressão: XP, nível, moedas, missões, medalhas,
// avatar, season e stats vivem todos aqui, numa única key `gameState`.
// Toda a gamificação pendura neste serviço.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateDailyMissions } from '../config/missions';
import { streakBonus } from '../config/xpTable';

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
}) {
  const state = await getGameState();
  const before = getLevelInfo(state.xp);
  const sBonus = streakBonus(streak);
  const total = exercisesXp + bonus + sBonus;

  state.xp += total;
  state.stats.totalXpEarned += total;
  state.stats.totalWorkouts += 1;
  state.stats.totalExercises += exerciseCount;
  state.stats.totalReps += reps;
  state.stats.totalSeconds += seconds;

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
