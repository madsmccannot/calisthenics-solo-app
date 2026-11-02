// Exercise Knowledge Base.
//
// Pure, structured data + queries. No React / Expo / network / storage imports,
// so this module runs and is testable in isolation (deterministic core).
//
// It covers the 14 ids the app already supports (the same ids used by the AI
// prompt in geminiService.js and by xpTable.js), so the deterministic generator
// and the AI path stay interchangeable. The records now carry structured
// metadata (equipment, muscles, progression/regression relationships, cues,
// review status) so selection and future progression logic read from validated
// data instead of free text. Growing the number of exercises (new ids +
// animation assets, e.g. pulling coverage) is a later, asset-gated batch.

// Canonical training classes (these are profile.level values — kept as-is).
export const LEVELS = ['Iniciante', 'Intermédio', 'Avançado'];

// Each class may use any exercise whose difficulty tier <= the class tier.
export const LEVEL_TIER = { Iniciante: 1, 'Intermédio': 2, 'Avançado': 3 };

// Movement patterns — used to map a day's training focus to eligible exercises.
// NOTE: no 'pull' pattern yet — the catalogue has no pulling exercise (no bar in
// the floor/bodyweight scope, and no pull animation asset). Tracked as a gap.
export const PATTERNS = ['push', 'legs', 'core', 'cardio'];

// Exercise types. 'reps' prescribes a repetition count; 'time' a hold in seconds.
export const TYPE_REPS = 'reps';
export const TYPE_TIME = 'time';

// Controlled vocabulary — equipment. The whole catalogue is floor/bodyweight,
// but the field + filter exist so the programming engine can honour an
// equipment constraint once more exercises are added.
export const EQUIPMENT = ['none'];

// Controlled vocabulary — muscles. Selection/explanation code must use these
// tokens, never free-text muscle names.
export const MUSCLES = [
  'chest', 'triceps', 'shoulders', 'core', 'obliques', 'lower_back',
  'quads', 'glutes', 'hamstrings', 'calves', 'hip_flexors',
];

// Only these 9 Lottie files exist in assets/animations/. side_plank and
// hollow_body_hold have no file of their own and reuse plank.json (which is also
// AnimationPlayer's fallback for any unknown file).
export const ANIMATION_FILES = [
  'pushup.json', 'squat.json', 'burpee.json', 'plank.json',
  'mountain_climber.json', 'jumping_jack.json', 'lunge.json',
  'superman.json', 'leg_raise.json',
];

// Each record:
//   id         stable identifier (do not rename — persisted in stats/plans)
//   pattern    movement pattern (PATTERNS)
//   tier       difficulty/capability 1..3 (<= class tier to be eligible)
//   type       'reps' | 'time'
//   animation  Lottie file (ANIMATION_FILES)
//   equipment  required equipment (subset of EQUIPMENT); [] / ['none'] = none
//   primary    primary muscles worked (subset of MUSCLES, non-empty)
//   secondary  secondary muscles (subset of MUSCLES)
//   unilateral trains one side at a time
//   regression easier variant id in the same family (optional, must resolve)
//   progression harder variant id in the same family (optional, must resolve)
//   cues       short execution cues (English; UI localization is future work)
//   status     catalogue review status
//   names      localized display names (en/pt/es/fr/de all required)
export const EXERCISES = [
  { id: 'pushup_classic', pattern: 'push', tier: 1, type: TYPE_REPS, animation: 'pushup.json',
    equipment: ['none'], primary: ['chest', 'triceps'], secondary: ['shoulders', 'core'],
    unilateral: false, progression: 'pushup_wide',
    cues: ['Body in a straight line', 'Elbows ~45° to the torso'], status: 'reviewed',
    names: { en: 'Classic Push-ups', pt: 'Flexões Clássicas', es: 'Flexiones Clásicas', fr: 'Pompes Classiques', de: 'Klassische Liegestütze' } },
  { id: 'pushup_wide', pattern: 'push', tier: 2, type: TYPE_REPS, animation: 'pushup.json',
    equipment: ['none'], primary: ['chest'], secondary: ['shoulders', 'triceps'],
    unilateral: false, regression: 'pushup_classic', progression: 'pushup_diamond',
    cues: ['Hands wider than shoulders', 'Control the descent'], status: 'reviewed',
    names: { en: 'Wide Push-ups', pt: 'Flexões Abertas', es: 'Flexiones Abiertas', fr: 'Pompes Larges', de: 'Breite Liegestütze' } },
  { id: 'pushup_diamond', pattern: 'push', tier: 3, type: TYPE_REPS, animation: 'pushup.json',
    equipment: ['none'], primary: ['triceps', 'chest'], secondary: ['shoulders', 'core'],
    unilateral: false, regression: 'pushup_wide',
    cues: ['Hands form a diamond under the chest', 'Keep elbows close'], status: 'reviewed',
    names: { en: 'Diamond Push-ups', pt: 'Flexões Diamante', es: 'Flexiones Diamante', fr: 'Pompes Diamant', de: 'Diamant-Liegestütze' } },
  { id: 'squat_classic', pattern: 'legs', tier: 1, type: TYPE_REPS, animation: 'squat.json',
    equipment: ['none'], primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'],
    unilateral: false, progression: 'squat_jump',
    cues: ['Knees track over the toes', 'Hips back and down'], status: 'reviewed',
    names: { en: 'Squats', pt: 'Agachamentos', es: 'Sentadillas', fr: 'Squats', de: 'Kniebeugen' } },
  { id: 'squat_jump', pattern: 'legs', tier: 3, type: TYPE_REPS, animation: 'squat.json',
    equipment: ['none'], primary: ['quads', 'glutes'], secondary: ['calves', 'hamstrings'],
    unilateral: false, regression: 'squat_classic',
    cues: ['Explode up', 'Land soft with bent knees'], status: 'reviewed',
    names: { en: 'Jump Squats', pt: 'Agachamentos com Salto', es: 'Sentadillas con Salto', fr: 'Squats Sautés', de: 'Sprung-Kniebeugen' } },
  { id: 'lunge', pattern: 'legs', tier: 2, type: TYPE_REPS, animation: 'lunge.json',
    equipment: ['none'], primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'],
    unilateral: true, regression: 'squat_classic',
    cues: ['Front knee over the ankle', 'Torso upright'], status: 'reviewed',
    names: { en: 'Lunges', pt: 'Afundos', es: 'Zancadas', fr: 'Fentes', de: 'Ausfallschritte' } },
  { id: 'burpee', pattern: 'cardio', tier: 3, type: TYPE_REPS, animation: 'burpee.json',
    equipment: ['none'], primary: ['quads', 'chest'], secondary: ['core', 'shoulders'],
    unilateral: false,
    cues: ['Chest to floor', 'Jump at the top'], status: 'reviewed',
    names: { en: 'Burpees', pt: 'Burpees', es: 'Burpees', fr: 'Burpees', de: 'Burpees' } },
  { id: 'mountain_climber', pattern: 'cardio', tier: 2, type: TYPE_REPS, animation: 'mountain_climber.json',
    equipment: ['none'], primary: ['core', 'hip_flexors'], secondary: ['shoulders', 'quads'],
    unilateral: false,
    cues: ['Hips low and level', 'Drive the knees fast'], status: 'reviewed',
    names: { en: 'Mountain Climbers', pt: 'Escaladores', es: 'Escaladores', fr: 'Grimpeurs', de: 'Bergsteiger' } },
  { id: 'jumping_jack', pattern: 'cardio', tier: 1, type: TYPE_REPS, animation: 'jumping_jack.json',
    equipment: ['none'], primary: ['calves', 'shoulders'], secondary: ['glutes'],
    unilateral: false,
    cues: ['Light on the feet', 'Full arm swing'], status: 'reviewed',
    names: { en: 'Jumping Jacks', pt: 'Polichinelos', es: 'Saltos de Tijera', fr: 'Jumping Jacks', de: 'Hampelmänner' } },
  { id: 'leg_raise', pattern: 'core', tier: 2, type: TYPE_REPS, animation: 'leg_raise.json',
    equipment: ['none'], primary: ['core', 'hip_flexors'], secondary: [],
    unilateral: false,
    cues: ['Lower back stays on the floor', 'Lower the legs slowly'], status: 'reviewed',
    names: { en: 'Leg Raises', pt: 'Elevações de Pernas', es: 'Elevaciones de Piernas', fr: 'Levers de Jambes', de: 'Beinheben' } },
  { id: 'superman', pattern: 'core', tier: 1, type: TYPE_REPS, animation: 'superman.json',
    equipment: ['none'], primary: ['lower_back', 'glutes'], secondary: ['hamstrings'],
    unilateral: false,
    cues: ['Lift chest and thighs together', 'Squeeze the glutes'], status: 'reviewed',
    names: { en: 'Superman', pt: 'Superman', es: 'Superman', fr: 'Superman', de: 'Superman' } },
  { id: 'plank', pattern: 'core', tier: 1, type: TYPE_TIME, animation: 'plank.json',
    equipment: ['none'], primary: ['core'], secondary: ['shoulders', 'glutes'],
    unilateral: false, progression: 'side_plank',
    cues: ['Straight line head to heels', 'Brace the abs'], status: 'reviewed',
    names: { en: 'Plank', pt: 'Prancha', es: 'Plancha', fr: 'Planche', de: 'Unterarmstütz' } },
  { id: 'side_plank', pattern: 'core', tier: 2, type: TYPE_TIME, animation: 'plank.json',
    equipment: ['none'], primary: ['obliques', 'core'], secondary: ['shoulders'],
    unilateral: true, regression: 'plank', progression: 'hollow_body_hold',
    cues: ['Stack the hips', 'Push the floor away'], status: 'reviewed',
    names: { en: 'Side Plank', pt: 'Prancha Lateral', es: 'Plancha Lateral', fr: 'Planche Latérale', de: 'Seitlicher Unterarmstütz' } },
  { id: 'hollow_body_hold', pattern: 'core', tier: 3, type: TYPE_TIME, animation: 'plank.json',
    equipment: ['none'], primary: ['core'], secondary: ['hip_flexors'],
    unilateral: false, regression: 'side_plank',
    cues: ['Lower back pressed down', 'Arms and legs off the floor'], status: 'reviewed',
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

// Does this exercise need only equipment the user has available?
// `available` is a set/array of owned equipment tokens; undefined = bodyweight.
function equipmentSatisfied(e, available) {
  const need = (e.equipment || []).filter((x) => x !== 'none');
  if (need.length === 0) return true;
  const have = new Set(available || []);
  return need.every((x) => have.has(x));
}

// Exercises a class may use, optionally filtered by movement pattern(s), a list
// of excluded ids, and available equipment. Hard constraints: tier must never
// exceed the class, an excluded id is never returned, and required equipment
// must be available.
export function eligibleExercises({ level = 'Iniciante', patterns = null, exclude = [], equipment } = {}) {
  const maxTier = LEVEL_TIER[level] || 1;
  const excl = new Set(exclude);
  const allow = patterns ? new Set(patterns) : null;
  return EXERCISES.filter(
    (e) =>
      e.tier <= maxTier &&
      !excl.has(e.id) &&
      (!allow || allow.has(e.pattern)) &&
      equipmentSatisfied(e, equipment)
  );
}

// Query helper: exercises that train a given muscle (primary or secondary).
export function exercisesByMuscle(muscle, { primaryOnly = false } = {}) {
  return EXERCISES.filter(
    (e) => e.primary.includes(muscle) || (!primaryOnly && (e.secondary || []).includes(muscle))
  );
}

// Catalogue integrity check — returns a list of problem strings (empty = valid).
// Run by a unit test and usable as a dev-time guard; the app must be able to
// trust that every record is well-formed and every relationship resolves.
export function validateCatalogue(list = EXERCISES) {
  const problems = [];
  const ids = new Set();
  const langs = ['en', 'pt', 'es', 'fr', 'de'];
  const animSet = new Set(ANIMATION_FILES);
  const equipSet = new Set(EQUIPMENT);
  const muscleSet = new Set(MUSCLES);
  const idSet = new Set(list.map((e) => e.id));

  for (const e of list) {
    const at = `[${e.id || '??'}]`;
    if (!e.id) problems.push(`${at} missing id`);
    if (ids.has(e.id)) problems.push(`${at} duplicate id`);
    ids.add(e.id);
    if (!PATTERNS.includes(e.pattern)) problems.push(`${at} invalid pattern: ${e.pattern}`);
    if (!(e.tier >= 1 && e.tier <= 3)) problems.push(`${at} invalid tier: ${e.tier}`);
    if (e.type !== TYPE_REPS && e.type !== TYPE_TIME) problems.push(`${at} invalid type: ${e.type}`);
    if (!animSet.has(e.animation)) problems.push(`${at} unknown animation: ${e.animation}`);
    for (const eq of e.equipment || []) {
      if (!equipSet.has(eq)) problems.push(`${at} unknown equipment: ${eq}`);
    }
    if (!Array.isArray(e.primary) || e.primary.length === 0) problems.push(`${at} primary muscles missing`);
    for (const m of [...(e.primary || []), ...(e.secondary || [])]) {
      if (!muscleSet.has(m)) problems.push(`${at} unknown muscle: ${m}`);
    }
    for (const rel of ['regression', 'progression']) {
      if (e[rel] != null && !idSet.has(e[rel])) problems.push(`${at} ${rel} does not resolve: ${e[rel]}`);
      if (e[rel] === e.id) problems.push(`${at} ${rel} points at itself`);
    }
    for (const lang of langs) {
      if (!e.names || !e.names[lang]) problems.push(`${at} missing name: ${lang}`);
    }
  }
  return problems;
}
