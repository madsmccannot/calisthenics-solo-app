// Workout-completion idempotency (Tarefa 3). A given workout day must award
// XP/coins/stats exactly once, no matter how many times it is submitted.

// In-memory AsyncStorage so the service's read-modify-write actually persists.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k) => Promise.resolve(k in store ? store[k] : null)),
      setItem: jest.fn((k, v) => { store[k] = String(v); return Promise.resolve(); }),
      removeItem: jest.fn((k) => { delete store[k]; return Promise.resolve(); }),
      multiRemove: jest.fn((ks) => { ks.forEach((k) => delete store[k]); return Promise.resolve(); }),
      clear: jest.fn(() => { store = {}; return Promise.resolve(); }),
    },
  };
});
// Isolate the service from network/sync side-effects.
jest.mock('../src/services/cloudSync', () => ({ scheduleSync: () => {} }));
jest.mock('../src/services/feedRemote', () => ({ publishEvent: () => {} }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  completeWorkout,
  getGameState,
  advanceSeason,
} from '../src/services/progressStore';

const WORKOUT = {
  exercisesXp: 100,
  bonus: 25,
  streak: 0,
  exerciseCount: 5,
  reps: 50,
  seconds: 0,
  repsById: { pushup_classic: 50 },
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('first completion of a day awards XP, coins and stats', async () => {
  const r = await completeWorkout({ dayNumber: 1, ...WORKOUT });
  expect(r.duplicate).toBeFalsy();
  expect(r.total).toBe(125);

  const s = await getGameState();
  expect(s.xp).toBe(125);
  expect(s.stats.totalWorkouts).toBe(1);
  expect(s.stats.totalReps).toBe(50);
  expect(s.coins).toBeGreaterThan(0);
  expect(s.rewardedWorkouts['1:1']).toBeTruthy();
});

test('re-submitting the same day is a no-op (no double award)', async () => {
  const first = await completeWorkout({ dayNumber: 1, ...WORKOUT });
  const afterFirst = await getGameState();

  const second = await completeWorkout({ dayNumber: 1, ...WORKOUT });
  const afterSecond = await getGameState();

  expect(first.duplicate).toBeFalsy();
  expect(second.duplicate).toBe(true);
  expect(second.total).toBe(0);

  // state is completely unchanged by the duplicate
  expect(afterSecond.xp).toBe(afterFirst.xp);
  expect(afterSecond.coins).toBe(afterFirst.coins);
  expect(afterSecond.stats.totalWorkouts).toBe(afterFirst.stats.totalWorkouts);
  expect(afterSecond.stats.totalReps).toBe(afterFirst.stats.totalReps);
});

test('a different day in the same season still awards', async () => {
  await completeWorkout({ dayNumber: 1, ...WORKOUT });
  await completeWorkout({ dayNumber: 2, ...WORKOUT });
  const s = await getGameState();
  expect(s.stats.totalWorkouts).toBe(2);
  expect(s.xp).toBe(250);
});

test('the same day number in a later season awards again', async () => {
  await completeWorkout({ dayNumber: 1, ...WORKOUT });
  const r1 = await completeWorkout({ dayNumber: 1, ...WORKOUT }); // dup in season 1
  expect(r1.duplicate).toBe(true);

  await advanceSeason(); // season -> 2
  const r2 = await completeWorkout({ dayNumber: 1, ...WORKOUT }); // fresh key "2:1"
  expect(r2.duplicate).toBeFalsy();

  const s = await getGameState();
  expect(s.stats.totalWorkouts).toBe(2);
  expect(s.rewardedWorkouts['1:1']).toBeTruthy();
  expect(s.rewardedWorkouts['2:1']).toBeTruthy();
});

test('missing dayNumber keeps awarding (back-compatible, no key)', async () => {
  await completeWorkout({ ...WORKOUT });
  await completeWorkout({ ...WORKOUT });
  const s = await getGameState();
  expect(s.stats.totalWorkouts).toBe(2); // no idempotency key -> both count
});
