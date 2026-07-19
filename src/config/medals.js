// Declarative medal rules. Each medal has a `condition(ctx)` evaluated after
// progression events. Unlocking one grants coins. Titles/descriptions are not
// here — the UI translates them by id (medal.<id>.title / .desc).
//
// ctx = {
//   stats: { totalWorkouts, totalExercises, totalReps, totalSeconds, repsByExercise },
//   level: number,
//   streak: { current, best },
//   weightLog: [{ date, weight }],
// }

const PUSHUP_IDS = ['pushup_classic', 'pushup_diamond', 'pushup_wide'];

function pushupReps(ctx) {
  const r = ctx.stats.repsByExercise || {};
  return PUSHUP_IDS.reduce((a, id) => a + (r[id] || 0), 0);
}

function weightLost(ctx) {
  const log = ctx.weightLog || [];
  if (log.length < 2) return 0;
  return Math.max(0, log[0].weight - log[log.length - 1].weight);
}

// Tiers only affect the medal color.
export const TIERS = { bronze: 'bronze', silver: 'silver', gold: 'gold' };

export const MEDALS = [
  { id: 'first_workout', emoji: '🎖️', tier: 'bronze', coins: 25, condition: (c) => c.stats.totalWorkouts >= 1 },
  { id: 'first_pushup', emoji: '🥉', tier: 'bronze', coins: 25, condition: (c) => pushupReps(c) >= 1 },
  { id: 'workouts_10', emoji: '💪', tier: 'silver', coins: 50, condition: (c) => c.stats.totalWorkouts >= 10 },
  { id: 'streak_7', emoji: '🥈', tier: 'silver', coins: 50, condition: (c) => c.streak.best >= 7 },
  { id: 'pushups_100', emoji: '✊', tier: 'silver', coins: 50, condition: (c) => pushupReps(c) >= 100 },
  { id: 'exercises_100', emoji: '📈', tier: 'silver', coins: 75, condition: (c) => c.stats.totalExercises >= 100 },
  { id: 'level_5', emoji: '⭐', tier: 'silver', coins: 75, condition: (c) => c.level >= 5 },
  { id: 'workouts_30', emoji: '🥇', tier: 'gold', coins: 100, condition: (c) => c.stats.totalWorkouts >= 30 },
  { id: 'streak_30', emoji: '🔥', tier: 'gold', coins: 150, condition: (c) => c.streak.best >= 30 },
  { id: 'level_10', emoji: '🌟', tier: 'gold', coins: 150, condition: (c) => c.level >= 10 },
  { id: 'weight_5kg', emoji: '⚖️', tier: 'gold', coins: 150, condition: (c) => weightLost(c) >= 5 },
  { id: 'pushups_1000', emoji: '🏆', tier: 'gold', coins: 250, condition: (c) => pushupReps(c) >= 1000 },
];
