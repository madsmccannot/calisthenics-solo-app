// Integration (Phase 7): the full offline loop — generate a plan, record how
// exercises felt, and see the earned progression reflected on future days —
// with NO network and NO AI. Exercises the real planService + planGenerator +
// progressStore + progression together (only storage/sync/feed are faked).

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k) => Promise.resolve(k in store ? store[k] : null)),
      setItem: jest.fn((k, v) => { store[k] = String(v); return Promise.resolve(); }),
      removeItem: jest.fn((k) => { delete store[k]; return Promise.resolve(); }),
      clear: jest.fn(() => { store = {}; return Promise.resolve(); }),
    },
  };
});
jest.mock('../src/services/geminiService', () => ({ generateWorkoutPlan: jest.fn(), geminiConfigured: false }));
jest.mock('../src/services/cloudSync', () => ({ scheduleSync: () => {} }));
jest.mock('../src/services/feedRemote', () => ({ publishEvent: () => {} }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSeasonPlan, applyProgressionToFuturePlan } from '../src/services/planService';
import { recordOutcomes, getProgression } from '../src/services/progressStore';
import { validatePlan } from '../src/domain/planSchema';

const profile = { level: 'Iniciante' };

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function loadPlan() {
  return JSON.parse(await AsyncStorage.getItem('workoutPlan'));
}

test('generates a valid 30-day offline plan with recovery every 7th day', async () => {
  const plan = await generateSeasonPlan(profile, 1, new Date('2026-01-01'), 'en');
  expect(plan.length).toBe(30);
  expect(validatePlan(plan)).toEqual([]);
  const recovery = plan.filter((d) => d.workout_type === 'Recovery').map((d) => d.day_number);
  expect(recovery).toEqual([7, 14, 21, 28]);
  for (const d of plan.filter((d) => d.workout_type !== 'Recovery')) expect(d.source).toBe('local');
});

test('earned progression raises the exercise on future days (full loop)', async () => {
  const plan = await generateSeasonPlan(profile, 1, new Date('2026-01-01'), 'en');
  // pick an exercise that appears on day 1
  const day1 = plan.find((d) => d.day_number === 1);
  const target = day1.exercises[0];
  const before = target.quantity;

  // two "easy" exposures earn a step up for that exercise
  await recordOutcomes([{ exerciseId: target.id, type: target.type, difficulty: 'easy' }]);
  await recordOutcomes([{ exerciseId: target.id, type: target.type, difficulty: 'easy' }]);
  expect((await getProgression())[target.id].offset).toBeGreaterThan(0);

  const { changed } = await applyProgressionToFuturePlan(profile, 1, 'en');
  expect(changed).toBeGreaterThan(0);

  const after = (await loadPlan()).find((d) => d.day_number === 1).exercises.find((e) => e.id === target.id);
  expect(after.quantity).toBeGreaterThan(before);
  expect(validatePlan(await loadPlan())).toEqual([]); // still valid
});

test('the retroactive refresh never touches completed or recovery days', async () => {
  await generateSeasonPlan(profile, 1, new Date('2026-01-01'), 'en');
  // mark day 1 completed and snapshot it
  let plan = await loadPlan();
  plan = plan.map((d) => (d.day_number === 1 ? { ...d, completed: true } : d));
  await AsyncStorage.setItem('workoutPlan', JSON.stringify(plan));
  const day1Before = plan.find((d) => d.day_number === 1);
  const recoveryBefore = plan.find((d) => d.workout_type === 'Recovery');

  // earn something, then refresh
  await recordOutcomes([{ exerciseId: 'squat_classic', type: 'reps', difficulty: 'easy' }]);
  await recordOutcomes([{ exerciseId: 'squat_classic', type: 'reps', difficulty: 'easy' }]);
  await applyProgressionToFuturePlan(profile, 1, 'en');

  const after = await loadPlan();
  expect(after.find((d) => d.day_number === 1)).toEqual(day1Before); // completed: untouched
  expect(after.find((d) => d.workout_type === 'Recovery')).toEqual(recoveryBefore); // recovery: untouched
});

describe('personalization inputs flow from the profile into the plan (Phase 3 / #1)', () => {
  test('daysPerWeek reshapes the weekly schedule', async () => {
    const plan = await generateSeasonPlan({ level: 'Iniciante', daysPerWeek: 4 }, 1, new Date('2026-01-01'), 'en');
    // 4 train / 3 recover per 7-day week -> recovery on days 5,6,7, 12,13,14, ...
    const workouts = plan.filter((d) => d.workout_type !== 'Recovery').length;
    expect(workouts).toBe(plan.filter((d, i) => ((d.day_number - 1) % 7) < 4).length);
    expect(plan.find((d) => d.day_number === 5).workout_type).toBe('Recovery');
  });

  test('sessionMinutes sets the session length', async () => {
    const plan = await generateSeasonPlan({ level: 'Avançado', sessionMinutes: 45 }, 1, new Date('2026-01-01'), 'en');
    const day1 = plan.find((d) => d.day_number === 1);
    expect(day1.exercises.length).toBe(9); // round(45/4)=11 -> clamped to 9
  });

  test('excluded exercises never appear anywhere in the plan', async () => {
    const exclude = ['burpee', 'pushup_diamond', 'squat_jump'];
    const plan = await generateSeasonPlan({ level: 'Avançado', exclude }, 1, new Date('2026-01-01'), 'en');
    for (const day of plan) {
      for (const ex of day.exercises || []) expect(exclude).not.toContain(ex.id);
    }
  });
});
