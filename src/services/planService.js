// Selective plan regeneration when the user changes training class, plus full
// season generation. Only touches days that are not completed and not recovery
// — completed days and rest days stay intact.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateWorkoutPlan } from './geminiService';
import { scheduleSync } from './cloudSync';

const PLAN_KEY = 'workoutPlan';
const PLAN_CLASS_KEY = 'planClass'; // class the plan's workouts were generated with
const PLAN_START_KEY = 'planStartDate';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Generates a workout with 1 retry (dodges rate-limit / one-off failures).
async function generateWithRetry(profile, dayNumber, season, lang) {
  let w = await generateWorkoutPlan(profile, dayNumber, season, lang);
  if (!w) {
    await sleep(4000);
    w = await generateWorkoutPlan(profile, dayNumber, season, lang);
  }
  return w;
}

// Generates a full season plan (30 days), anchored to `startDate`.
// Recovery every 7th day. Days the AI fails on stay empty (Dashboard warns).
// ALWAYS returns 30 days and saves plan + start date + class.
export async function generateSeasonPlan(profile, season = 1, startDate = new Date(), lang = 'en') {
  const startD = new Date(startDate);
  startD.setHours(0, 0, 0, 0);

  const plan = [];
  for (let i = 1; i <= 30; i++) {
    const date = new Date(startD);
    date.setDate(startD.getDate() + i - 1);
    const iso = date.toISOString();

    if (i % 7 === 0) {
      plan.push({ day_number: i, date: iso, workout_type: 'Recovery', exercises: [], completed: false });
      continue;
    }
    const w = await generateWithRetry(profile, i, season, lang);
    if (w) {
      plan.push({ ...w, day_number: i, date: iso, completed: false });
    } else {
      // placeholder — always keeps 30 days; the user can re-apply the load
      plan.push({ day_number: i, date: iso, workout_type: 'Strength', exercises: [], completed: false });
    }
    await sleep(1200);
  }

  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  await AsyncStorage.setItem(PLAN_START_KEY, startD.toISOString());
  await AsyncStorage.setItem(PLAN_CLASS_KEY, profile.level);
  scheduleSync();
  return plan;
}

export async function getPlanClass() {
  return AsyncStorage.getItem(PLAN_CLASS_KEY);
}

export async function setPlanClass(level) {
  if (level) await AsyncStorage.setItem(PLAN_CLASS_KEY, level);
}

// A day is regenerable if it's not done yet and not a recovery day.
// We don't filter by date: in the app any incomplete day is trainable (just tap
// the card), even if its date has already passed.
function isRegenerable(day) {
  return !day.completed && day.workout_type !== 'Recovery';
}

// How many days would be regenerated (to decide whether to even ask).
export async function getRegenerableCount() {
  try {
    const saved = await AsyncStorage.getItem(PLAN_KEY);
    if (!saved) return 0;
    const plan = JSON.parse(saved);
    return plan.filter(isRegenerable).length;
  } catch {
    return 0;
  }
}

// Plan diagnostics — to understand why regeneration doesn't show up.
export async function getPlanDiagnostics() {
  try {
    const saved = await AsyncStorage.getItem(PLAN_KEY);
    if (!saved) return { total: 0, completed: 0, recovery: 0, regenerable: 0, withDate: 0 };
    const plan = JSON.parse(saved);
    return {
      total: plan.length,
      completed: plan.filter((d) => d.completed).length,
      recovery: plan.filter((d) => d.workout_type === 'Recovery').length,
      regenerable: plan.filter(isRegenerable).length,
      withDate: plan.filter((d) => !!d.date).length,
    };
  } catch (e) {
    return { total: -1, completed: 0, recovery: 0, regenerable: 0, withDate: 0, error: String(e) };
  }
}

// Regenerates the eligible days with the new profile (new class/load) and
// language. Returns { changed } — how many days were actually replaced.
export async function regenerateFuturePlan(profile, lang = 'en') {
  const saved = await AsyncStorage.getItem(PLAN_KEY);
  if (!saved) return { changed: 0 };

  const plan = JSON.parse(saved);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const updated = [];
  let changed = 0;
  for (const day of plan) {
    if (isRegenerable(day)) {
      let workout = await generateWorkoutPlan(profile, day.day_number, 1, lang);
      if (!workout) {
        // likely rate-limit: wait and try a second time
        await sleep(5000);
        workout = await generateWorkoutPlan(profile, day.day_number, 1, lang);
      }
      if (workout) {
        // pin the original day_number/date — Gemini returns its own day_number
        // (often the example's, 1), which duplicated keys.
        updated.push({ ...workout, day_number: day.day_number, date: day.date, completed: false });
        changed += 1;
        await sleep(1500); // space out calls to avoid the rate limit
        continue;
      }
    }
    updated.push(day); // AI failure or protected day -> keep the original
  }

  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(updated));
  await AsyncStorage.setItem(PLAN_CLASS_KEY, profile.level);
  scheduleSync();
  return { changed };
}
