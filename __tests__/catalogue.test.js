// Exercise Knowledge Base integrity (Phase 2). The catalogue must load and
// validate without AI or network, every relationship must resolve, and the
// query API must honour equipment/ability/pattern/exclusion constraints.

import {
  EXERCISES,
  EXERCISE_IDS,
  ANIMATION_FILES,
  MUSCLES,
  validateCatalogue,
  eligibleExercises,
  exercisesByMuscle,
  getExercise,
} from '../src/domain/exercises';

test('catalogue passes its own integrity validator', () => {
  const problems = validateCatalogue();
  expect(problems).toEqual([]);
});

test('ids are unique and stable', () => {
  expect(new Set(EXERCISE_IDS).size).toBe(EXERCISE_IDS.length);
});

test('every animation reference exists in the asset list', () => {
  const anim = new Set(ANIMATION_FILES);
  for (const e of EXERCISES) expect(anim.has(e.animation)).toBe(true);
});

test('regression/progression references are symmetric where both ends are a pair', () => {
  // If A.progression = B, and B has a regression, it should point back to A.
  for (const a of EXERCISES) {
    if (!a.progression) continue;
    const b = getExercise(a.progression);
    expect(b).not.toBeNull();
    if (b.regression != null) expect(b.regression).toBe(a.id);
  }
});

test('a progression is never easier than its source (tier strictly increases)', () => {
  for (const a of EXERCISES) {
    if (!a.progression) continue;
    expect(getExercise(a.progression).tier).toBeGreaterThan(a.tier);
  }
});

test('eligibleExercises enforces the class tier ceiling', () => {
  const beginner = eligibleExercises({ level: 'Iniciante' });
  expect(beginner.every((e) => e.tier === 1)).toBe(true);
  const advanced = eligibleExercises({ level: 'Avançado' });
  expect(advanced.length).toBeGreaterThan(beginner.length);
});

test('eligibleExercises honours exclusions and patterns', () => {
  const pushOnly = eligibleExercises({ level: 'Avançado', patterns: ['push'] });
  expect(pushOnly.every((e) => e.pattern === 'push')).toBe(true);
  const excluded = eligibleExercises({ level: 'Avançado', patterns: ['push'], exclude: ['pushup_classic'] });
  expect(excluded.find((e) => e.id === 'pushup_classic')).toBeUndefined();
});

test('equipment filter: bodyweight catalogue is fully available with no equipment', () => {
  // All current exercises need no equipment, so an empty equipment set returns all.
  const all = eligibleExercises({ level: 'Avançado', equipment: [] });
  expect(all.length).toBe(EXERCISES.filter((e) => e.tier <= 3).length);
});

test('exercisesByMuscle finds work for every declared muscle token', () => {
  for (const m of MUSCLES) {
    // Not every muscle must be covered, but if a token is declared primary
    // anywhere, the query must find it.
    const primary = EXERCISES.some((e) => e.primary.includes(m));
    if (primary) expect(exercisesByMuscle(m).length).toBeGreaterThan(0);
  }
});
