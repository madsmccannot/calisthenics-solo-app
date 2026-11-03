// Deterministic Training Programming Engine (Phase 3). Pure, offline, no AI.
//
// Layered by responsibility (TECHNICAL_ROADMAP Phase 3):
//   normalizeProfile  — validate explicit inputs into constraints (+ defaults)
//   buildSchedule     — weekly scheduling: which days train, which recover
//   selectExercises   — exercise SELECTION under hard constraints (no numbers)
//   prescribe         — PRESCRIPTION calculation (reps/holds/rest) for one pick
//   buildWorkout      — orchestrates the above into one validated session
//
// Hard constraints (never silently violated): class tier ceiling, excluded
// exercises, required equipment. Soft preferences: the day's focus patterns and
// session length — relaxed (topped up from the wider pool) only to reach a
// usable session, never by breaking a hard constraint or inventing an exercise.
//
// Deterministic: the same (level, season, dayNumber) seeds the same PRNG, so the
// same inputs always yield the same workout; different days vary.

import { eligibleExercises, exerciseName, getExercise, LEVEL_TIER, TYPE_REPS } from './exercises';
import { SCHEMA_VERSION, validateWorkout } from './planSchema';
import { prescriptionFor, atCeiling, atFloor } from './progression';

// 6-day focus rotation. The `type` values MUST stay in sync with DAILY_FOCUS in
// geminiService.js so the AI path and this fallback label each day the same way.
const FOCUS_ROTATION = [
  { type: 'Full Body', patterns: ['push', 'legs', 'core'] },
  { type: 'Strength', patterns: ['push', 'core'] },          // upper body
  { type: 'Strength', patterns: ['legs'] },                  // legs & glutes
  { type: 'Core', patterns: ['core'] },
  { type: 'HIIT', patterns: ['cardio', 'legs'] },
  { type: 'Full Body', patterns: ['push', 'legs', 'core', 'cardio'] },
];

// Prescription ranges per class — mirror LEVEL_GUIDANCE in geminiService.js.
const LOAD = {
  Iniciante: { reps: [8, 14], rest: [35, 45], hold: [20, 30] },
  'Intermédio': { reps: [15, 22], rest: [20, 30], hold: [30, 45] },
  'Avançado': { reps: [22, 35], rest: [10, 20], hold: [45, 70] },
};

// Defaults for optional inputs the onboarding may not collect yet.
const DEFAULTS = { daysPerWeek: 6, countMin: 5, countMax: 7 };

// Option lists the personalization UI offers (the engine validates anything,
// but these keep the pickers and the engine in agreement). `sessionMinutes:
// null` means "no preference" -> the varied 5-7 default.
export const PROFILE_OPTIONS = {
  daysPerWeek: [3, 4, 5, 6],
  sessionMinutes: [null, 15, 20, 30, 45],
};

// Rest floor (seconds). Prescription magnitude (reps/holds) is bounded by the
// progression engine's prescriptionFor, not here.
const MIN_REST = 8;

// --- deterministic PRNG -----------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a hash of the normalized inputs -> a stable 32-bit seed.
function seedFrom(level, season, dayNumber) {
  const s = `${level}|${season}|${dayNumber}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// integer in [min, max] inclusive, drawn from rng
function pickInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Fisher–Yates shuffle driven by rng (does not mutate the input).
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- 1. input normalization -------------------------------------------------
// Turns a raw profile into validated constraints. Unknown/invalid values fall
// back to safe defaults; nothing is fabricated.
export function normalizeProfile(profile = {}) {
  const level = LOAD[profile.level] ? profile.level : 'Iniciante';
  const exclude = Array.isArray(profile.exclude) ? profile.exclude : [];
  const equipment = Array.isArray(profile.equipment) ? profile.equipment : [];

  let daysPerWeek = Math.round(Number(profile.daysPerWeek));
  if (!Number.isFinite(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) {
    daysPerWeek = DEFAULTS.daysPerWeek;
  }

  // Optional session length -> a fixed exercise count. Absent = a random 5..7
  // window (unchanged default behavior). ~1 exercise per 4 minutes, clamped.
  let fixedCount = null;
  const minutes = Number(profile.sessionMinutes);
  if (Number.isFinite(minutes) && minutes > 0) {
    fixedCount = Math.max(4, Math.min(9, Math.round(minutes / 4)));
  }

  // Goal is accepted and carried but has no programming effect yet (would need
  // an agreed goal->structure mapping; not invented here).
  const goal = typeof profile.goal === 'string' ? profile.goal : null;

  return { level, exclude, equipment, daysPerWeek, fixedCount, goal };
}

// --- 2. weekly scheduling ---------------------------------------------------
// Decides, for `totalDays`, which are workout days (with a focus) and which are
// recovery — independent of what any session contains. Default 6 train / 1 rest
// per 7-day week puts recovery on days 7, 14, 21, 28 (the app's existing rhythm).
export function buildSchedule(profile = {}, totalDays = 30) {
  const { daysPerWeek } = normalizeProfile(profile);
  const out = [];
  for (let i = 1; i <= totalDays; i++) {
    const posInWeek = (i - 1) % 7;
    if (posInWeek < daysPerWeek) {
      out.push({ day_number: i, kind: 'workout', focus: focusForDay(i) });
    } else {
      out.push({ day_number: i, kind: 'recovery', focus: null });
    }
  }
  return out;
}

function focusForDay(dayNumber) {
  return FOCUS_ROTATION[(dayNumber - 1 + FOCUS_ROTATION.length) % FOCUS_ROTATION.length];
}

// --- 3. exercise selection (no prescription numbers) ------------------------
// Picks exercises for a session under hard constraints. Returns entries tagged
// with whether they came from the day's focus (primary) or the top-up pool, so
// the caller can explain each choice. Never fabricates an exercise.
export function selectExercises(norm, focus, rng) {
  const primary = shuffle(rng, eligibleExercises({
    level: norm.level, patterns: focus.patterns, exclude: norm.exclude, equipment: norm.equipment,
  }));
  const topUp = shuffle(rng, eligibleExercises({
    level: norm.level, exclude: norm.exclude, equipment: norm.equipment,
  }));

  const target = norm.fixedCount != null
    ? norm.fixedCount
    : pickInt(rng, DEFAULTS.countMin, DEFAULTS.countMax);

  const primaryIds = new Set(primary.map((e) => e.id));
  const chosen = [];
  const seen = new Set();
  for (const e of [...primary, ...topUp]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    chosen.push({ exercise: e, fromPrimary: primaryIds.has(e.id) });
    if (chosen.length >= target) break;
  }
  return chosen;
}

// --- 4. prescription --------------------------------------------------------
// Turns a selected exercise into concrete numbers for the class, adjusted by the
// exercise's EARNED progression (Phase 4) — not by the season counter. A fresh
// profile (no progression yet) gets the class base; difficulty rises per
// exercise only as the person earns it. `entry` is this exercise's progression
// state ({ offset }), or undefined for none.
export function prescribe(exercise, load, rng, entry) {
  const isReps = exercise.type === TYPE_REPS;
  const base = isReps
    ? pickInt(rng, load.reps[0], load.reps[1])
    : pickInt(rng, load.hold[0], load.hold[1]);
  const quantity = prescriptionFor(base, exercise.type, entry);
  const rest = Math.max(MIN_REST, pickInt(rng, load.rest[0], load.rest[1]));
  return { quantity, rest_seconds: rest };
}

// --- 4b. variant swap -------------------------------------------------------
// Progression within an exercise vs. progression to a different exercise: once
// an exercise has earned all its offset allows (atCeiling), move to its harder
// catalogue variant; once it has been eased to the floor (atFloor), drop to its
// easier variant. Hard constraints still apply — the variant must be within the
// class tier, not excluded, and not already in the session. If none qualifies,
// the original exercise stays (with its offset).
export function resolveVariant(exercise, entry, { level = 'Iniciante', exclude = [], used } = {}) {
  const maxTier = LEVEL_TIER[level] || 1;
  const excl = new Set(exclude);
  const taken = used || new Set();
  const candidate = (id) => {
    if (!id) return null;
    const v = getExercise(id);
    if (!v || v.tier > maxTier || excl.has(id) || taken.has(id)) return null;
    return v;
  };
  if (atCeiling(exercise.type, entry)) {
    const up = candidate(exercise.progression);
    if (up) return up;
  }
  if (atFloor(exercise.type, entry)) {
    const down = candidate(exercise.regression);
    if (down) return down;
  }
  return exercise;
}

// --- 5. orchestration -------------------------------------------------------
// Builds one workout. Returns a validated session object matching the shape the
// AI path returns (planService adds day_number/date/completed), or null if the
// catalogue cannot satisfy even a minimal session (see diagnoseWorkout for why).
// `focusOverride` lets buildSchedule supply the focus; otherwise it's derived
// from dayNumber. `progression` is the per-exercise earned-progression map
// ({ [id]: { offset } }), applied to each prescription. The season still seeds
// the PRNG (so a new block brings fresh variety) but no longer scales difficulty.
export function buildWorkout(profile = {}, dayNumber = 1, season = 1, lang = 'en', focusOverride = null, progression = {}) {
  const norm = normalizeProfile(profile);
  const focus = focusOverride || focusForDay(dayNumber);
  const rng = mulberry32(seedFrom(norm.level, season, dayNumber));

  const selected = selectExercises(norm, focus, rng);
  if (selected.length === 0) return null; // catalogue cannot satisfy the request

  // Order: dynamic/rep work first, isometric holds last (a sensible session arc).
  selected.sort((a, b) =>
    a.exercise.type === b.exercise.type ? 0 : a.exercise.type === TYPE_REPS ? -1 : 1
  );

  const load = LOAD[norm.level];
  // Reserve the selected ids so a variant swap can't duplicate another pick.
  const used = new Set(selected.map((s) => s.exercise.id));
  const exercises = selected.map(({ exercise: e0, fromPrimary }) => {
    const e = resolveVariant(e0, progression[e0.id], { level: norm.level, exclude: norm.exclude, used });
    const swapped = e.id !== e0.id;
    if (swapped) used.add(e.id);
    const { quantity, rest_seconds } = prescribe(e, load, rng, progression[e.id]);
    return {
      id: e.id,
      display_name: exerciseName(e.id, lang),
      type: e.type,
      quantity,
      rest_seconds,
      animation_file: e.animation,
      reason: swapped
        ? `variant of ${e0.id} (earned ${e.tier > e0.tier ? 'progression' : 'regression'})`
        : fromPrimary ? `focus:${e.pattern}` : 'added for session length',
    };
  });

  const workout = {
    schema_version: SCHEMA_VERSION,
    workout_type: focus.type,
    exercises,
    source: 'local',
    reason: `Focus ${focus.type} (${focus.patterns.join('/')}) for class ${norm.level}`,
  };

  // The engine must never emit a malformed session.
  const problems = validateWorkout(workout);
  if (problems.length) {
    if (typeof console !== 'undefined') console.warn('[planGenerator] invalid workout:', problems.slice(0, 5));
    return null;
  }
  return workout;
}

// Explains whether a workout can be built at all for this profile (for callers
// to surface a reason instead of a silent empty day).
export function diagnoseWorkout(profile = {}) {
  const norm = normalizeProfile(profile);
  const pool = eligibleExercises({ level: norm.level, exclude: norm.exclude, equipment: norm.equipment });
  if (pool.length === 0) {
    return { ok: false, reason: 'No eligible exercises: everything is excluded or needs unavailable equipment.' };
  }
  return { ok: true, reason: null };
}

// Exposed for tests / debugging.
export { FOCUS_ROTATION, LOAD, getExercise };
