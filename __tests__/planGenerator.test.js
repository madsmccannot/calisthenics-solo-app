// Deterministic plan generator + exercise catalogue — core domain tests.
// These run with NO network and NO AI, proving the offline core works.

import {
  buildWorkout,
  buildSchedule,
  selectExercises,
  prescribe,
  normalizeProfile,
  diagnoseWorkout,
  FOCUS_ROTATION,
  LOAD,
} from '../src/domain/planGenerator';
import { validateWorkout, SCHEMA_VERSION } from '../src/domain/planSchema';
import { BOUNDS } from '../src/domain/progression';
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

  test('AI prompt allow-list is a subset of the catalogue', () => {
    // The catalogue may hold local-only exercises the AI prompt does not list
    // (the prompt sync is an API-path concern). Every prompt id must still exist.
    for (const id of PROMPT_IDS) expect(EXERCISE_IDS).toContain(id);
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

describe('season no longer inflates difficulty (Phase 4)', () => {
  test('a late season does not push quantities above the progression bounds', () => {
    const w = buildWorkout({ level: 'Avançado' }, 1, 10, 'en');
    for (const ex of w.exercises) {
      const [lo, hi] = ex.type === 'time' ? BOUNDS.time : BOUNDS.reps;
      expect(ex.quantity).toBeGreaterThanOrEqual(lo);
      expect(ex.quantity).toBeLessThanOrEqual(hi);
      expect(ex.rest_seconds).toBeGreaterThanOrEqual(8);
    }
  });

  test('with no progression, difficulty is the class base regardless of season', () => {
    // Same seed inputs -> identical selection; season only seeds variety, not load.
    const a = buildWorkout({ level: 'Iniciante' }, 1, 1, 'en');
    const b = buildWorkout({ level: 'Iniciante' }, 1, 1, 'en', null, {});
    expect(a.exercises.map((e) => e.quantity)).toEqual(b.exercises.map((e) => e.quantity));
  });
});

describe('progression is consumed per exercise (Phase 4, step 3)', () => {
  test('an earned offset raises only that exercise prescription', () => {
    const base = buildWorkout({ level: 'Avançado' }, 1, 1, 'en');
    const id = base.exercises[0].id;
    const boosted = buildWorkout({ level: 'Avançado' }, 1, 1, 'en', null, { [id]: { offset: 8 } });
    // selection is identical (progression does not affect selection), so the
    // same exercise sits at index 0 and only its quantity changes.
    expect(boosted.exercises[0].id).toBe(id);
    expect(boosted.exercises[0].quantity).toBeGreaterThan(base.exercises[0].quantity);
    expect(boosted.exercises[1].quantity).toBe(base.exercises[1].quantity); // untouched
  });
});

describe('Phase 3 — layered engine', () => {
  describe('normalizeProfile validates inputs with safe defaults', () => {
    test('defaults when inputs are absent/invalid', () => {
      const n = normalizeProfile({});
      expect(n.level).toBe('Iniciante');
      expect(n.daysPerWeek).toBe(6);
      expect(n.fixedCount).toBeNull();
      expect(n.exclude).toEqual([]);
      expect(n.equipment).toEqual([]);
    });
    test('out-of-range daysPerWeek falls back to the default', () => {
      expect(normalizeProfile({ daysPerWeek: 0 }).daysPerWeek).toBe(6);
      expect(normalizeProfile({ daysPerWeek: 9 }).daysPerWeek).toBe(6);
      expect(normalizeProfile({ daysPerWeek: 3 }).daysPerWeek).toBe(3);
    });
    test('sessionMinutes maps to a bounded fixed exercise count', () => {
      expect(normalizeProfile({ sessionMinutes: 20 }).fixedCount).toBe(5);
      expect(normalizeProfile({ sessionMinutes: 2 }).fixedCount).toBe(4);   // floor
      expect(normalizeProfile({ sessionMinutes: 999 }).fixedCount).toBe(9); // ceil
    });
  });

  describe('buildSchedule separates weekly scheduling from sessions', () => {
    test('default 6/week puts recovery on days 7, 14, 21, 28', () => {
      const s = buildSchedule({}, 30);
      expect(s.length).toBe(30);
      const recovery = s.filter((d) => d.kind === 'recovery').map((d) => d.day_number);
      expect(recovery).toEqual([7, 14, 21, 28]);
      for (const slot of s.filter((d) => d.kind === 'workout')) {
        expect(slot.focus).not.toBeNull();
      }
    });
    test('daysPerWeek changes the training frequency', () => {
      const s = buildSchedule({ daysPerWeek: 4 }, 14);
      const workouts = s.filter((d) => d.kind === 'workout').length;
      expect(workouts).toBe(8); // 4 per 7-day week x 2 weeks
    });
    test('scheduled focus matches what buildWorkout derives from the day', () => {
      const s = buildSchedule({}, 6);
      for (const slot of s) {
        expect(slot.focus.type).toBe(FOCUS_ROTATION[(slot.day_number - 1) % 6].type);
      }
    });
  });

  describe('selection is separate from prescription', () => {
    test('selectExercises returns only eligible, non-excluded, unique picks', () => {
      const norm = normalizeProfile({ level: 'Avançado', exclude: ['burpee'] });
      // a deterministic rng stub
      let seed = 1;
      const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const picks = selectExercises(norm, FOCUS_ROTATION[0], rng);
      const ids = picks.map((p) => p.exercise.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain('burpee');
      for (const p of picks) expect(p.exercise.tier).toBeLessThanOrEqual(LEVEL_TIER['Avançado']);
    });
    test('prescribe produces bounded numbers and applies the earned offset', () => {
      const rng = () => 0.5;
      const flat = prescribe({ type: 'reps' }, LOAD.Iniciante, rng, { offset: 0 });
      expect(flat.quantity).toBeGreaterThan(0);
      expect(flat.rest_seconds).toBeGreaterThanOrEqual(8);
      const boosted = prescribe({ type: 'reps' }, LOAD.Iniciante, rng, { offset: 5 });
      expect(boosted.quantity).toBe(flat.quantity + 5);
      const hold = prescribe({ type: 'time' }, LOAD.Iniciante, rng, undefined);
      expect(hold.quantity).toBeGreaterThan(0);
    });
  });

  describe('output is schema-valid and explainable', () => {
    for (const level of ['Iniciante', 'Intermédio', 'Avançado']) {
      for (let day = 1; day <= 6; day++) {
        test(`${level} day ${day} passes validateWorkout and carries reasons`, () => {
          const w = buildWorkout({ level }, day, 1, 'en');
          expect(validateWorkout(w)).toEqual([]);
          expect(w.schema_version).toBe(SCHEMA_VERSION);
          expect(typeof w.reason).toBe('string');
          for (const ex of w.exercises) expect(typeof ex.reason).toBe('string');
        });
      }
    }
  });

  describe('explicit, explained failure instead of a malformed plan', () => {
    test('excluding every exercise yields null + a diagnosable reason', () => {
      const profile = { level: 'Avançado', exclude: EXERCISE_IDS };
      expect(buildWorkout(profile, 1, 1, 'en')).toBeNull();
      const diag = diagnoseWorkout(profile);
      expect(diag.ok).toBe(false);
      expect(typeof diag.reason).toBe('string');
    });
    test('a normal profile diagnoses ok', () => {
      expect(diagnoseWorkout({ level: 'Iniciante' }).ok).toBe(true);
    });
  });
});

describe('variant swap (Phase 4b)', () => {
  const { resolveVariant } = require('../src/domain/planGenerator');
  const { OFFSET } = require('../src/domain/progression');
  const { getExercise } = require('../src/domain/exercises');

  const ceil = { offset: OFFSET.reps[1] };
  const floor = { offset: OFFSET.reps[0] };

  test('at the ceiling, an advanced user moves to the harder variant', () => {
    const e = resolveVariant(getExercise('pushup_classic'), ceil, { level: 'Avançado', used: new Set() });
    expect(e.id).toBe('pushup_wide'); // pushup_classic.progression
  });

  test('at the floor, the user drops to the easier variant', () => {
    const e = resolveVariant(getExercise('pushup_wide'), floor, { level: 'Avançado', used: new Set() });
    expect(e.id).toBe('pushup_classic'); // pushup_wide.regression
  });

  test('the class tier ceiling still blocks an over-tier upshift', () => {
    // plank.progression = side_plank (tier 2) — a beginner (tier 1) must not get it
    const e = resolveVariant(getExercise('plank'), { offset: OFFSET.time[1] }, { level: 'Iniciante', used: new Set() });
    expect(e.id).toBe('plank');
  });

  test('an excluded or already-used variant is not swapped in', () => {
    expect(resolveVariant(getExercise('pushup_classic'), ceil, { level: 'Avançado', exclude: ['pushup_wide'], used: new Set() }).id).toBe('pushup_classic');
    expect(resolveVariant(getExercise('pushup_classic'), ceil, { level: 'Avançado', used: new Set(['pushup_wide']) }).id).toBe('pushup_classic');
  });

  test('no earned progression leaves the exercise unchanged', () => {
    expect(resolveVariant(getExercise('pushup_classic'), undefined, { level: 'Avançado', used: new Set() }).id).toBe('pushup_classic');
  });
});
