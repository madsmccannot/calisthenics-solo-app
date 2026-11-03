// Plan & workout schema + validator (Phase 3).
//
// A generated workout — whether from the deterministic engine or the AI path —
// must never reach storage or the UI malformed. These validators are the gate:
// the engine's tests assert its output passes, and planService logs any plan
// that fails before saving. Pure, no network.

import {
  EXERCISE_IDS,
  ANIMATION_FILES,
  getExercise,
  TYPE_REPS,
  TYPE_TIME,
} from './exercises';

// Bump when the stored shape changes in a way old data must be migrated for.
export const SCHEMA_VERSION = 1;

// Sanity bounds a stored prescription may ever contain (NOT the programming
// policy — just the outer envelope the season scaling or progression must stay
// inside). Kept generous so both paths validate.
export const REPS_RANGE = [1, 60];
export const TIME_RANGE = [5, 180];
export const REST_MIN = 8;

// Day kinds that carry no exercises.
export const REST_TYPES = ['Recovery', 'Rest'];

const idSet = new Set(EXERCISE_IDS);
const animSet = new Set(ANIMATION_FILES);

// Validate one workout. Returns a list of problem strings (empty = valid).
export function validateWorkout(w) {
  if (!w || typeof w !== 'object') return ['workout is not an object'];
  const problems = [];
  if (typeof w.workout_type !== 'string' || !w.workout_type) problems.push('missing workout_type');
  if (!Array.isArray(w.exercises)) return [...problems, 'exercises is not an array'];
  if (w.exercises.length === 0) problems.push('workout has no exercises');

  w.exercises.forEach((ex, i) => {
    const at = `exercise[${i}]`;
    if (!ex || !idSet.has(ex.id)) { problems.push(`${at} unknown id: ${ex && ex.id}`); return; }
    const cat = getExercise(ex.id);
    if (ex.type !== cat.type) problems.push(`${at} type "${ex.type}" != catalogue "${cat.type}"`);
    if (ex.animation_file !== cat.animation || !animSet.has(ex.animation_file)) {
      problems.push(`${at} animation does not resolve: ${ex.animation_file}`);
    }
    const [lo, hi] = ex.type === TYPE_TIME ? TIME_RANGE : REPS_RANGE;
    if (!Number.isInteger(ex.quantity) || ex.quantity < lo || ex.quantity > hi) {
      problems.push(`${at} quantity out of range: ${ex.quantity}`);
    }
    if (!Number.isInteger(ex.rest_seconds) || ex.rest_seconds < REST_MIN) {
      problems.push(`${at} rest below floor: ${ex.rest_seconds}`);
    }
    if (typeof ex.display_name !== 'string' || !ex.display_name) problems.push(`${at} missing display_name`);
  });

  const ids = w.exercises.map((e) => e && e.id);
  if (new Set(ids).size !== ids.length) problems.push('duplicate exercises in one workout');
  return problems;
}

// Validate a whole plan (array of day objects). Rest/Recovery days must be
// empty; workout days must each be a valid workout.
export function validatePlan(plan) {
  if (!Array.isArray(plan)) return ['plan is not an array'];
  const problems = [];
  plan.forEach((d, i) => {
    const at = `day[${i}]`;
    if (!Number.isInteger(d.day_number)) problems.push(`${at} missing day_number`);
    if (!d.date) problems.push(`${at} missing date`);
    if (REST_TYPES.includes(d.workout_type)) {
      if (Array.isArray(d.exercises) && d.exercises.length) problems.push(`${at} ${d.workout_type} day carries exercises`);
    } else {
      for (const p of validateWorkout(d)) problems.push(`${at} ${p}`);
    }
  });
  const nums = plan.map((d) => d.day_number);
  if (new Set(nums).size !== nums.length) problems.push('duplicate day_number');
  return problems;
}
