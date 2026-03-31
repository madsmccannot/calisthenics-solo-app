import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_KEY = 'streakData';

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

    // Já treinou hoje — não altera
    if (data.lastCompletedDate === today) return data;

    let newCurrent;
    if (data.lastCompletedDate === yesterday) {
      // Treinou ontem — continua o streak
      newCurrent = data.current + 1;
    } else {
      // Falhou um dia — reset
      newCurrent = 1;
    }

    const updated = {
      current: newCurrent,
      best: Math.max(newCurrent, data.best),
      lastCompletedDate: today,
    };

    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return { current: 0, best: 0, lastCompletedDate: null };
  }
}