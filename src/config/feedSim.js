// Atividade simulada de "outras pessoas" para o Feed. É gerada localmente
// (a app é solo/offline) e de forma determinística a partir do dia, por isso
// fica estável durante o dia e muda de dia para dia — dá sensação de vida.
//
// FUTURO/ONLINE: quando houver componente online, substituir generateOthersFeed
// por um fetch real. É o único ponto a trocar — o resto do Feed já mistura
// "próprio + outros" da mesma forma. Ver src/services/feed.js.

const NAMES = [
  'João', 'Ana', 'Lucas', 'Beatriz', 'Miguel', 'Sofia', 'Rafael', 'Carolina',
  'Tiago', 'Inês', 'Diogo', 'Mariana', 'Pedro', 'Rita', 'André', 'Catarina',
  'Bruno', 'Marta', 'Gonçalo', 'Leonor',
];

const TEMPLATES = [
  (n, r) => ({ emoji: '💪', title: `${n} completou o Dia ${5 + Math.floor(r() * 85)}` }),
  (n, r) => ({ emoji: '🔥', title: `${n} — ${[7, 14, 21, 30, 50][Math.floor(r() * 5)]} dias seguidos` }),
  (n, r) => ({ emoji: '⭐', title: `${n} chegou ao nível ${2 + Math.floor(r() * 40)}` }),
  (n, r) => ({ emoji: '🏆', title: `${n} completou a Season ${1 + Math.floor(r() * 5)}` }),
  (n, r) => ({ emoji: '✊', title: `${n} bateu recorde: ${50 + Math.floor(r() * 150)} flexões` }),
  (n, r) => ({ emoji: '🥇', title: `${n} desbloqueou "${['30 Treinos', '1000 Flexões', '30 Dias Sem Faltar', 'Atleta'][Math.floor(r() * 4)]}"` }),
  (n, r) => ({ emoji: '📉', title: `${n} perdeu ${1 + Math.floor(r() * 6)}kg` }),
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// PRNG determinístico (mulberry32).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ~18 eventos simulados, com timestamps nas últimas ~72h.
export function generateOthersFeed(now = Date.now()) {
  const seed = hashStr(new Date(now).toDateString());
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < 18; i++) {
    const name = NAMES[Math.floor(rnd() * NAMES.length)];
    const tpl = TEMPLATES[Math.floor(rnd() * TEMPLATES.length)];
    const ev = tpl(name, rnd);
    const ts = now - Math.floor(rnd() * 72 * 3600 * 1000) - 60000;
    out.push({ id: `sim-${seed}-${i}`, ts, who: 'other', name, emoji: ev.emoji, title: ev.title });
  }
  return out;
}
