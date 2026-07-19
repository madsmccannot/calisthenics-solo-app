// Declarative config of how much XP everything is worth. Tuning happens here,
// without touching logic.

// XP multiplier per training class (reuses profile.level).
// Higher classes have more load -> more XP per exercise.
export const CLASS_MULT = {
  Iniciante: 1.0,
  Intermédio: 1.15,
  Avançado: 1.3,
};

// XP per rep, by exercise id ("reps" exercises).
// Calibrated for clean numbers with typical quantities:
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

// XP per second, by id (time/isometric exercises).
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

// XP for a single exercise, with the class multiplier applied.
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

// XP breakdown for a whole workout -> [{ name, xp }].
export function xpBreakdown(exercises = [], className = 'Iniciante') {
  return exercises.map((ex) => ({
    name: ex.display_name,
    xp: xpForExercise(ex, className),
  }));
}

// Fixed bonus for finishing the workout.
export const COMPLETION_BONUS = 25;

// Recovery XP (rest days have no exercises).
export const RECOVERY_XP = 40;

// Streak bonus: grows with consecutive days, capped.
export function streakBonus(streak = 0) {
  return Math.min(streak * 5, 100);
}
