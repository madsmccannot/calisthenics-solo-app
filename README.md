# Calisthenics Solo

Personal Calisthenics App made primarly for personal use, since the ones on Play Store are fucking shit and contain paywalls.

I know damn well that they use AI on them so I just decided to do one as well, but for me, since I wont charge myself and the only costs would be for the gemini API use.

It started as a simple workout tracker and turned into a progression **game**: open → daily mission → earn XP → unlock stuff → come back tomorrow. Same calisthenics, same AI plans — but now it actually keeps you hooked.

## Core (the workout stuff)
- ✅ Profile setup (weight, height, fitness class)
- ✅ AI-generated plan (Gemini) — 30-day seasons, each day has a rotating focus (full body / upper / legs / core / HIIT) so workouts don't repeat
- ✅ Train workflow with timer, rest times and animations
- ✅ Beep sound + completion screen
- ✅ Weight log with BMI + history calendar

## Gamification
- 🎮 **XP & Levels** — every exercise gives XP, level up with a curve (`125 × level`)
- 🏷️ **Titles** — Novato → Discípulo → Atleta → Elite → Lenda → Titã (auto from level)
- 🎯 **Daily missions** — workout + rotating habits (water, sleep, stretch…), claim XP + coins
- 🏅 **Medals** — 12 achievements (first pushup, 7-day streak, 1000 pushups, -5kg, …) in bronze/silver/gold
- 🪙 **Coin economy** — earned from workouts, missions and medals *(shop model is a placeholder — to be rethought)*
- 🧍 **Avatar** — customizable SVG character (body color, hair, headband, gloves, frame, theme), unlocked/bought in the locker
- 🛒 **Locker / shop** — buy + equip cosmetics with coins
- 📈 **Physical evolution page** — level, weight, BMI, workouts, streak, exercises, total time, coins
- 🔥 **Streaks** — consecutive-day tracking, kept across seasons

## Seasons
- 🗓️ **Season model** — the plan never dies. Finish a 30-day season → next one starts, anchored to today, **harder** (Gemini scales difficulty per season)
- 🧗 **Class affects load** — change class (Iniciante / Intermédio / Avançado) and regenerate the remaining days at the new intensity via AI
- 🏆 **Tiers** — Season 1-3, then Elite (4), Master (7), Legend (10+)

## Tech stack
- **Expo / React Native** (SDK 54, RN 0.81, React 19)
- **Gemini** (`gemini-2.5-flash`) for plan generation — thinking disabled, JSON output, per-day/per-season prompting
- **AsyncStorage** for all local state (no backend — solo/offline)
- **react-native-svg** for the avatar
- Hand-rolled navigation + a central `progressStore` that owns XP, coins, missions, medals, avatar, season and stats

## Project structure
```
src/
├── screens/      Splash, Setup, Dashboard, WorkoutEngine, Completion, Stats, Profile
├── components/   Avatar, LevelHeader, MissionCard, MedalsWall, LockerModal,
│                 ConfirmModal, InfoModal, RecoveryModal, WeightModal, AnimationPlayer
├── services/     geminiService, planService, progressStore, localStore, soundService
├── config/       xpTable, missions, medals, shopCatalog
└── theme.js      central colors / radii / spacing
```

## Setup
1. `npm install`
2. Put your key in `.env`: `EXPO_PUBLIC_GEMINI_API_KEY=your_key` (git-ignored)
3. `npx expo start --tunnel`

## Roadmap
- ⬜ Feed (own milestones now; ready to show others' when online)
- ⬜ 3D exercise animations (metallic/transparent, procedural — replacing Lottie)
- ⬜ Real monetization model (the coin shop is a placeholder)
