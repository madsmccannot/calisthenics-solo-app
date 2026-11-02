# Changelog

## Unreleased

### Added
- Deterministic, offline training-plan generator (`src/domain/planGenerator.js`)
  and a structured exercise catalogue (`src/domain/exercises.js`, 14 exercises
  with pattern/tier/type/animation/localized names). Plan generation no longer
  depends on the Gemini API: when no key is configured, or when a Gemini call
  fails, the app now builds a valid workout locally instead of leaving the day
  empty.
- Jest test suite for the domain core (`__tests__/planGenerator.test.js`,
  30 tests) — catalogue integrity, plan validity per class/focus, determinism,
  exclusions and bounded season scaling. Added `npm test`.
- Idempotency tests for workout completion (`__tests__/progressStore.test.js`,
  5 tests, in-memory AsyncStorage).
- Sync tests (`__tests__/cloudSync.test.js`, 7 tests): pure state mappers,
  `pgDateList`, and a fake-Supabase check that weight sync is non-destructive
  and that errors are surfaced.
- `login-username` and `gemini-proxy` Supabase Edge Functions
  (`supabase/functions/`) + `docs/SECURITY.md` deploy guide.
- Security tests (`__tests__/authSecurity.test.js`, 5 tests): username login
  never resolves an email client-side, and the Gemini key is not hard-wired
  into the request URL.
- Concurrency safety for the `gameState` record: a shared single-writer queue
  (`src/services/gameStateLock.js`) serializes every read-modify-write so
  overlapping local actions — and a cloud pull landing mid-write — can no longer
  silently discard each other's progress (lost-update bug). Regression tests
  (`__tests__/concurrency.test.js`, 4 tests) fail without the queue and pass
  with it. Closes the remaining Phase 1 exit criterion.
- Phase 2 — Exercise Knowledge Base: the 14 catalogue records now carry
  structured metadata (equipment, primary/secondary muscles, unilateral flag,
  execution cues, regression/progression relationships, review status) with
  controlled vocabularies (`EQUIPMENT`, `MUSCLES`). Added `validateCatalogue()`
  (ids unique, animations/patterns/tiers/types/muscles valid, relationships
  resolve and increase in difficulty, all five locales present), an equipment
  filter on `eligibleExercises`, and an `exercisesByMuscle` query. Catalogue
  integrity tests (`__tests__/catalogue.test.js`, 10 tests). Purely additive —
  no change to plan-generation behavior.
- Phase 4 (step 1/3) — Progression & Feedback Engine core
  (`src/domain/progression.js`): pure, per-exercise, earned from a subjective
  difficulty signal (easy/ok/hard), bounded and explainable, never time- or
  season-based. Every exposure is a generic `outcome`; `normalizeOutcome` is the
  single extension point, so Stage 2 objective metrics (actual reps, hold
  duration, sets, per-exercise history) plug in without rewriting the engine (a
  forward-compat test proves the objective path already decides identically).
  12 tests (`__tests__/progression.test.js`). Not yet wired to the UI/generator.

### Changed
- `planService.js` uses the deterministic generator as a fallback and skips the
  network entirely when `EXPO_PUBLIC_GEMINI_API_KEY` is absent (no more 24
  failed calls on first onboarding).
- `geminiService.js` exports `geminiConfigured`.
- Cloud sync (`cloudSync.js`) is now non-destructive and observable: the
  weight log is upserted on `(user_id, date)` and only stale rows are pruned
  (was delete-all + reinsert); every Supabase operation's error is inspected
  and logged (sanitized) instead of swallowed; `pushSnapshot` returns
  `{ ok, failed }` and a failed push is retried on app foreground
  (`retrySync`). The `rewardedWorkouts` idempotency ledger now syncs, and a
  pull preserves local feed history instead of wiping it.
- Username login now goes through the `login-username` Edge Function (email
  resolved server-side, never exposed; generic errors prevent enumeration).
- Gemini calls now prefer the `gemini-proxy` Edge Function (key held as a
  server secret). The direct `EXPO_PUBLIC_GEMINI_API_KEY` is a dev-only
  fallback that warns; with no AI configured the deterministic generator runs.

### Fixed
- Completed workouts could be replayed for duplicate XP/coins/stats. Now guarded
  at three layers: `completeWorkout` is idempotent per season+day, `Dashboard`
  no longer re-opens a completed day, `WorkoutEngine` fires `onComplete` once,
  and `App.handleWorkoutComplete` early-returns on an already-completed day.
- Cloud weight-log history could be lost if the old delete-all succeeded but
  the reinsert failed; and all sync errors were silently swallowed. Both fixed.

### Migration required
- Apply `supabase/schema.sql` (additive, re-runnable) before using this version
  with Supabase: it adds a unique index on `weight_log (user_id, date)` — needed
  by the new weight upsert — and a `progress.rewarded_workouts` column. Without
  it, progress/weight sync will log errors and keep retrying.
- Removed a critical PII leak: `email_for_username` was a `security definer`
  SQL function granted to `anon`, so anyone unauthenticated could turn a
  username into that account's email (disclosure + enumeration). The function
  is dropped and username login is resolved server-side.
- The billable Gemini API key no longer ships in the client bundle by default.

### Migration / deploy (Tarefa 5)
- Re-run `supabase/schema.sql` (drops `email_for_username`).
- Deploy `login-username` and `gemini-proxy`; set `GEMINI_API_KEY` as a Supabase
  secret; set `EXPO_PUBLIC_GEMINI_PROXY=1` and remove `EXPO_PUBLIC_GEMINI_API_KEY`
  from release builds. Full checklist in `docs/SECURITY.md`.
