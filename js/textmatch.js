// Pure text helpers for flashcards: checking typed answers and parsing pasted card lists.

// Lowercase, strip accents and punctuation, collapse spaces, so "Café!" matches "cafe".
export function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lev(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// 'correct' | 'almost' | 'wrong'. Alternatives may be separated by / or ;, and (bracketed notes) are optional.
export function judge(given, answer) {
  const g = norm(given);
  if (!g) return 'wrong';
  const options = new Set(
    [answer, answer.replace(/\([^)]*\)/g, ' '), ...answer.split(/\s*[/;]\s*/)].map(norm).filter(Boolean)
  );
  if (options.has(g)) return 'correct';
  for (const o of options) {
    if (/^\d+$/.test(o)) continue; // a wrong number is just wrong
    const allowed = o.length >= 12 ? 2 : o.length >= 5 ? 1 : 0;
    if (allowed && lev(g, o) <= allowed) return 'almost';
  }
  return 'wrong';
}

const PATTERNS = {
  tab: /\t/,
  dcolon: /\s*::\s*/,
  semi: /\s*;\s*/,
  dash: /\s+[-–—]\s+/,
  equals: /\s+=\s+/,
  comma: /\s*,\s*/,
  colon: /\s*:\s*/,
};
const AUTO_ORDER = ['tab', 'dcolon', 'semi', 'dash', 'equals', 'comma'];

export function splitLine(line, sep = 'auto') {
  for (const key of sep === 'auto' ? AUTO_ORDER : [sep]) {
    const m = PATTERNS[key] && line.match(PATTERNS[key]);
    if (!m) continue;
    const front = line.slice(0, m.index).trim();
    const back = line.slice(m.index + m[0].length).trim();
    if (front && back) return { front, back };
  }
  return null;
}

export function parseBulk(text, sep = 'auto') {
  const cards = [];
  let skipped = 0;
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const card = splitLine(line, sep);
    if (card) cards.push(card);
    else skipped++;
  }
  return { cards, skipped };
}
