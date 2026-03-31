const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `Atua como um Treinador de Calistenia especializado em Treino de Solo (Bodyweight) e Perda de Peso Rápida.

RESTRIÇÃO ABSOLUTA: Não sugiras exercícios que requeiram barras, paralelas, pesos ou elásticos. Apenas exercícios de chão/solo.
OBJETIVO: Criar um plano de 30 dias focado em défice calórico e resistência muscular.

OUTPUT: Responde APENAS em JSON puro, sem markdown, sem backticks, sem texto extra. Segue exatamente esta estrutura:
{
  "day_number": 1,
  "workout_type": "HIIT",
  "exercises": [
    {
      "id": "pushup_classic",
      "display_name": "Flexões Clássicas",
      "type": "reps",
      "quantity": 12,
      "rest_seconds": 30,
      "animation_file": "pushup.json"
    }
  ]
}

LISTA DE EXERCÍCIOS PERMITIDOS (usa apenas estes ids):
pushup_classic, pushup_diamond, pushup_wide, squat_classic, squat_jump,
lunge, burpee, mountain_climber, plank, side_plank, superman,
hollow_body_hold, leg_raise, jumping_jack

ANIMATION FILES disponíveis (mapeia o id ao ficheiro correto):
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

export async function generateWorkoutPlan(profile, dayNumber = 1) {
  const userPrompt = `
Gera o treino para o Dia ${dayNumber} com estes dados:
- Peso: ${profile.weight}kg
- Altura: ${profile.height}cm
- Nível: ${profile.level}
- Dia do plano: ${dayNumber} de 30
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
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      })
    });

    const data = await response.json();
    console.log('RESPOSTA COMPLETA:', JSON.stringify(data, null, 2));
    const raw = data.candidates[0].content.parts[0].text;

    // Limpa qualquer markdown que a IA possa ter incluído
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);

  } catch (error) {
    console.error('Erro Gemini:', error);
    return null;
  }
}