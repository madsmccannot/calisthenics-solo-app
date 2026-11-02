// Sync layer (Tarefa 4): non-destructive weight sync, visible errors,
// rewardedWorkouts round-trip, feed preservation.

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

// Configurable fake Supabase. mock-prefixed names are allowed inside the factory.
let mockRecorded = [];
let mockResult = {}; // { [table]: { data?, error? } }
jest.mock('../src/services/supabase', () => {
  const fakeTable = (table) => {
    const rec = { table, ops: [] };
    mockRecorded.push(rec);
    const obj = {
      then(res, rej) {
        return Promise.resolve(mockResult[table] || { data: null, error: null }).then(res, rej);
      },
    };
    for (const m of ['update', 'upsert', 'insert', 'delete', 'eq', 'neq', 'not', 'select', 'order', 'limit', 'maybeSingle']) {
      obj[m] = (...args) => { rec.ops.push([m, args]); return obj; };
    }
    return obj;
  };
  return { __esModule: true, supabaseEnabled: true, supabase: { from: (t) => fakeTable(t) } };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  pushSnapshot,
  hasPendingSync,
  setSyncUser,
  gameToRow,
  rowToGame,
  pgDateList,
} from '../src/services/cloudSync';

const opNames = (rec) => rec.ops.map((o) => o[0]);
const tableRecs = (t) => mockRecorded.filter((r) => r.table === t);

beforeEach(async () => {
  await AsyncStorage.clear();
  mockRecorded = [];
  mockResult = {};
  setSyncUser('user-1');
});

describe('pure mappers', () => {
  test('gameToRow maps camelCase -> snake_case including rewarded_workouts', () => {
    const row = gameToRow({ xp: 5, coins: 3, ownedItems: ['a'], rewardedWorkouts: { '1:1': 'ts' } });
    expect(row.xp).toBe(5);
    expect(row.owned_items).toEqual(['a']);
    expect(row.rewarded_workouts).toEqual({ '1:1': 'ts' });
  });

  test('rowToGame maps back and preserves feed history', () => {
    const g = rowToGame({ xp: 5, owned_items: ['a'], rewarded_workouts: { '1:1': 'ts' } }, [{ id: 'f1' }]);
    expect(g.xp).toBe(5);
    expect(g.ownedItems).toEqual(['a']);
    expect(g.rewardedWorkouts).toEqual({ '1:1': 'ts' });
    expect(g.feedEvents).toEqual([{ id: 'f1' }]);
  });

  test('round-trip preserves the idempotency ledger', () => {
    const game = { xp: 9, coins: 2, season: 3, rewardedWorkouts: { '3:4': 'x' }, ownedItems: ['hat'] };
    const back = rowToGame(gameToRow(game));
    expect(back.xp).toBe(9);
    expect(back.season).toBe(3);
    expect(back.rewardedWorkouts).toEqual({ '3:4': 'x' });
    expect(back.ownedItems).toEqual(['hat']);
  });

  test('pgDateList double-quotes each date', () => {
    expect(pgDateList(['01/01', '02/02'])).toBe('("01/01","02/02")');
    expect(pgDateList([])).toBe('()');
  });
});

describe('pushSnapshot — non-destructive weight sync', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('userProfile', JSON.stringify({ weight: '80', height: '180', level: 'Iniciante' }));
    await AsyncStorage.setItem('gameState', JSON.stringify({ xp: 100, coins: 10, season: 1, rewardedWorkouts: { '1:1': 'ts' } }));
    await AsyncStorage.setItem('workoutPlan', JSON.stringify([{ day_number: 1, completed: true }]));
    await AsyncStorage.setItem('streakData', JSON.stringify({ current: 2, best: 5, lastCompletedDate: 'x' }));
    await AsyncStorage.setItem('weightLog', JSON.stringify([{ date: '01/01', weight: 80 }, { date: '02/01', weight: 79 }]));
  });

  test('weight is upserted and pruned, never bulk delete+insert', async () => {
    const res = await pushSnapshot();
    expect(res.ok).toBe(true);
    expect(hasPendingSync()).toBe(false);

    const wl = tableRecs('weight_log');
    const ops = wl.flatMap(opNames);
    expect(ops).toContain('upsert');      // current entries saved first
    expect(ops).not.toContain('insert');  // old delete-all + insert is gone
    // the prune is a targeted delete (has .not), not a delete-all
    const hasTargetedPrune = wl.some((r) => opNames(r).includes('delete') && opNames(r).includes('not'));
    expect(hasTargetedPrune).toBe(true);
  });

  test('progress upsert carries the idempotency ledger', async () => {
    await pushSnapshot();
    const prog = tableRecs('progress')[0];
    const upsertCall = prog.ops.find((o) => o[0] === 'upsert');
    expect(upsertCall[1][0]).toHaveProperty('rewarded_workouts', { '1:1': 'ts' });
  });

  test('a Supabase error is surfaced and marks the sync pending', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockResult = { progress: { error: { message: 'column missing', code: '42703' } } };

    const res = await pushSnapshot();
    expect(res.ok).toBe(false);
    expect(res.failed).toContain('progress');
    expect(hasPendingSync()).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('progress'));
    warn.mockRestore();
  });
});
