// Progression & Feedback Engine (Phase 4). Per-exercise, earned from the
// subjective difficulty signal, bounded, explainable, never time-based.

import {
  applyOutcome,
  decide,
  normalizeOutcome,
  prescriptionFor,
  STEP,
  BOUNDS,
  WINDOW,
} from '../src/domain/progression';

const easy = { difficulty: 'easy' };
const ok = { difficulty: 'ok' };
const hard = { difficulty: 'hard' };

// Fold a sequence of outcomes for one exercise and return its final entry.
function fold(type, outcomes, start = {}) {
  let state = start;
  for (const o of outcomes) state = applyOutcome(state, 'pushup_classic', type, o);
  return state.pushup_classic;
}

test('two easy in a row progress by one bounded step, then reset the window', () => {
  const entry = fold('reps', [easy, easy]);
  expect(entry.offset).toBe(STEP.reps);
  expect(entry.signals).toEqual([]); // re-earned each step
  expect(entry.lastRule).toMatch(/easy/);
});

test('a single easy then ok holds (no change)', () => {
  const entry = fold('reps', [easy, ok]);
  expect(entry.offset).toBe(0);
});

test('two hard in a row regress by one step', () => {
  const entry = fold('reps', [hard, hard]);
  expect(entry.offset).toBe(-STEP.reps);
});

test('a skipped exercise counts as a struggle (hard)', () => {
  expect(normalizeOutcome({ completed: false })).toBe('hard');
  const entry = fold('reps', [{ completed: false }, { completed: false }]);
  expect(entry.offset).toBe(-STEP.reps);
});

test('completed with no difficulty signal is neutral and changes nothing', () => {
  expect(normalizeOutcome({ completed: true })).toBeNull();
  const entry = fold('reps', [{ completed: true }, { completed: true }]);
  expect(entry.offset).toBe(0);
  expect(entry.signals).toEqual([]);
});

test('progression never increases merely from elapsed exposures (ok forever = flat)', () => {
  const entry = fold('reps', Array.from({ length: 10 }, () => ok));
  expect(entry.offset).toBe(0);
});

test('prescription is the base plus earned offset, clamped to bounds', () => {
  expect(prescriptionFor(12, 'reps', { offset: 4 })).toBe(16);
  expect(prescriptionFor(12, 'reps', { offset: 100 })).toBe(BOUNDS.reps[1]); // capped
  expect(prescriptionFor(12, 'reps', { offset: -100 })).toBe(BOUNDS.reps[0]); // floored
  expect(prescriptionFor(30, 'time', { offset: 10 })).toBe(40);
});

test('time exercises progress in time steps', () => {
  const entry = fold('time', [easy, easy]);
  expect(entry.offset).toBe(STEP.time);
});

test('exercises progress independently (per-exercise, not global)', () => {
  let state = {};
  state = applyOutcome(state, 'pushup_classic', 'reps', easy);
  state = applyOutcome(state, 'pushup_classic', 'reps', easy); // progresses
  state = applyOutcome(state, 'squat_classic', 'reps', hard); // unrelated, one signal
  expect(state.pushup_classic.offset).toBe(STEP.reps);
  expect(state.squat_classic.offset).toBe(0); // only one hard -> holds
});

test('decide needs a clean tail streak; mixed window holds', () => {
  expect(decide(['easy', 'hard', 'easy']).decision).toBe('hold');
  expect(decide(['easy', 'easy']).decision).toBe('progress');
  expect(decide(['hard', 'hard']).decision).toBe('regress');
  expect(decide([]).decision).toBe('hold');
});

test('the signal window is bounded', () => {
  const entry = fold('reps', [ok, ok, ok, ok, ok]);
  expect(entry.signals.length).toBeLessThanOrEqual(WINDOW);
});

test('objective-metric hook works without any code change to the engine (Stage 2 forward-compat)', () => {
  // achieved well above prescribed reads as "easy"; below reads as "hard".
  expect(normalizeOutcome({ achieved: 15, prescribed: 10 })).toBe('easy');
  expect(normalizeOutcome({ achieved: 7, prescribed: 10 })).toBe('hard');
  expect(normalizeOutcome({ achieved: 10, prescribed: 10 })).toBe('ok');
  const entry = fold('reps', [{ achieved: 15, prescribed: 10 }, { achieved: 16, prescribed: 10 }]);
  expect(entry.offset).toBe(STEP.reps); // same decision path as the subjective tap
});

describe('offset bounds and ceiling/floor (Phase 4b)', () => {
  const { OFFSET, atCeiling, atFloor } = require('../src/domain/progression');

  test('offset is clamped — it never drifts past OFFSET bounds', () => {
    let state = {};
    // many "easy" exposures: progresses, but offset saturates at the ceiling
    for (let i = 0; i < 40; i++) state = applyOutcome(state, 'x', 'reps', { difficulty: 'easy' });
    expect(state.x.offset).toBeLessThanOrEqual(OFFSET.reps[1]);
    expect(atCeiling('reps', state.x)).toBe(true);
  });

  test('many "hard" exposures saturate at the floor', () => {
    let state = {};
    for (let i = 0; i < 40; i++) state = applyOutcome(state, 'x', 'reps', { difficulty: 'hard' });
    expect(state.x.offset).toBeGreaterThanOrEqual(OFFSET.reps[0]);
    expect(atFloor('reps', state.x)).toBe(true);
  });

  test('a fresh exercise is neither at the ceiling nor the floor', () => {
    expect(atCeiling('reps', undefined)).toBe(false);
    expect(atFloor('reps', undefined)).toBe(false);
  });
});
