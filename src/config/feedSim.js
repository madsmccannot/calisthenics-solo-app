// Simulated "other people" activity for the Feed. Generated locally (the app is
// solo/offline) and deterministically from the day, so it's stable during the
// day and changes day to day — giving a sense of life. Only used as a fallback
// when there's no Supabase backend (feed.js uses the real feed_events otherwise).

const NAMES = [
  'João', 'Ana', 'Lucas', 'Beatriz', 'Miguel', 'Sofia', 'Rafael', 'Carolina',
  'Tiago', 'Inês', 'Diogo', 'Mariana', 'Pedro', 'Rita', 'André', 'Catarina',
  'Bruno', 'Marta', 'Gonçalo', 'Leonor',
];

const TEMPLATES = [
  (n, r) => ({ emoji: '💪', title: `${n} completed Day ${5 + Math.floor(r() * 85)}` }),
  (n, r) => ({ emoji: '🔥', title: `${n} — ${[7, 14, 21, 30, 50][Math.floor(r() * 5)]} days in a row` }),
  (n, r) => ({ emoji: '⭐', title: `${n} reached level ${2 + Math.floor(r() * 40)}` }),
  (n, r) => ({ emoji: '🏆', title: `${n} completed Season ${1 + Math.floor(r() * 5)}` }),
  (n, r) => ({ emoji: '✊', title: `${n} set a record: ${50 + Math.floor(r() * 150)} push-ups` }),
  (n, r) => ({ emoji: '🥇', title: `${n} unlocked "${['30 Workouts', '1000 Push-ups', '30 Days Without Missing', 'Athlete'][Math.floor(r() * 4)]}"` }),
  (n, r) => ({ emoji: '📉', title: `${n} lost ${1 + Math.floor(r() * 6)}kg` }),
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministic PRNG (mulberry32).
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

// ~18 simulated events, with timestamps in the last ~72h.
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
