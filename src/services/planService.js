// Regeneração seletiva do plano quando o utilizador muda de classe de treino.
// Só toca em dias FUTUROS, ainda não concluídos e que não sejam de recuperação
// — dias já feitos e dias de descanso ficam intactos.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateWorkoutPlan } from './geminiService';

const PLAN_KEY = 'workoutPlan';
const PLAN_CLASS_KEY = 'planClass'; // classe com que os treinos do plano foram gerados

export async function getPlanClass() {
  return AsyncStorage.getItem(PLAN_CLASS_KEY);
}

export async function setPlanClass(level) {
  if (level) await AsyncStorage.setItem(PLAN_CLASS_KEY, level);
}

// Um dia é regenerável se ainda não foi feito e não é de recuperação.
// Não filtramos por data: na app qualquer dia incompleto é treinável (basta
// tocar no cartão), mesmo que a data já tenha passado.
function isRegenerable(day) {
  return !day.completed && day.workout_type !== 'Recovery';
}

// Quantos dias seriam regerados (para decidir se vale a pena perguntar).
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

// Diagnóstico do plano — para perceber porque a regeneração não aparece.
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

// Regenera os dias elegíveis com o novo perfil (nova classe/carga).
// Devolve { changed } — quantos dias foram efetivamente substituídos.
export async function regenerateFuturePlan(profile) {
  const saved = await AsyncStorage.getItem(PLAN_KEY);
  if (!saved) return { changed: 0 };

  const plan = JSON.parse(saved);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const updated = [];
  let changed = 0;
  for (const day of plan) {
    if (isRegenerable(day)) {
      let workout = await generateWorkoutPlan(profile, day.day_number);
      if (!workout) {
        // provável rate-limit: espera e tenta uma segunda vez
        await sleep(5000);
        workout = await generateWorkoutPlan(profile, day.day_number);
      }
      if (workout) {
        // fixa o day_number/date do dia original — o Gemini devolve o seu próprio
        // day_number (muitas vezes o do exemplo, 1) e isso duplicava chaves.
        updated.push({ ...workout, day_number: day.day_number, date: day.date, completed: false });
        changed += 1;
        await sleep(1500); // espaça as chamadas para não bater no limite
        continue;
      }
    }
    updated.push(day); // falha da IA ou dia protegido -> mantém o original
  }

  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(updated));
  await AsyncStorage.setItem(PLAN_CLASS_KEY, profile.level);
  return { changed };
}
