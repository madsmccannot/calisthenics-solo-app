# Calisthenics Solo

Personal Calisthenics App made primarly for personal use, since the ones on Play Store are fucking shit and contain paywalls.

I started it leaning on AI for the workouts, but the app no longer *depends* on it: the core now plans, prescribes and progresses entirely offline from structured exercise data and the user's own training history. Gemini is an **optional** assist layer on top — if there's no key (or it fails), nothing breaks and it costs nothing to run.

It started as a simple workout tracker and turned into a progression **game**: open → daily mission → earn XP → unlock stuff → come back tomorrow. Same calisthenics — but now it actually keeps you hooked, and it works on a plane.

## Core (the workout stuff)
- ✅ Profile setup (weight, height, fitness class)
- ✅ **Offline plan generation** — a deterministic engine builds a valid 30-day season from a curated exercise catalogue; each day has a rotating focus (full body / upper / legs / core / HIIT) so workouts don't repeat. **AI is optional**: when a key/proxy is configured it can generate instead, but the app never needs it.
- ✅ Train workflow with timer, rest times and animations
- ✅ Beep sound + completion screen
- ✅ Weight log with BMI + history calendar

## Progression & feedback
- 💪 **Earned, per-exercise progression** — after each exercise you tap how it felt (**Easy / OK / Hard**). Difficulty rises *per exercise, only when you earn it* — never a blanket daily or per-season bump.
  - consistently Easy → more reps/time (bounded), then a **harder catalogue variant**
  - consistently Hard → eased, then an **easier variant**
  - everything bounded, explainable, and reflected on your upcoming days right away
- 🧱 **Built to grow** — today the signal is the subjective tap; objective metrics (actual reps, hold time, sets) slot into the same engine later without a rewrite.

## Gamification
- 🎮 **XP & Levels** — every exercise gives XP, level up with a curve (`125 × level`)
- 🏷️ **Titles** — Novice → Disciple → Athlete → Elite → Legend → Titan (auto from level)
- 🎯 **Daily missions** — workout + rotating habits (water, sleep, stretch…), claim XP + coins
- 🏅 **Medals** — 12 achievements (first pushup, 7-day streak, 1000 pushups, -5kg, …) in bronze/silver/gold
- 🪙 **Coin economy** — earned from workouts, missions and medals *(shop model is a placeholder — to be rethought)*
- 🧍 **Avatar** — customizable SVG character (body color, hair, headband, gloves, frame, theme), unlocked/bought in the locker
- 🛒 **Locker / shop** — buy + equip cosmetics with coins
- 📈 **Physical evolution page** — level, weight, BMI, workouts, streak, exercises, total time, coins
- 🔥 **Streaks** — consecutive-day tracking, kept across seasons

## Seasons
- 🗓️ **Season model** — the plan never dies. Finish a 30-day season → next one starts, anchored to today, with fresh variety. Difficulty is driven by *earned per-exercise progression*, not by the season number.
- 🧗 **Class affects load** — change class (Iniciante / Intermédio / Avançado) and regenerate the remaining days at the new intensity.
- 🏆 **Tiers** — Season 1-3, then Elite (4), Master (7), Legend (10+)

## Offline-first, accounts & sync
- 📴 **Offline-first** — everything (profile, plan, workouts, XP, weight) lives in **AsyncStorage** and works with no network and no account.
- ☁️ **Optional cloud (Supabase)** — set `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` to enable accounts (email or username login) and cross-device sync. Without them the app runs fully local.
- 🛡️ **Safe sync** — non-destructive (upsert + targeted prune, never delete-and-recreate), errors are surfaced not swallowed, and a pull **reconciles conflicts by field semantics** (monotonic counters keep the max, earned items/medals union, balances follow the newer side) so progress earned offline is never erased. All `gameState` writes are serialized through a single-writer lock to prevent lost updates.

## Social feed
- 📣 **Feed** — your real milestones (workouts, level ups, medals, streaks, seasons) shown with your avatar
- 🌐 **Online-ready** — set `EXPO_PUBLIC_FEED_API_URL` and the feed pulls **other people's** real milestones and publishes yours. Without a backend it falls back to local simulated activity so the feed isn't empty. Contract + a minimal server example are documented in `docs/BACKEND.md` (client in `src/services/feedRemote.js`).

## Internationalization
- 🌍 **5 languages** — English, Português, Español, Français, Deutsch, switchable in-app. Training class names (Strength / HIIT / Full Body) stay untranslated by design.

## Tech stack
- **Expo / React Native** (SDK 58, RN 0.88, React 19)
- **Deterministic domain core** (`src/domain/`) — exercise catalogue, plan generator, plan/workout schema + validators, and the progression engine; pure, no network, unit-tested
- **AsyncStorage** for all local state; **Supabase** (optional) for auth + cloud sync
- **Gemini** (`gemini-2.5-flash`) as an optional plan generator — called through a Supabase Edge Function proxy so the key is never shipped in the bundle (dev-only direct key supported with a warning)
- **expo-audio** (beep), **lottie-react-native** (exercise animations), **react-native-svg** (avatar)
- Hand-rolled navigation + a central `progressStore` that owns XP, coins, missions, medals, avatar, season, stats and per-exercise progression
- **Jest** (`jest-expo`) — 131 tests across the domain core and the sync/progression services

## Project structure
```
App.js                 hand-rolled navigation + app state
src/
├── domain/       exercises (catalogue), planGenerator, planSchema, progression   ← pure, tested core
├── screens/      Splash, Language, Auth, Username, Setup, Dashboard, WorkoutEngine,
│                 Completion, Stats, Profile, Feed
├── components/   Avatar, LevelHeader, MissionCard, MedalsWall, LockerModal,
│                 Confirm/Info/Recovery/Weight modals, LanguagePicker, AnimationPlayer
├── services/     geminiService, planService, progressStore, gameStateLock,
│                 cloudSync, supabase, auth, feed, feedRemote, localStore, soundService
├── config/       xpTable, missions, medals, shopCatalog, feedSim
├── i18n/         I18nContext, translations (en/pt/es/fr/de)
└── theme.js      central colors / radii / spacing
supabase/         schema.sql + Edge Functions (login-username, gemini-proxy)
docs/             SECURITY.md, BACKEND.md
__tests__/        domain + services test suites
```

## Tests
```
npm test
```
Covers catalogue integrity, deterministic plan generation + schema validation, workout idempotency, write concurrency, the progression engine, non-destructive sync + conflict merge, auth security, and a full offline-loop integration test.

## Setup
1. `npm install`
2. *(optional, for AI plans)* put your key in `.env`: `EXPO_PUBLIC_GEMINI_API_KEY=your_key` (git-ignored, **dev only** — for release use the `gemini-proxy` Edge Function and set `EXPO_PUBLIC_GEMINI_PROXY=1`)
3. *(optional, for accounts + sync)* `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (run `supabase/schema.sql` once, deploy the Edge Functions — see `docs/SECURITY.md`)
4. *(optional, for the online feed)* `EXPO_PUBLIC_FEED_API_URL=https://your-backend`
5. `npx expo start --tunnel`

The app runs with **none** of the optional env vars set — fully offline, no AI, no account.

## Security
See `docs/SECURITY.md`. Highlights: the Gemini key is never bundled (server-side proxy); username login resolves the email server-side via an Edge Function (no PII leak, no user enumeration); Supabase Row-Level Security scopes every table to its owner.

## Roadmap
- ⬜ On-device smoke test of the SDK 58 runtime
- ⬜ Objective progression metrics (actual reps / hold time / sets) feeding the existing engine
- ⬜ Grow the exercise catalogue (needs new animation assets; pulling is out of scope until then)
- ⬜ Align the optional AI prompt with the earned-progression model
- ⬜ Backend for the online feed (client is already wired — see `docs/BACKEND.md`)
- ⬜ 3D exercise animations (metallic/transparent, procedural — replacing Lottie)
- ⬜ Real monetization model (the coin shop is a placeholder)
