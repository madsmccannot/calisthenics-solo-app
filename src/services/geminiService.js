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

const LEVEL_GUIDANCE = {
  Iniciante:
    'INTENSIDADE BAIXA. Repetições 8-14 por exercício. Descansos longos (35-45s). ' +
    'Só variações fáceis (pushup_classic, squat_classic, jumping_jack, plank). Isometrias 20-30s.',
  Intermédio:
    'INTENSIDADE MÉDIA. Repetições 15-22 por exercício. Descansos médios (20-30s). ' +
    'Inclui variações moderadas (lunge, mountain_climber, leg_raise). Isometrias 30-45s.',
  Avançado:
    'INTENSIDADE ALTA. Repetições 22-35 por exercício. Descansos curtos (10-20s). ' +
    'Usa as variações difíceis (pushup_diamond, squat_jump, burpee, hollow_body_hold). Isometrias 45-70s.',
};

// Foco rotativo por dia, para os treinos NÃO saírem todos iguais.
const DAILY_FOCUS = [
  { type: 'Full Body', focus: 'Corpo inteiro — mistura empurrar, pernas e core.' },
  { type: 'Strength', focus: 'Tren superior — peito, ombros e braços (flexões e as suas variações, prancha).' },
  { type: 'Strength', focus: 'Pernas e glúteos — agachamentos, afundos e saltos.' },
  { type: 'Core', focus: 'Core e abdominais — prancha, prancha lateral, hollow body, elevações de pernas, superman.' },
  { type: 'HIIT', focus: 'HIIT cardio — burpees, mountain climbers, polichinelos, agachamento com salto.' },
  { type: 'Full Body', focus: 'Corpo inteiro em circuito — alterna grupos musculares.' },
];

export async function generateWorkoutPlan(profile, dayNumber = 1) {
  const guidance = LEVEL_GUIDANCE[profile.level] || LEVEL_GUIDANCE.Iniciante;
  const today = DAILY_FOCUS[(dayNumber - 1) % DAILY_FOCUS.length];
  const userPrompt = `
Gera o treino para o Dia ${dayNumber} com estes dados:
- Peso: ${profile.weight}kg
- Altura: ${profile.height}cm
- Nível: ${profile.level}
- Dia do plano: ${dayNumber} de 30

FOCO DESTE DIA (obrigatório): ${today.focus}
Usa "workout_type": "${today.type}".

VARIEDADE (obrigatório): escolhe exercícios adequados a este foco e VARIA em relação a outros dias.
NÃO repitas sempre a mesma sequência nem os mesmos números de repetições. Varia a ordem, os
exercícios escolhidos e as quantidades. Inclui 5 a 7 exercícios.

REGRA DE CARGA (obrigatória, ajusta os campos "quantity" e "rest_seconds" a isto):
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
          responseMimeType: 'application/json', // saída JSON pura, sem markdown
          thinkingConfig: { thinkingBudget: 0 }, // desliga o "thinking" do 2.5-flash
        }
      })
    });

    const data = await response.json();

    // Erro da API (quota, chave inválida, 429...) -> devolve o motivo, não crasha
    if (!response.ok || data?.error) {
      console.error('Gemini erro API', response.status, JSON.stringify(data?.error || data).slice(0, 300));
      return null;
    }

    // Parse defensivo: sem parts/text não rebenta, regista o finishReason
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason;
      console.error('Gemini sem texto. finishReason:', reason, JSON.stringify(data).slice(0, 300));
      return null;
    }

    const clean = text.replace(/```json|```/g, '').trim();
    let parsed = JSON.parse(clean);

    // o modelo às vezes embrulha o treino num array [{...}] — desembrulha
    if (Array.isArray(parsed)) parsed = parsed[0];

    // valida a estrutura mínima — sem exercises válidos, trata como falha
    if (!parsed || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      console.error('Gemini JSON sem exercises:', clean.slice(0, 200));
      return null;
    }
    return parsed;

  } catch (error) {
    console.error('Erro Gemini:', error);
    return null;
  }
}