// Geração local das missões diárias (offline, sem IA -> sem custos).
// A missão de treino é sempre incluída e é auto-completada quando o treino
// do dia é feito. As restantes são geradas de forma determinística a partir
// da data, por isso são estáveis durante o dia mas mudam de dia para dia.

const WORKOUT_MISSION = {
  id: 'workout',
  emoji: '💪',
  label: 'Completar o treino de hoje',
  auto: true,
  xp: 150,
  coins: 40,
};

const POOL = [
  { id: 'water', emoji: '💧', label: 'Beber 2L de água', auto: false, xp: 60, coins: 15 },
  { id: 'stretch', emoji: '🧘', label: 'Alongar 10 minutos', auto: false, xp: 50, coins: 15 },
  { id: 'sleep', emoji: '😴', label: 'Dormir 8 horas', auto: false, xp: 70, coins: 20 },
  { id: 'walk', emoji: '🚶', label: 'Caminhar 30 minutos', auto: false, xp: 60, coins: 15 },
  { id: 'noSugar', emoji: '🚫', label: 'Um dia sem açúcar', auto: false, xp: 80, coins: 25 },
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Missões para uma dada data (string estável, ex: Date.toDateString()).
export function generateDailyMissions(dateStr) {
  const seed = hashStr(dateStr);
  const i1 = seed % POOL.length;
  // `>>>` (shift sem sinal): `seed` é unsigned 32-bit, e `>>` daria índices
  // negativos -> POOL[negativo] = undefined -> missão inválida.
  let i2 = (i1 + 1 + ((seed >>> 5) % (POOL.length - 1))) % POOL.length;
  if (i2 === i1) i2 = (i1 + 1) % POOL.length;

  const items = [WORKOUT_MISSION, POOL[i1], POOL[i2]].map((m) => ({
    ...m,
    done: false,
  }));

  return { date: dateStr, items, claimed: false };
}

// Totais de recompensa de um conjunto de missões (todas completas).
export function missionRewards(missions) {
  return missions.items.reduce(
    (acc, m) => ({ xp: acc.xp + m.xp, coins: acc.coins + m.coins }),
    { xp: 0, coins: 0 }
  );
}
