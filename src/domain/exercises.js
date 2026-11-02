// Exercise Knowledge Base — first slice.
//
// Pure, structured data + queries. No React / Expo / network / storage imports,
// so this module runs and is testable in isolation (deterministic core).
//
// It intentionally covers ONLY the 14 ids the app already supports (the same ids
// used by the AI prompt in geminiService.js and by xpTable.js), so the
// deterministic generator and the AI path stay interchangeable. Expanding the
// catalogue (muscles, equipment, progressions) is a later roadmap phase.

// Canonical training classes (these are profile.level values — kept as-is).
export const LEVELS = ['Iniciante', 'Intermédio', 'Avançado'];

// Each class may use any exercise whose difficulty tier <= the class tier.
export const LEVEL_TIER = { Iniciante: 1, 'Intermédio': 2, 'Avançado': 3 };

// Movement patterns — used to map a day's training focus to eligible exercises.
export const PATTERNS = ['push', 'legs', 'core', 'cardio'];

// Exercise types. 'reps' prescribes a repetition count; 'time' a hold in seconds.
export const TYPE_REPS = 'reps';
export const TYPE_TIME = 'time';

// Only these 9 Lottie files exist in assets/animations/. side_plank and
// hollow_body_hold have no file of their own and reuse plank.json (which is also
// AnimationPlayer's fallback for any unknown file).
export const ANIMATION_FILES = [
  'pushup.json', 'squat.json', 'burpee.json', 'plank.json',
  'mountain_climber.json', 'jumping_jack.json', 'lunge.json',
  'superman.json', 'leg_raise.json',
];

// id -> { pattern, tier (1..3), type, animation, localized display names }
export const EXERCISES = [
  { id: 'pushup_classic', pattern: 'push', tier: 1, type: TYPE_REPS, animation: 'pushup.json',
    names: { en: 'Classic Push-ups', pt: 'Flexões Clássicas', es: 'Flexiones Clásicas', fr: 'Pompes Classiques', de: 'Klassische Liegestütze' } },
  { id: 'pushup_wide', pattern: 'push', tier: 2, type: TYPE_REPS, animation: 'pushup.json',
    names: { en: 'Wide Push-ups', pt: 'Flexões Abertas', es: 'Flexiones Abiertas', fr: 'Pompes Larges', de: 'Breite Liegestütze' } },
  { id: 'pushup_diamond', pattern: 'push', tier: 3, type: TYPE_REPS, animation: 'pushup.json',
    names: { en: 'Diamond Push-ups', pt: 'Flexões Diamante', es: 'Flexiones Diamante', fr: 'Pompes Diamant', de: 'Diamant-Liegestütze' } },
  { id: 'squat_classic', pattern: 'legs', tier: 1, type: TYPE_REPS, animation: 'squat.json',
    names: { en: 'Squats', pt: 'Agachamentos', es: 'Sentadillas', fr: 'Squats', de: 'Kniebeugen' } },
  { id: 'squat_jump', pattern: 'legs', tier: 3, type: TYPE_REPS, animation: 'squat.json',
    names: { en: 'Jump Squats', pt: 'Agachamentos com Salto', es: 'Sentadillas con Salto', fr: 'Squats Sautés', de: 'Sprung-Kniebeugen' } },
  { id: 'lunge', pattern: 'legs', tier: 2, type: TYPE_REPS, animation: 'lunge.json',
    names: { en: 'Lunges', pt: 'Afundos', es: 'Zancadas', fr: 'Fentes', de: 'Ausfallschritte' } },
  { id: 'burpee', pattern: 'cardio', tier: 3, type: TYPE_REPS, animation: 'burpee.json',
    names: { en: 'Burpees', pt: 'Burpees', es: 'Burpees', fr: 'Burpees', de: 'Burpees' } },
  { id: 'mountain_climber', pattern: 'cardio', tier: 2, type: TYPE_REPS, animation: 'mountain_climber.json',
    names: { en: 'Mountain Climbers', pt: 'Escaladores', es: 'Escaladores', fr: 'Grimpeurs', de: 'Bergsteiger' } },
  { id: 'jumping_jack', pattern: 'cardio', tier: 1, type: TYPE_REPS, animation: 'jumping_jack.json',
    names: { en: 'Jumping Jacks', pt: 'Polichinelos', es: 'Saltos de Tijera', fr: 'Jumping Jacks', de: 'Hampelmänner' } },
  { id: 'leg_raise', pattern: 'core', tier: 2, type: TYPE_REPS, animation: 'leg_raise.json',
    names: { en: 'Leg Raises', pt: 'Elevações de Pernas', es: 'Elevaciones de Piernas', fr: 'Levers de Jambes', de: 'Beinheben' } },
  { id: 'superman', pattern: 'core', tier: 1, type: TYPE_REPS, animation: 'superman.json',
    names: { en: 'Superman', pt: 'Superman', es: 'Superman', fr: 'Superman', de: 'Superman' } },
  { id: 'plank', pattern: 'core', tier: 1, type: TYPE_TIME, animation: 'plank.json',
    names: { en: 'Plank', pt: 'Prancha', es: 'Plancha', fr: 'Planche', de: 'Unterarmstütz' } },
  { id: 'side_plank', pattern: 'core', tier: 2, type: TYPE_TIME, animation: 'plank.json',
    names: { en: 'Side Plank', pt: 'Prancha Lateral', es: 'Plancha Lateral', fr: 'Planche Latérale', de: 'Seitlicher Unterarmstütz' } },
  { id: 'hollow_body_hold', pattern: 'core', tier: 3, type: TYPE_TIME, animation: 'plank.json',
    names: { en: 'Hollow Body Hold', pt: 'Hollow Body', es: 'Hollow Body', fr: 'Hollow Body', de: 'Hollow-Body-Halten' } },
];

export const EXERCISE_IDS = EXERCISES.map((e) => e.id);

const BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id) {
  return BY_ID[id] || null;
}

// Localized display name (falls back to English, then the id).
export function exerciseName(id, lang = 'en') {
  const e = BY_ID[id];
  if (!e) return id;
  return e.names[lang] || e.names.en || id;
}

// Exercises a class may use, optionally filtered by movement pattern(s) and a
// list of excluded ids. A hard constraint: tier must never exceed the class.
export function eligibleExercises({ level = 'Iniciante', patterns = null, exclude = [] } = {}) {
  const maxTier = LEVEL_TIER[level] || 1;
  const excl = new Set(exclude);
  const allow = patterns ? new Set(patterns) : null;
  return EXERCISES.filter(
    (e) => e.tier <= maxTier && !excl.has(e.id) && (!allow || allow.has(e.pattern))
  );
}
