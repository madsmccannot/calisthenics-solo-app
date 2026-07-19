import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleSync } from './cloudSync';

const STREAK_KEY = 'streakData';
const WEIGHT_LOG_KEY = 'weightLog';
const CLIENT_ID_KEY = 'clientId';

// Id anónimo e persistente do dispositivo — usado para publicar os marcos do
// utilizador no feed online (o backend associa-o a um nome/perfil).
export async function getClientId() {
  try {
    let id = await AsyncStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      await AsyncStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return 'c_anon';
  }
}

export async function getStreakData() {
  try {
    const saved = await AsyncStorage.getItem(STREAK_KEY);
    if (!saved) return { current: 0, best: 0, lastCompletedDate: null };
    return JSON.parse(saved);
  } catch {
    return { current: 0, best: 0, lastCompletedDate: null };
  }
}

export async function updateStreak() {
  try {
    const data = await getStreakData();
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (data.lastCompletedDate === today) return data;

    let newCurrent;
    if (data.lastCompletedDate === yesterday) {
      newCurrent = data.current + 1;
    } else {
      newCurrent = 1;
    }

    const updated = {
      current: newCurrent,
      best: Math.max(newCurrent, data.best),
      lastCompletedDate: today,
    };

    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updated));
    scheduleSync();
    return updated;
  } catch {
    return { current: 0, best: 0, lastCompletedDate: null };
  }
}

export async function getWeightLog() {
  try {
    const saved = await AsyncStorage.getItem(WEIGHT_LOG_KEY);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export async function addWeightEntry(weight) {
  try {
    const log = await getWeightLog();
    const today = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
    
    // Substitui entrada do mesmo dia se já existir
    const filtered = log.filter((e) => e.date !== today);
    const updated = [...filtered, { date: today, weight: parseFloat(weight) }];
    
    // Mantém só as últimas 8 entradas
    const trimmed = updated.slice(-8);
    await AsyncStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(trimmed));
    scheduleSync();
    return trimmed;
  } catch {
    return [];
  }
}

export async function deleteWeightEntry(entry) {
  try {
    const log = await getWeightLog();
    const updated = log.filter((e) => !(e.date === entry.date && e.weight === entry.weight));
    await AsyncStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(updated));
    scheduleSync();
    return updated;
  } catch {
    return [];
  }
}