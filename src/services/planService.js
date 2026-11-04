// Selective plan regeneration when the user changes training class, plus full
// season generation. Only touches days that are not completed and not recovery
// — completed days and rest days stay intact.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateWorkoutPlan, geminiConfigured } from './geminiService';
import { buildWorkout, buildSchedule, diagnoseWorkout } from '../domain/planGenerator';
import { validatePlan, validateWorkout } from '../domain/planSchema';
import { scheduleSync } from './cloudSync';
import { getProgression } from './progressStore';

const PLAN_KEY = 'workoutPlan';
const PLAN_CLASS_KEY = 'planClass'; // class the plan's workouts were generated with
const PLAN_START_KEY = 'planStartDate';
const PLAN_PREFS_KEY = 'planPrefs'; // personalization the plan was generated with

// Snapshot of the personalization the current plan was built with, so the UI can
// tell whether a change still needs applying (vs. comparing to the saved profile,
// which the Save button updates before anything is regenerated).
function planPrefsOf(profile = {}) {
  return {
    daysPerWeek: profile.daysPerWeek ?? null,
    sessionMinutes: profile.sessionMinutes ?? null,
    exclude: Array.isArray(profile.exclude) ? profile.exclude : [],
  };
}

export async function getPlanPrefs() {
  try {
    const raw = await AsyncStorage.getItem(PLAN_PREFS_KEY);
    return raw ? JSON.parse(raw) : planPrefsOf({});
  } catch {
    return planPrefsOf({});
  }
}

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
// Recovery every 7th day. Each workout day comes from the AI when a key is set,
// otherwise (or on AI failure) from the deterministic generator — never empty.
// ALWAYS returns 30 days and saves plan + start date + class.
export async function generateSeasonPlan(profile, season = 1, startDate = new Date(), lang = 'en') {
  const startD = new Date(startDate);
  startD.setHours(0, 0, 0, 0);

  // Weekly scheduling is decided up front (which days train, which recover),
  // separate from building each session.
  const schedule = buildSchedule(profile, 30);
  // Earned per-exercise progression feeds each prescription (Phase 4).
  const progression = await getProgression();
  const plan = [];
  for (const slot of schedule) {
    const date = new Date(startD);
    date.setDate(startD.getDate() + slot.day_number - 1);
    const iso = date.toISOString();

    if (slot.kind === 'recovery') {
      plan.push({ day_number: slot.day_number, date: iso, workout_type: 'Recovery', exercises: [], completed: false });
      continue;
    }
    // AI is optional: only try the network when a key is configured, otherwise
    // go straight to the deterministic generator (offline-first).
    let w = geminiConfigured ? await generateWithRetry(profile, slot.day_number, season, lang) : null;
    if (w) {
      // AI output is untrusted: tag its source and validate against the schema +
      // catalogue before it can enter the plan. Invalid -> fall back to local.
      const aiDay = { ...w, day_number: slot.day_number, date: iso, completed: false, source: 'ai' };
      if (validateWorkout(aiDay).length === 0) {
        plan.push(aiDay);
        await sleep(1200); // space out AI calls to dodge the rate limit
        continue;
      }
      console.warn(`[planService] AI day ${slot.day_number} failed validation — using local generator`);
    }
    // deterministic fallback — a valid workout with real exercises, no network
    w = buildWorkout(profile, slot.day_number, season, lang, slot.focus, progression);
    if (w) {
      plan.push({ ...w, day_number: slot.day_number, date: iso, completed: false });
      continue;
    }
    // last resort: the catalogue can't satisfy the profile (e.g. everything
    // excluded). Insert an explicit, explained rest day instead of an empty or
    // malformed workout — the plan stays valid and the reason is visible.
    const diag = diagnoseWorkout(profile);
    plan.push({ day_number: slot.day_number, date: iso, workout_type: 'Rest', exercises: [], completed: false, reason: diag.reason });
  }

  const problems = validatePlan(plan);
  if (problems.length) console.warn('[planService] generated plan has issues:', problems.slice(0, 5));

  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  await AsyncStorage.setItem(PLAN_START_KEY, startD.toISOString());
  await AsyncStorage.setItem(PLAN_CLASS_KEY, profile.level);
  await AsyncStorage.setItem(PLAN_PREFS_KEY, JSON.stringify(planPrefsOf(profile)));
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
  const progression = await getProgression();

  const updated = [];
  let changed = 0;
  for (const day of plan) {
    if (isRegenerable(day)) {
      if (geminiConfigured) {
        let ai = await generateWorkoutPlan(profile, day.day_number, 1, lang);
        if (!ai) {
          await sleep(5000); // likely rate-limit: wait and try a second time
          ai = await generateWorkoutPlan(profile, day.day_number, 1, lang);
        }
        if (ai) {
          // pin the original day_number/date; tag + validate the untrusted output
          const aiDay = { ...ai, day_number: day.day_number, date: day.date, completed: false, source: 'ai' };
          if (validateWorkout(aiDay).length === 0) {
            updated.push(aiDay);
            changed += 1;
            await sleep(1500); // space out AI calls
            continue;
          }
          console.warn(`[planService] AI regen day ${day.day_number} failed validation — using local generator`);
        }
      }
      // deterministic fallback so a class change still takes effect offline
      const workout = buildWorkout(profile, day.day_number, 1, lang, null, progression);
      if (workout) {
        updated.push({ ...workout, day_number: day.day_number, date: day.date, completed: false });
        changed += 1;
        continue;
      }
    }
    updated.push(day); // protected day (completed/recovery) -> keep the original
  }

  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(updated));
  await AsyncStorage.setItem(PLAN_CLASS_KEY, profile.level);
  await AsyncStorage.setItem(PLAN_PREFS_KEY, JSON.stringify(planPrefsOf(profile)));
  scheduleSync();
  return { changed };
}

// Re-applies earned per-exercise progression (Phase 4) to the FUTURE days of the
// current plan, so a prescription that was just earned shows up on the next
// session instead of only at the next season. Deterministic and offline: it
// rebuilds locally and never calls the AI. Completed days, rest/recovery days
// and AI-authored days (source !== 'local') are left untouched.
export async function applyProgressionToFuturePlan(profile, season = 1, lang = 'en') {
  const saved = await AsyncStorage.getItem(PLAN_KEY);
  if (!saved) return { changed: 0 };
  let plan;
  try { plan = JSON.parse(saved); } catch { return { changed: 0 }; }

  const progression = await getProgression();
  let changed = 0;
  const updated = plan.map((day) => {
    if (day.completed || day.source !== 'local') return day;
    if (day.workout_type === 'Recovery' || day.workout_type === 'Rest') return day;
    const w = buildWorkout(profile, day.day_number, season, lang, null, progression);
    if (!w) return day;
    changed += 1;
    return { ...w, day_number: day.day_number, date: day.date, completed: false };
  });

  if (changed) {
    await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(updated));
    scheduleSync();
  }
  return { changed };
}
