// Sincronização local <-> nuvem (Supabase). Modelo offline-first:
//   - a app continua a ler/escrever no AsyncStorage como sempre (funciona offline)
//   - depois de cada mudança, empurra um snapshot para a nuvem (debounced)
//   - ao logar: se a conta já tem dados -> puxa; se não -> empurra (migração)
// Estratégia de conflito: last-write-wins (simples; 1 utilizador por conta).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseEnabled } from './supabase';

const K = {
  profile: 'userProfile',
  game: 'gameState',
  plan: 'workoutPlan',
  planClass: 'planClass',
  streak: 'streakData',
  weight: 'weightLog',
};
const OWNER_KEY = 'localOwnerId'; // de que conta são os dados locais

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
      /* offline — vai na próxima sincronização */
    }
  }
}

// Reclama um nome de utilizador (verifica unicidade no servidor).
// Devolve { ok } ou { ok:false, reason:'taken'|'error'|'offline' }.
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

// ── empurra o estado local para a nuvem ──────────────────────────────────
export async function pushSnapshot() {
  if (!supabaseEnabled || !currentUserId) return;
  const uid = currentUserId;
  const d = await readLocal();
  const now = new Date().toISOString();
  try {
    if (d.profile || d.displayName) {
      const upd = { updated_at: now };
      if (d.profile) {
        upd.weight = num(d.profile.weight);
        upd.height = num(d.profile.height);
        upd.class = d.profile.level || 'Iniciante';
      }
      if (d.displayName) upd.display_name = d.displayName;
      await supabase.from('profiles').update(upd).eq('id', uid);
    }
    if (d.game) {
      await supabase.from('progress').upsert({
        user_id: uid,
        xp: d.game.xp || 0,
        coins: d.game.coins || 0,
        season: d.game.season || 1,
        avatar: d.game.avatar || {},
        owned_items: d.game.ownedItems || [],
        medals: d.game.medals || {},
        stats: d.game.stats || {},
        missions: d.game.missions || null,
        updated_at: now,
      });
    }
    if (d.plan) {
      await supabase.from('plans').upsert({
        user_id: uid,
        season: d.game?.season || 1,
        plan_class: d.planClass,
        days: d.plan,
        updated_at: now,
      });
    }
    if (d.streak) {
      await supabase.from('streaks').upsert({
        user_id: uid,
        current: d.streak.current || 0,
        best: d.streak.best || 0,
        last_completed_date: d.streak.lastCompletedDate || null,
      });
    }
    // peso: substitui tudo (simples e correto)
    await supabase.from('weight_log').delete().eq('user_id', uid);
    if (Array.isArray(d.weight) && d.weight.length) {
      await supabase.from('weight_log').insert(
        d.weight.map((w) => ({ user_id: uid, date: w.date, weight: num(w.weight) }))
      );
    }
  } catch {
    // offline / erro -> a próxima sincronização envia o estado mais recente
  }
}

// ── puxa o estado da nuvem para local ────────────────────────────────────
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

    if (prog.data) {
      await AsyncStorage.setItem(K.game, JSON.stringify({
        version: 1,
        xp: prog.data.xp || 0,
        coins: prog.data.coins || 0,
        season: prog.data.season || 1,
        avatar: prog.data.avatar || {},
        ownedItems: prog.data.owned_items || [],
        medals: prog.data.medals || {},
        stats: prog.data.stats || {},
        missions: prog.data.missions || null,
        feedEvents: [],
      }));
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
  } catch {
    // offline / erro -> fica com o que tem em local
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

// Autenticação FRESCA (o utilizador acabou de registar ou entrar). Determinístico:
// o estado local passa a refletir EXATAMENTE a conta.
//   - registo (isNew): limpa o local -> conta começa vazia (SetupScreen)
//   - login: limpa o local e puxa os dados da conta
// Não é chamado no restauro de sessão (reabrir a app) -> aí mantém-se o local
// (offline-first).
export async function freshAuthSync(userId, isNew) {
  if (!supabaseEnabled) return;
  currentUserId = userId;
  await clearLocal();
  if (!isNew) await pullSnapshot(); // login traz os dados da conta
  await setLocalOwner(userId);
}

// Empurra debounced (chamado após mudanças locais).
export function scheduleSync() {
  if (!supabaseEnabled || !currentUserId) return;
  clearTimeout(timer);
  timer = setTimeout(() => { pushSnapshot(); }, 2500);
}

// Empurra já (ex: app a ir para background).
export async function flushSync() {
  if (!supabaseEnabled || !currentUserId) return;
  clearTimeout(timer);
  await pushSnapshot();
}

// Limpa os dados da conta na nuvem (usado pelo "Resetar Tudo"). Não apaga a conta.
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
    // offline / erro — fica para outra altura
  }
}
