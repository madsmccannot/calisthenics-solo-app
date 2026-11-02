// Concurrency safety for the single `gameState` record (Phase 1 exit criterion:
// "Prevent concurrent read-modify-write operations from silently overwriting
// progress"). Every mutator runs read -> modify -> write with awaits in between;
// without serialization two overlapping calls read the same snapshot and the
// slower write discards the other's change. These tests fire mutators
// concurrently and assert that EVERY change lands.

// In-memory AsyncStorage with a real async delay on each op, so concurrent
// callers genuinely interleave (the lost-update window is guaranteed, not
// dependent on microtask timing).
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  const delay = () => new Promise((r) => setTimeout(r, 0));
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k) => { await delay(); return k in store ? store[k] : null; }),
      setItem: jest.fn(async (k, v) => { await delay(); store[k] = String(v); }),
      removeItem: jest.fn(async (k) => { await delay(); delete store[k]; }),
      clear: jest.fn(async () => { store = {}; }),
    },
  };
});
jest.mock('../src/services/cloudSync', () => ({ scheduleSync: () => {} }));
jest.mock('../src/services/feedRemote', () => ({ publishEvent: () => {} }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addXp,
  addCoins,
  getGameState,
  completeWorkout,
} from '../src/services/progressStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('concurrent addXp calls do not lose updates', async () => {
  const N = 12;
  await Promise.all(Array.from({ length: N }, () => addXp(10)));
  const state = await getGameState();
  expect(state.xp).toBe(N * 10);
  expect(state.stats.totalXpEarned).toBe(N * 10);
});

test('concurrent addCoins calls do not lose updates', async () => {
  const N = 20;
  await Promise.all(Array.from({ length: N }, () => addCoins(5)));
  const state = await getGameState();
  expect(state.coins).toBe(N * 5);
});

test('mixed concurrent mutators all apply (xp + coins + a workout)', async () => {
  await Promise.all([
    addXp(30),
    addCoins(40),
    completeWorkout({ dayNumber: 1, exercisesXp: 100, bonus: 0, streak: 0, exerciseCount: 5, reps: 50 }),
    addXp(30),
  ]);
  const state = await getGameState();
  // xp: 30 + 30 + 100 (workout) = 160; coins: 40 + workout coins (>=5)
  expect(state.xp).toBe(160);
  expect(state.coins).toBeGreaterThanOrEqual(40 + 5);
  expect(state.stats.totalWorkouts).toBe(1);
  expect(state.stats.totalReps).toBe(50);
});

test('concurrent completeWorkout for distinct days each count once', async () => {
  const day = (n) => ({ dayNumber: n, exercisesXp: 50, bonus: 0, streak: 0, exerciseCount: 3, reps: 20 });
  const results = await Promise.all([1, 2, 3, 4].map((n) => completeWorkout(day(n))));
  expect(results.every((r) => !r.duplicate)).toBe(true);
  const state = await getGameState();
  expect(state.stats.totalWorkouts).toBe(4);
  expect(state.xp).toBe(4 * 50);
});
