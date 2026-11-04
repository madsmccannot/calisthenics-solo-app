// AI output is untrusted (DEVELOPMENT_RULES §5): the plan generator must tag it,
// validate it against the catalogue/schema, and fall back to the deterministic
// engine when it is invalid — so bad model output never enters the plan.

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
const mockGenerate = jest.fn();
jest.mock('../src/services/geminiService', () => ({
  generateWorkoutPlan: (...a) => mockGenerate(...a),
  geminiConfigured: true, // pretend AI is enabled
}));
jest.mock('../src/services/cloudSync', () => ({ scheduleSync: () => {} }));
jest.mock('../src/services/feedRemote', () => ({ publishEvent: () => {} }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSeasonPlan } from '../src/services/planService';
import { validateWorkout } from '../src/domain/planSchema';

beforeEach(async () => {
  await AsyncStorage.clear();
  mockGenerate.mockReset();
});

test('invalid AI output is rejected and the day falls back to a valid local workout', async () => {
  // model returns a workout referencing an exercise that is not in the catalogue
  mockGenerate.mockResolvedValue({
    workout_type: 'Strength',
    exercises: [{ id: 'bogus_move', display_name: 'Bogus', type: 'reps', quantity: 12, rest_seconds: 40, animation_file: 'nope.json' }],
  });
  const plan = await generateSeasonPlan({ level: 'Iniciante' }, 1, new Date('2026-01-01'), 'en');
  const day1 = plan.find((d) => d.day_number === 1);
  expect(day1.source).toBe('local');          // fell back
  expect(validateWorkout(day1)).toEqual([]);    // and it is valid
  expect(day1.exercises.some((e) => e.id === 'bogus_move')).toBe(false);
});

test('valid AI output is accepted and tagged source "ai"', async () => {
  const validWorkout = {
    workout_type: 'Strength',
    exercises: [
      { id: 'pushup_classic', display_name: 'Push-ups', type: 'reps', quantity: 12, rest_seconds: 40, animation_file: 'pushup.json' },
      { id: 'squat_classic', display_name: 'Squats', type: 'reps', quantity: 15, rest_seconds: 40, animation_file: 'squat.json' },
      { id: 'plank', display_name: 'Plank', type: 'time', quantity: 30, rest_seconds: 30, animation_file: 'plank.json' },
      { id: 'superman', display_name: 'Superman', type: 'reps', quantity: 12, rest_seconds: 30, animation_file: 'superman.json' },
      { id: 'leg_raise', display_name: 'Leg Raises', type: 'reps', quantity: 12, rest_seconds: 30, animation_file: 'leg_raise.json' },
    ],
  };
  // valid only on day 1 (others fall back to local — keeps the test fast, since
  // an accepted AI day sleeps to space out calls)
  const bogus = { workout_type: 'X', exercises: [{ id: 'bogus_move', type: 'reps', quantity: 12, rest_seconds: 40, animation_file: 'nope.json' }] };
  mockGenerate.mockImplementation((_p, dayNumber) =>
    Promise.resolve(dayNumber === 1 ? validWorkout : bogus));
  const plan = await generateSeasonPlan({ level: 'Avançado' }, 1, new Date('2026-01-01'), 'en');
  const day1 = plan.find((d) => d.day_number === 1);
  expect(day1.source).toBe('ai');
  expect(validateWorkout(day1)).toEqual([]);
  expect(plan.find((d) => d.day_number === 2).source).toBe('local');
});
