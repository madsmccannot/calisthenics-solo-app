// Progression & Feedback Engine (Phase 4) — pure, deterministic, per-exercise.
//
// Design principle (product decision): progression must be EARNED from each
// person's real performance, per exercise, at its own pace — never a daily or
// per-season blanket increase.
//
// Stage 1 (now): the only captured signal is a subjective difficulty tap
// (easy / ok / hard) per exercise exposure.
// Stage 2 (later): objective metrics — actual reps, real hold duration,
// completed sets, per-exercise history — will be ADDED without rewriting this
// engine. That is possible because every exposure is a generic `outcome` object
// with optional fields, and a single `normalizeOutcome` turns whatever fields
// are present into one of {easy, ok, hard}. Adding objective metrics later means
// enriching the outcome + extending `normalizeOutcome`, not changing the
// decision logic, the stored shape, or the callers.
//
// An `outcome` (all fields except exercise context optional):
//   { difficulty?: 'easy'|'ok'|'hard',   // Stage 1 signal
//     completed?: boolean,               // false = skipped/abandoned
//     achieved?: number, prescribed?: number, sets?: number, duration?: number, // Stage 2
//     ts?: number }
//
// Progression state is a plain map, safe to persist and to sync:
//   { [exerciseId]: { offset, signals:[...], lastRule, updatedAt } }
//   offset  — bounded adjustment added to the base prescription (reps or sec)
//   signals — recent normalized difficulty tokens, reset when a step is taken
//             (so each step must be re-earned)

export const DIFFICULTY = ['easy', 'ok', 'hard'];

// How many recent exposures the decision looks at.
export const WINDOW = 3;
// Consecutive signals needed to move.
export const PROGRESS_STREAK = 2; // 'easy' in a row -> harder
export const REGRESS_STREAK = 2;  // 'hard' in a row -> easier
// Bounded step per move.
export const STEP = { reps: 2, time: 5 };
// Final-prescription bounds (mirror the generator's own caps).
export const BOUNDS = { reps: [5, 40], time: [15, 90] };
// Bounds on the earned offset itself. At the top, the next step is a harder
// catalogue variant; at the bottom, an easier one — so the offset never drifts
// unboundedly and "at ceiling / at floor" is meaningful.
export const OFFSET = { reps: [-10, 20], time: [-20, 40] };

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function stepFor(type) {
  return type === 'time' ? STEP.time : STEP.reps;
}

function clampOffset(offset, type) {
  const [lo, hi] = type === 'time' ? OFFSET.time : OFFSET.reps;
  return clamp(offset, lo, hi);
}

// Turn any outcome into a single difficulty token (or null = no signal).
// Stage 1 reads `difficulty`; a skipped exercise counts as a struggle. When
// objective fields are added later, extend ONLY this function (e.g. derive a
// token from achieved/prescribed) — nothing else needs to change.
export function normalizeOutcome(outcome = {}) {
  if (outcome.completed === false) return 'hard';
  if (DIFFICULTY.includes(outcome.difficulty)) return outcome.difficulty;
  // Stage 2 hook (inert until objective metrics are captured):
  if (typeof outcome.achieved === 'number' && typeof outcome.prescribed === 'number' && outcome.prescribed > 0) {
    const ratio = outcome.achieved / outcome.prescribed;
    if (ratio >= 1.15) return 'easy';
    if (ratio < 0.85) return 'hard';
    return 'ok';
  }
  return null; // completed but no effort signal -> neutral, no state change
}

// Decide from the recent signal window. Only a clean tail streak moves the
// needle; anything mixed holds.
export function decide(signals = []) {
  const n = signals.length;
  const tail = (k) => n >= k && signals.slice(n - k).every((s) => s === signals[n - 1]);
  if (tail(PROGRESS_STREAK) && signals[n - 1] === 'easy') return { decision: 'progress', rule: `${PROGRESS_STREAK}x easy` };
  if (tail(REGRESS_STREAK) && signals[n - 1] === 'hard') return { decision: 'regress', rule: `${REGRESS_STREAK}x hard` };
  return { decision: 'hold', rule: null };
}

// Fold one exposure into the progression state. Pure: returns a NEW map.
export function applyOutcome(progression = {}, exerciseId, type, outcome = {}) {
  if (!exerciseId) return progression;
  const prev = progression[exerciseId] || { offset: 0, signals: [], lastRule: null };
  const token = normalizeOutcome(outcome);
  const signals = token ? [...prev.signals, token].slice(-WINDOW) : prev.signals;
  const { decision, rule } = decide(signals);

  let offset = prev.offset;
  let nextSignals = signals;
  if (decision === 'progress') { offset = clampOffset(prev.offset + stepFor(type), type); nextSignals = []; }
  else if (decision === 'regress') { offset = clampOffset(prev.offset - stepFor(type), type); nextSignals = []; }

  const next = {
    offset,
    signals: nextSignals,
    lastRule: rule || prev.lastRule || null,
    updatedAt: outcome.ts || Date.now(),
  };
  return { ...progression, [exerciseId]: next };
}

// The prescribed quantity for an exercise: its base value adjusted by the
// earned offset, clamped to sane bounds. The generator calls this instead of
// scaling difficulty by the season counter.
export function prescriptionFor(base, type, entry) {
  const [lo, hi] = type === 'time' ? BOUNDS.time : BOUNDS.reps;
  return clamp(base + (entry?.offset || 0), lo, hi);
}

// True when an exercise has earned as much as its offset allows: the person
// should move to the harder catalogue variant (if one exists). Lets callers
// decide a variant swap without this module importing the catalogue.
export function atCeiling(type, entry) {
  const [, hi] = type === 'time' ? OFFSET.time : OFFSET.reps;
  return (entry?.offset || 0) >= hi;
}

// True when an exercise has been eased as far as its offset allows: the person
// should drop to the easier catalogue variant (if one exists).
export function atFloor(type, entry) {
  const [lo] = type === 'time' ? OFFSET.time : OFFSET.reps;
  return (entry?.offset || 0) <= lo;
}
