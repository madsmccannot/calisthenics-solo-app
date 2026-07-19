// Regras declarativas das medalhas. Cada medalha tem uma `condition(ctx)`
// avaliada após eventos de progressão. Desbloqueá-la dá moedas.
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

// Tiers só afetam a cor da medalha.
export const TIERS = { bronze: 'bronze', silver: 'silver', gold: 'gold' };

export const MEDALS = [
  {
    id: 'first_workout', emoji: '🎖️', tier: 'bronze', coins: 25,
    title: 'Primeiro Treino', desc: 'Completa o teu primeiro treino',
    condition: (c) => c.stats.totalWorkouts >= 1,
  },
  {
    id: 'first_pushup', emoji: '🥉', tier: 'bronze', coins: 25,
    title: 'Primeira Flexão', desc: 'Faz a tua primeira flexão',
    condition: (c) => pushupReps(c) >= 1,
  },
  {
    id: 'workouts_10', emoji: '💪', tier: 'silver', coins: 50,
    title: '10 Treinos', desc: 'Completa 10 treinos',
    condition: (c) => c.stats.totalWorkouts >= 10,
  },
  {
    id: 'streak_7', emoji: '🥈', tier: 'silver', coins: 50,
    title: '7 Dias Seguidos', desc: 'Uma semana sem falhar',
    condition: (c) => c.streak.best >= 7,
  },
  {
    id: 'pushups_100', emoji: '✊', tier: 'silver', coins: 50,
    title: '100 Flexões', desc: 'Acumula 100 flexões no total',
    condition: (c) => pushupReps(c) >= 100,
  },
  {
    id: 'exercises_100', emoji: '📈', tier: 'silver', coins: 75,
    title: '100 Exercícios', desc: 'Completa 100 exercícios',
    condition: (c) => c.stats.totalExercises >= 100,
  },
  {
    id: 'level_5', emoji: '⭐', tier: 'silver', coins: 75,
    title: 'Discípulo', desc: 'Alcança o nível 5',
    condition: (c) => c.level >= 5,
  },
  {
    id: 'workouts_30', emoji: '🥇', tier: 'gold', coins: 100,
    title: '30 Treinos', desc: 'Completa 30 treinos',
    condition: (c) => c.stats.totalWorkouts >= 30,
  },
  {
    id: 'streak_30', emoji: '🔥', tier: 'gold', coins: 150,
    title: '30 Dias Sem Faltar', desc: 'Um mês inteiro de disciplina',
    condition: (c) => c.streak.best >= 30,
  },
  {
    id: 'level_10', emoji: '🌟', tier: 'gold', coins: 150,
    title: 'Atleta', desc: 'Alcança o nível 10',
    condition: (c) => c.level >= 10,
  },
  {
    id: 'weight_5kg', emoji: '⚖️', tier: 'gold', coins: 150,
    title: '-5kg', desc: 'Perde 5kg desde o primeiro registo',
    condition: (c) => weightLost(c) >= 5,
  },
  {
    id: 'pushups_1000', emoji: '🏆', tier: 'gold', coins: 250,
    title: '1000 Flexões', desc: 'Acumula 1000 flexões no total',
    condition: (c) => pushupReps(c) >= 1000,
  },
];
