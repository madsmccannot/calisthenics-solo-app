// Configuração declarativa de quanto XP vale cada coisa. Mexer aqui reequilibra
// a economia sem tocar em lógica.

// Multiplicador de XP por classe de treino (reutiliza profile.level).
// Classes mais altas têm mais carga -> mais XP por exercício.
export const CLASS_MULT = {
  Iniciante: 1.0,
  Intermédio: 1.15,
  Avançado: 1.3,
};

// XP por repetição, por id de exercício (exercícios "reps").
// Calibrado para dar números limpos com quantidades típicas:
// pushup 2.5 x 12 = 30, squat 1.6 x 15 = 24, burpee 4 x 10 = 40.
const REP_RATE = {
  pushup_classic: 2.5,
  pushup_diamond: 3.0,
  pushup_wide: 2.7,
  squat_classic: 1.6,
  squat_jump: 2.2,
  lunge: 1.8,
  burpee: 4.0,
  mountain_climber: 1.2,
  jumping_jack: 1.0,
  leg_raise: 2.0,
  superman: 2.0,
};
const DEFAULT_REP_RATE = 2.0;

// XP por segundo, por id (exercícios de tempo/isometria).
const TIME_RATE = {
  plank: 0.6,
  side_plank: 0.7,
  hollow_body_hold: 0.7,
  superman: 0.6,
  mountain_climber: 0.5,
  jumping_jack: 0.4,
};
const DEFAULT_TIME_RATE = 0.5;

const MIN_XP = 5;

// XP de um único exercício, já com a classe aplicada.
export function xpForExercise(ex, className = 'Iniciante') {
  const mult = CLASS_MULT[className] ?? 1;
  const qty = Number(ex?.quantity) || 0;
  if (ex?.type === 'reps') {
    const rate = REP_RATE[ex.id] ?? DEFAULT_REP_RATE;
    return Math.max(MIN_XP, Math.round(rate * qty * mult));
  }
  const rate = TIME_RATE[ex?.id] ?? DEFAULT_TIME_RATE;
  return Math.max(MIN_XP, Math.round(rate * qty * mult));
}

// Repartição de XP de um treino inteiro -> [{ name, xp }].
export function xpBreakdown(exercises = [], className = 'Iniciante') {
  return exercises.map((ex) => ({
    name: ex.display_name,
    xp: xpForExercise(ex, className),
  }));
}

// Bónus fixo por terminar o treino.
export const COMPLETION_BONUS = 25;

// XP de recuperação (dias de descanso não têm exercícios).
export const RECOVERY_XP = 40;

// Bónus de streak: cresce com os dias seguidos, com teto.
export function streakBonus(streak = 0) {
  return Math.min(streak * 5, 100);
}
