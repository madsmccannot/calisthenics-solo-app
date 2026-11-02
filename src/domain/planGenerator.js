// Deterministic training-plan generator (pure, offline).
//
// Builds a single valid workout from the user's class, the day's focus, and the
// Exercise Knowledge Base — with NO network and NO AI. The app uses this as the
// fallback whenever the Gemini call is unavailable or fails, so onboarding, plan
// generation and workout execution never depend on an external AI service.
//
// Deterministic by design: the same (level, dayNumber, season) always produces
// the same workout (seeded PRNG), while different days vary.

import { eligibleExercises, exerciseName, getExercise, TYPE_REPS } from './exercises';

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

// Bounds so season scaling can never produce an absurd prescription.
const MAX_REPS = 50;
const MAX_HOLD = 120;
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

// Season difficulty scaling: +15% per season past the first, bounded.
function scale(base, season, cap) {
  const factor = 1 + Math.max(0, season - 1) * 0.15;
  return Math.min(cap, Math.round(base * factor));
}

// Builds one workout. Returns { workout_type, exercises[], source } matching the
// shape the AI path returns (planService adds day_number/date/completed), or
// null if the catalogue cannot satisfy even a minimal session.
export function buildWorkout(profile = {}, dayNumber = 1, season = 1, lang = 'en') {
  const level = LOAD[profile.level] ? profile.level : 'Iniciante';
  const exclude = Array.isArray(profile.exclude) ? profile.exclude : [];
  const focus = FOCUS_ROTATION[(dayNumber - 1 + FOCUS_ROTATION.length) % FOCUS_ROTATION.length];
  const rng = mulberry32(seedFrom(level, season, dayNumber));

  // Primary pool: exercises matching the day's focus and the class.
  const primary = shuffle(rng, eligibleExercises({ level, patterns: focus.patterns, exclude }));
  // Top-up pool: any class-eligible exercise, to reach a full 5–7 session when
  // the focus alone is too narrow (e.g. a beginner core day). Never fabricates.
  const topUp = shuffle(rng, eligibleExercises({ level, exclude }));

  const target = pickInt(rng, 5, 7);
  const chosen = [];
  const seen = new Set();
  for (const e of [...primary, ...topUp]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    chosen.push(e);
    if (chosen.length >= target) break;
  }
  if (chosen.length === 0) return null; // catalogue cannot satisfy the request

  // Order: dynamic/rep work first, isometric holds last (a sensible session arc).
  chosen.sort((a, b) => (a.type === b.type ? 0 : a.type === TYPE_REPS ? -1 : 1));

  const load = LOAD[level];
  const exercises = chosen.map((e) => {
    const isReps = e.type === TYPE_REPS;
    const base = isReps ? pickInt(rng, load.reps[0], load.reps[1]) : pickInt(rng, load.hold[0], load.hold[1]);
    const quantity = scale(base, season, isReps ? MAX_REPS : MAX_HOLD);
    const rest = Math.max(MIN_REST, pickInt(rng, load.rest[0], load.rest[1]) - Math.max(0, season - 1) * 2);
    return {
      id: e.id,
      display_name: exerciseName(e.id, lang),
      type: e.type,
      quantity,
      rest_seconds: rest,
      animation_file: e.animation,
    };
  });

  return { workout_type: focus.type, exercises, source: 'local' };
}

// Exposed for tests / debugging.
export { FOCUS_ROTATION, LOAD, getExercise, scale };
