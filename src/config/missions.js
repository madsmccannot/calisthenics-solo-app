// Local generation of the daily missions (offline, no AI -> no cost).
// The workout mission is always included and auto-completes when the day's
// workout is done. The others are generated deterministically from the date,
// so they are stable during the day but change from day to day.
// The `label` fields are only a fallback — the UI translates by id (missions.<id>).

const WORKOUT_MISSION = {
  id: 'workout',
  emoji: '💪',
  label: "Complete today's workout",
  auto: true,
  xp: 150,
  coins: 40,
};

const POOL = [
  { id: 'water', emoji: '💧', label: 'Drink 2L of water', auto: false, xp: 60, coins: 15 },
  { id: 'stretch', emoji: '🧘', label: 'Stretch for 10 minutes', auto: false, xp: 50, coins: 15 },
  { id: 'sleep', emoji: '😴', label: 'Sleep 8 hours', auto: false, xp: 70, coins: 20 },
  { id: 'walk', emoji: '🚶', label: 'Walk for 30 minutes', auto: false, xp: 60, coins: 15 },
  { id: 'noSugar', emoji: '🚫', label: 'A day without sugar', auto: false, xp: 80, coins: 25 },
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Missions for a given date (a stable string, e.g. Date.toDateString()).
export function generateDailyMissions(dateStr) {
  const seed = hashStr(dateStr);
  const i1 = seed % POOL.length;
  // `>>>` (unsigned shift): `seed` is an unsigned 32-bit int, and `>>` would give
  // negative indices -> POOL[negative] = undefined -> invalid mission.
  let i2 = (i1 + 1 + ((seed >>> 5) % (POOL.length - 1))) % POOL.length;
  if (i2 === i1) i2 = (i1 + 1) % POOL.length;

  const items = [WORKOUT_MISSION, POOL[i1], POOL[i2]].map((m) => ({
    ...m,
    done: false,
  }));

  return { date: dateStr, items, claimed: false };
}

// Total reward for a set of missions (all completed).
export function missionRewards(missions) {
  return missions.items.reduce(
    (acc, m) => ({ xp: acc.xp + m.xp, coins: acc.coins + m.coins }),
    { xp: 0, coins: 0 }
  );
}
