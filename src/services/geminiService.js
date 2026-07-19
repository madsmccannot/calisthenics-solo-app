const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Language code -> language name for the prompt, so the AI writes the exercise
// display names in the app's current language (the id stays the same).
const LANG_NAMES = { en: 'English', pt: 'Portuguese', es: 'Spanish', fr: 'French', de: 'German' };

const SYSTEM_PROMPT = `Act as a Calisthenics coach specialized in solo (bodyweight) training and fast weight loss.

HARD CONSTRAINT: Do not suggest exercises that require bars, parallettes, weights or resistance bands. Floor/bodyweight exercises only.
GOAL: Build workouts focused on a calorie deficit and muscular endurance.

OUTPUT: Reply ONLY in pure JSON, no markdown, no backticks, no extra text. Follow exactly this structure:
{
  "day_number": 1,
  "workout_type": "HIIT",
  "exercises": [
    {
      "id": "pushup_classic",
      "display_name": "Classic Push-ups",
      "type": "reps",
      "quantity": 12,
      "rest_seconds": 30,
      "animation_file": "pushup.json"
    }
  ]
}

ALLOWED EXERCISES (use only these ids):
pushup_classic, pushup_diamond, pushup_wide, squat_classic, squat_jump,
lunge, burpee, mountain_climber, plank, side_plank, superman,
hollow_body_hold, leg_raise, jumping_jack

ANIMATION FILES (map the id to the correct file):
pushup_classic → pushup.json
pushup_diamond → pushup.json
pushup_wide → pushup.json
squat_classic → squat.json
squat_jump → squat.json
lunge → lunge.json
burpee → burpee.json
mountain_climber → mountain_climber.json
plank → plank.json
side_plank → plank.json
superman → superman.json
hollow_body_hold → plank.json
leg_raise → leg_raise.json
jumping_jack → jumping_jack.json`;

// Keys are the canonical profile.level values (kept as-is; used elsewhere).
const LEVEL_GUIDANCE = {
  Iniciante:
    'LOW INTENSITY. 8-14 reps per exercise. Long rests (35-45s). ' +
    'Only easy variations (pushup_classic, squat_classic, jumping_jack, plank). Holds 20-30s.',
  Intermédio:
    'MEDIUM INTENSITY. 15-22 reps per exercise. Medium rests (20-30s). ' +
    'Include moderate variations (lunge, mountain_climber, leg_raise). Holds 30-45s.',
  Avançado:
    'HIGH INTENSITY. 22-35 reps per exercise. Short rests (10-20s). ' +
    'Use the hard variations (pushup_diamond, squat_jump, burpee, hollow_body_hold). Holds 45-70s.',
};

// Rotating focus per day, so workouts don't all come out the same.
const DAILY_FOCUS = [
  { type: 'Full Body', focus: 'Full body — mix push, legs and core.' },
  { type: 'Strength', focus: 'Upper body — chest, shoulders and arms (push-ups and their variations, plank).' },
  { type: 'Strength', focus: 'Legs and glutes — squats, lunges and jumps.' },
  { type: 'Core', focus: 'Core and abs — plank, side plank, hollow body, leg raises, superman.' },
  { type: 'HIIT', focus: 'HIIT cardio — burpees, mountain climbers, jumping jacks, jump squats.' },
  { type: 'Full Body', focus: 'Full body circuit — alternate muscle groups.' },
];

export async function generateWorkoutPlan(profile, dayNumber = 1, season = 1, lang = 'en') {
  const guidance = LEVEL_GUIDANCE[profile.level] || LEVEL_GUIDANCE.Iniciante;
  const today = DAILY_FOCUS[(dayNumber - 1) % DAILY_FOCUS.length];
  const langName = LANG_NAMES[lang] || 'English';
  const seasonRule =
    season > 1
      ? `\nTHIS IS SEASON ${season}: increase difficulty vs earlier seasons — more reps (about +${(season - 1) * 15}%), harder variations and slightly shorter rests, WITHOUT breaking the level's load rule.`
      : '';
  const userPrompt = `
Generate the workout for Day ${dayNumber} with this data:
- Weight: ${profile.weight}kg
- Height: ${profile.height}cm
- Level: ${profile.level}
- Season: ${season} · Plan day: ${dayNumber} of 30

LANGUAGE (mandatory): write every "display_name" in ${langName}. Keep the "id" values exactly as listed.

FOCUS OF THIS DAY (mandatory): ${today.focus}
Use "workout_type": "${today.type}".${seasonRule}

VARIETY (mandatory): pick exercises that fit this focus and VARY from other days.
Do NOT always repeat the same sequence or rep counts. Vary the order, the chosen
exercises and the quantities. Include 5 to 7 exercises.

LOAD RULE (mandatory, tune the "quantity" and "rest_seconds" fields to this):
${guidance}
`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT + '\n\n' + userPrompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json', // pure JSON output, no markdown
          thinkingConfig: { thinkingBudget: 0 }, // disable 2.5-flash "thinking"
        }
      })
    });

    const data = await response.json();

    // API error (quota, invalid key, 429...) -> return the reason, don't crash
    if (!response.ok || data?.error) {
      console.error('Gemini API error', response.status, JSON.stringify(data?.error || data).slice(0, 300));
      return null;
    }

    // Defensive parse: no parts/text won't crash, logs the finishReason
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason;
      console.error('Gemini returned no text. finishReason:', reason, JSON.stringify(data).slice(0, 300));
      return null;
    }

    const clean = text.replace(/```json|```/g, '').trim();
    let parsed = JSON.parse(clean);

    // the model sometimes wraps the workout in an array [{...}] — unwrap it
    if (Array.isArray(parsed)) parsed = parsed[0];

    // validate the minimal structure — no valid exercises means failure
    if (!parsed || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      console.error('Gemini JSON without exercises:', clean.slice(0, 200));
      return null;
    }
    return parsed;

  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}
