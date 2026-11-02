// Deterministic plan generator + exercise catalogue — core domain tests.
// These run with NO network and NO AI, proving the offline core works.

import {
  buildWorkout,
  FOCUS_ROTATION,
  LOAD,
  scale,
} from '../src/domain/planGenerator';
import {
  EXERCISES,
  EXERCISE_IDS,
  ANIMATION_FILES,
  LEVEL_TIER,
  eligibleExercises,
} from '../src/domain/exercises';

const LEVELS = ['Iniciante', 'Intermédio', 'Avançado'];
const byId = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

// The 14 ids the AI prompt (geminiService.js) is allowed to use. The catalogue
// and the prompt MUST agree, or the two generation paths diverge.
const PROMPT_IDS = [
  'pushup_classic', 'pushup_diamond', 'pushup_wide', 'squat_classic', 'squat_jump',
  'lunge', 'burpee', 'mountain_climber', 'plank', 'side_plank', 'superman',
  'hollow_body_hold', 'leg_raise', 'jumping_jack',
];

describe('exercise catalogue integrity', () => {
  test('ids are unique', () => {
    expect(new Set(EXERCISE_IDS).size).toBe(EXERCISE_IDS.length);
  });

  test('catalogue matches the AI prompt allow-list', () => {
    expect([...EXERCISE_IDS].sort()).toEqual([...PROMPT_IDS].sort());
  });

  test('every animation file is one that ships in assets', () => {
    for (const e of EXERCISES) expect(ANIMATION_FILES).toContain(e.animation);
  });

  test('every exercise has a tier 1..3 and a valid type', () => {
    for (const e of EXERCISES) {
      expect(e.tier).toBeGreaterThanOrEqual(1);
      expect(e.tier).toBeLessThanOrEqual(3);
      expect(['reps', 'time']).toContain(e.type);
    }
  });

  test('eligibleExercises respects the class tier', () => {
    const beginner = eligibleExercises({ level: 'Iniciante' });
    expect(beginner.length).toBeGreaterThanOrEqual(5);
    for (const e of beginner) expect(e.tier).toBeLessThanOrEqual(LEVEL_TIER.Iniciante);
    expect(eligibleExercises({ level: 'Avançado' }).length).toBe(EXERCISES.length);
  });
});

describe('buildWorkout — validity for every class and focus', () => {
  for (const level of LEVELS) {
    for (let day = 1; day <= 6; day++) {
      test(`${level} day ${day} is a valid session`, () => {
        const w = buildWorkout({ level }, day, 1, 'en');
        expect(w).not.toBeNull();
        expect(w.workout_type).toBe(FOCUS_ROTATION[(day - 1) % 6].type);
        expect(w.exercises.length).toBeGreaterThanOrEqual(5);
        expect(w.exercises.length).toBeLessThanOrEqual(7);

        const ids = w.exercises.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length); // no duplicate exercises

        for (const ex of w.exercises) {
          expect(EXERCISE_IDS).toContain(ex.id);
          const cat = byId[ex.id];
          expect(ex.type).toBe(cat.type); // type matches the catalogue
          expect(ex.animation_file).toBe(cat.animation);
          expect(ANIMATION_FILES).toContain(ex.animation_file);
          expect(cat.tier).toBeLessThanOrEqual(LEVEL_TIER[level]); // never above class
          expect(ex.quantity).toBeGreaterThan(0);
          expect(ex.rest_seconds).toBeGreaterThanOrEqual(8);
          expect(typeof ex.display_name).toBe('string');
          expect(ex.display_name.length).toBeGreaterThan(0);
        }
      });
    }
  }

  test('unknown class falls back to Iniciante and still produces a valid plan', () => {
    const w = buildWorkout({ level: 'Nonsense' }, 1, 1, 'en');
    expect(w).not.toBeNull();
    for (const ex of w.exercises) {
      expect(byId[ex.id].tier).toBeLessThanOrEqual(LEVEL_TIER.Iniciante);
    }
  });
});

describe('determinism and variety', () => {
  test('same inputs produce an identical workout', () => {
    const a = buildWorkout({ level: 'Intermédio' }, 3, 2, 'pt');
    const b = buildWorkout({ level: 'Intermédio' }, 3, 2, 'pt');
    expect(a).toEqual(b);
  });

  test('different days vary the selection', () => {
    const d1 = buildWorkout({ level: 'Avançado' }, 1, 1, 'en').exercises.map((e) => e.id);
    const d2 = buildWorkout({ level: 'Avançado' }, 2, 1, 'en').exercises.map((e) => e.id);
    expect(d1).not.toEqual(d2);
  });

  test('language only changes display names, not structure', () => {
    const en = buildWorkout({ level: 'Iniciante' }, 1, 1, 'en');
    const pt = buildWorkout({ level: 'Iniciante' }, 1, 1, 'pt');
    expect(en.exercises.map((e) => e.id)).toEqual(pt.exercises.map((e) => e.id));
    expect(en.exercises.map((e) => e.quantity)).toEqual(pt.exercises.map((e) => e.quantity));
  });
});

describe('hard constraints', () => {
  test('excluded exercises never appear', () => {
    const exclude = ['burpee', 'pushup_diamond', 'squat_jump'];
    for (let day = 1; day <= 6; day++) {
      const w = buildWorkout({ level: 'Avançado', exclude }, day, 1, 'en');
      for (const ex of w.exercises) expect(exclude).not.toContain(ex.id);
    }
  });
});

describe('season scaling is bounded and monotonic', () => {
  test('scale() never decreases and respects the cap', () => {
    expect(scale(10, 1, 50)).toBe(10);
    expect(scale(10, 2, 50)).toBeGreaterThanOrEqual(scale(10, 1, 50));
    expect(scale(10, 3, 50)).toBeGreaterThanOrEqual(scale(10, 2, 50));
    expect(scale(100, 5, 50)).toBe(50); // capped
  });

  test('later seasons never drop rest below the floor', () => {
    const w = buildWorkout({ level: 'Avançado' }, 1, 10, 'en');
    for (const ex of w.exercises) expect(ex.rest_seconds).toBeGreaterThanOrEqual(8);
  });
});
