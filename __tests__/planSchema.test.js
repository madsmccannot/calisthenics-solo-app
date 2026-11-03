// Plan/workout schema validator (Phase 3). The gate that keeps a malformed
// workout out of storage and the UI.

import { validateWorkout, validatePlan, SCHEMA_VERSION } from '../src/domain/planSchema';
import { buildWorkout, buildSchedule } from '../src/domain/planGenerator';

const goodExercise = {
  id: 'pushup_classic', display_name: 'Push-ups', type: 'reps',
  quantity: 12, rest_seconds: 40, animation_file: 'pushup.json',
};
const goodWorkout = { schema_version: SCHEMA_VERSION, workout_type: 'Strength', exercises: [goodExercise] };

test('a well-formed workout validates clean', () => {
  expect(validateWorkout(goodWorkout)).toEqual([]);
});

test('unknown exercise id is rejected', () => {
  const w = { ...goodWorkout, exercises: [{ ...goodExercise, id: 'not_real' }] };
  expect(validateWorkout(w).join(' ')).toMatch(/unknown id/);
});

test('type mismatch with the catalogue is rejected', () => {
  const w = { ...goodWorkout, exercises: [{ ...goodExercise, type: 'time' }] };
  expect(validateWorkout(w).join(' ')).toMatch(/type/);
});

test('an animation that does not resolve is rejected', () => {
  const w = { ...goodWorkout, exercises: [{ ...goodExercise, animation_file: 'ghost.json' }] };
  expect(validateWorkout(w).join(' ')).toMatch(/animation/);
});

test('out-of-range quantity and sub-floor rest are rejected', () => {
  const w1 = { ...goodWorkout, exercises: [{ ...goodExercise, quantity: 999 }] };
  expect(validateWorkout(w1).join(' ')).toMatch(/quantity/);
  const w2 = { ...goodWorkout, exercises: [{ ...goodExercise, rest_seconds: 1 }] };
  expect(validateWorkout(w2).join(' ')).toMatch(/rest/);
});

test('duplicate exercises in one workout are rejected', () => {
  const w = { ...goodWorkout, exercises: [goodExercise, goodExercise] };
  expect(validateWorkout(w).join(' ')).toMatch(/duplicate/);
});

test('an empty workout is rejected', () => {
  expect(validateWorkout({ ...goodWorkout, exercises: [] }).join(' ')).toMatch(/no exercises/);
});

test('a full generated plan validates, with empty recovery days allowed', () => {
  const schedule = buildSchedule({}, 30);
  const plan = schedule.map((slot) => {
    const date = new Date().toISOString();
    if (slot.kind === 'recovery') {
      return { day_number: slot.day_number, date, workout_type: 'Recovery', exercises: [], completed: false };
    }
    const w = buildWorkout({ level: 'Iniciante' }, slot.day_number, 1, 'en', slot.focus);
    return { ...w, day_number: slot.day_number, date, completed: false };
  });
  expect(validatePlan(plan)).toEqual([]);
});

test('a recovery day carrying exercises is rejected', () => {
  const bad = [{ day_number: 1, date: new Date().toISOString(), workout_type: 'Recovery', exercises: [goodExercise] }];
  expect(validatePlan(bad).join(' ')).toMatch(/carries exercises/);
});
