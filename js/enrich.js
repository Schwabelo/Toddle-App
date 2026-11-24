// Pure helpers that get more out of the Toddle feed: safe HTML descriptions, resource links,
// MYP criteria, to-do vs class material, topic groups and stable class colours. No DOM, no storage.

// ---------- HTML ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, k) => {
    if (k[0] === '#') {
      const n = k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[k.toLowerCase()] ?? m;
  });
}

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeHref = (u) => (/^(https?:\/\/|mailto:)/i.test(String(u || '').trim()) ? String(u).trim() : '');

const KEEP = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a', 'blockquote']);
const AS_P = new Set(['div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article']);
const VOID = new Set(['br']);
const DROP_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'svg', 'math', 'template', 'noscript', 'title']);

/**
 * Whitelist sanitizer for the HTML that Toddle puts in X-ALT-DESC.
 * Keeps paragraphs, lists, bold/italic and https links; everything else becomes plain text.
 */
export function sanitizeHtml(html) {
  const src = String(html ?? '');
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  const stack = [];
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    out += escHtml(decodeEntities(src.slice(last, m.index)));
    last = re.lastIndex;
    if (!m[1]) continue; // comment
    let tag = m[1].toLowerCase();
    const closing = m[0][1] === '/';
    if (DROP_CONTENT.has(tag)) {
      if (!closing && !/\/>$/.test(m[0])) {
        const end = src.toLowerCase().indexOf(`</${tag}`, last);
        const stop = end < 0 ? src.length : src.indexOf('>', end) + 1 || src.length;
        re.lastIndex = last = stop;
      }
      continue;
    }
    if (AS_P.has(tag)) tag = 'p';
    if (!KEEP.has(tag)) continue;
    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at < 0) continue;
      while (stack.length > at) out += `</${stack.pop()}>`;
      continue;
    }
    if (VOID.has(tag)) { out += '<br>'; continue; }
    if (tag === 'a') {
      const h = m[2].match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = safeHref(decodeEntities(h ? h[1] ?? h[2] ?? h[3] : ''));
      if (!href) continue;
      out += `<a href="${escHtml(href)}" target="_blank" rel="noopener noreferrer">`;
    } else {
      if (tag === 'p') while (stack.includes('p')) out += `</${stack.pop()}>`; // no nested paragraphs
      out += `<${tag}>`;
    }
    stack.push(tag);
  }
  out += escHtml(decodeEntities(src.slice(last)));
  while (stack.length) out += `</${stack.pop()}>`;
  return out
    .replace(/<(p|li)>(\s|<br>)+/g, '<$1>')
    .replace(/(\s|<br>)+<\/(p|li)>/g, '</$2>')
    .replace(/<(p|li|b|strong|i|em|u)>(\s|<br>)*<\/\1>/g, '')
    .replace(/(<br>\s*){3,}/g, '<br><br>')
    .replace(/^(\s|<br>)+|(\s|<br>)+$/g, '')
    .trim();
}

// Plain text from sanitized HTML (for search and as a fallback), keeping paragraph breaks.
export function htmlToText(html) {
  return decodeEntities(
    String(html ?? '')
      .replace(/<br>/g, '\n')
      .replace(/<\/(p|li|blockquote|ul|ol)>/g, '\n')
      .replace(/<li>/g, '• ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Every link in a description: anchors (with their text) first, then bare URLs in the text.
export function extractLinks(html, text = '') {
  const out = [];
  const seen = new Set();
  const add = (href, label) => {
    const h = safeHref(href);
    if (!h || seen.has(h) || /share\.toddleapp\.com/.test(h)) return;
    seen.add(h);
    out.push({ href: h, text: label && label !== h ? label : '' });
  };
  for (const m of String(html ?? '').matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    add(decodeEntities(m[1]), decodeEntities(m[2].replace(/<[^>]+>/g, '')).trim());
  }
  for (const m of String(text ?? '').matchAll(/https?:\/\/[^\s<>"]+[^\s<>".,;:!?)]/g)) add(m[0], '');
  return out;
}

// ---------- resources ----------
const RESOURCES = [
  [/docs\.google\.com\/presentation/, 'slides', 'Slides'],
  [/docs\.google\.com\/document/, 'doc', 'Google Doc'],
  [/docs\.google\.com\/spreadsheets/, 'sheet', 'Sheet'],
  [/docs\.google\.com\/forms|forms\.gle/, 'form', 'Form'],
  [/drive\.google\.com/, 'drive', 'Drive file'],
  [/edpuzzle\.com/, 'video', 'Edpuzzle'],
  [/youtube\.com|youtu\.be|vimeo\.com/, 'video', 'Video'],
  [/ixl\.com/, 'practice', 'IXL'],
  [/quizlet\.com/, 'practice', 'Quizlet'],
  [/kahoot\.|blooket\.com|quizizz\.com|wayground\.com/, 'practice', 'Quiz game'],
  [/canva\.com/, 'design', 'Canva'],
  [/padlet\.com/, 'board', 'Padlet'],
  [/sharepoint\.com|onedrive\.live\.com|1drv\.ms/, 'drive', 'OneDrive file'],
];

export function resourceOf(link) {
  const href = typeof link === 'string' ? link : link.href;
  const text = typeof link === 'string' ? '' : link.text || '';
  for (const [re, kind, label] of RESOURCES) {
    if (re.test(href)) return { href, kind, label, text };
  }
  let host = '';
  try { host = new URL(href).hostname.replace(/^www\./, ''); } catch (e) { host = 'Link'; }
  return { href, kind: 'link', label: host, text };
}

// ---------- MYP criteria ----------
const LETTERS = '([A-D]{1,4}\\b(?:\\s*(?:,|&|and|\\/|\\+)\\s*[A-D]{1,4}\\b)*)';
const CRIT_PATTERNS = [
  new RegExp(`\\bcrit(?:erion|eria|\\.)?\\s*:?\\s*${LETTERS}`, 'i'),
  /^([A-D](?:\s*,\s*[A-D])+)\b/, // "B, C, D Industrial Revolution"
  /\b([A-D]{2,4})\s+(?:formative|summative|assessment|test)\b/i, // "Greenhouse Gases CD Formative"
  /^([A-D])\s*[-–:]\s/, // "A- Short Answer Test"
];

// MYP assessment criteria (A–D) mentioned in a title, e.g. "Crit B", "Criteria CD", "B, C, D Summative".
export function criteriaOf(title) {
  const t = String(title ?? '');
  for (const re of CRIT_PATTERNS) {
    const m = t.match(re);
    if (!m) continue;
    // The letters themselves must be upper case, even when the word "criterion" is not.
    const letters = [...new Set(m[1].replace(/\band\b/gi, ' ').match(/[A-D]/g) || [])];
    if (letters.length) return letters.sort();
  }
  return [];
}

// ---------- to-do vs class material ----------
export const isHomeworkTitle = (title) => /^🏠/.test(title) || /\b(home ?learning|homework|HML)\b/i.test(title);
const WORK_WORDS = /\b(checkpoint|workbook|journal|worksheet|quiz|test|questionnaire|reflection|draft|essay|submit|submission|hand ?in|complete|finish|fill (in|out)|presentation|project|practice|exercises?|investigation|research|plan(ning)?|analysis|analyse|write|writing|lab report|portfolio|self-assessment|form|check|create|crea|make)\b/i;
const WORK_LINKS = /edpuzzle\.com|ixl\.com|docs\.google\.com\/forms|forms\.gle|quizlet\.com|quizizz\.com|wayground\.com|kahoot\./;
const MATERIAL_WORDS = /\b(feedback|slides?|notes|videos?|recording|resources?|reading material|lesson materials?|agenda)\b/i;

/**
 * 'todo' for things you have to do, 'material' for class material (slides, videos, feedback).
 * Toddle's feed has no submission status, so this is a best guess the student can override per task.
 */
export function defaultKind(e) {
  if (e.kind !== 'task') return 'event';
  if (/Summative|Formative|Quick Task/.test(e.type)) return 'todo';
  const title = e.title || '';
  if (isHomeworkTitle(title)) return 'todo';
  if (MATERIAL_WORDS.test(title) && !/\b(checkpoint|quiz|test|form)\b/i.test(title)) return 'material';
  if (WORK_WORDS.test(title)) return 'todo';
  const links = (e.links || []).map((l) => l.href).join(' ') + ' ' + (e.description || '');
  if (WORK_LINKS.test(links)) return 'todo';
  if (/\b(please (complete|answer|fill|submit|do|write|finish)|complete (the|this|your)|submit|hand in|upload|due)\b/i.test(e.description || '')) return 'todo';
  return 'material';
}

// ---------- topics ----------
const STOP = new Set(('a an and or the of in on at to for with from by is are be your you our my this that these those it its into about ' +
  'lesson lessons homework hml home learning task tasks assessment assessments summative formative criterion criteria crit ' +
  'checkpoint finish complete practice part unit week day new more final class grade de la el en y los las del und der die das zum zur').split(' '));
const singular = (w) => (w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && /[^siu]s$/.test(w) ? w.slice(0, -1) : w);
const fold = (w) => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// [key, original word] pairs, so groups can be labelled the way the teacher wrote them.
const words = (title) =>
  String(title).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !/^[A-D]{1,4}$/.test(w) && !STOP.has(fold(w)))
    .map((w) => [singular(fold(w)), w]);

/**
 * Groups items whose titles share a word or two-word phrase (e.g. "Urbanization", "Short story").
 * Returns [{ key, label, items }] biggest first; items with nothing in common end up in "Other".
 */
export function topicGroups(items, titleOf = (x) => x.title) {
  const shown = new Map();
  const keysOf = items.map((it) => {
    const w = words(titleOf(it));
    const keys = new Set();
    const add = (k, orig) => { keys.add(k); if (!shown.has(k)) shown.set(k, orig); };
    w.forEach(([k, o]) => k.length >= 4 && add(k, o));
    for (let i = 0; i + 1 < w.length; i++) add(w[i][0] + ' ' + w[i + 1][0], w[i][1] + ' ' + w[i + 1][1]);
    return keys;
  });
  const count = new Map();
  keysOf.forEach((ks) => ks.forEach((k) => count.set(k, (count.get(k) || 0) + 1)));
  const groups = new Map();
  items.forEach((it, i) => {
    let best = '';
    for (const k of keysOf[i]) {
      const c = count.get(k);
      if (c < 2) continue;
      const b = count.get(best) || 0;
      if (c > b || (c === b && k.length > best.length)) best = k;
    }
    if (!groups.has(best)) groups.set(best, []);
    groups.get(best).push(it);
  });
  // A "group" of one is not a group.
  for (const [k, list] of [...groups]) {
    if (k && list.length < 2) {
      groups.delete(k);
      groups.set('', (groups.get('') || []).concat(list));
    }
  }
  const label = (k) => {
    if (!k) return 'Other';
    const o = shown.get(k) || k;
    return o === o.toUpperCase() ? o : o[0].toUpperCase() + o.slice(1);
  };
  return [...groups.entries()]
    .map(([key, list]) => ({ key, label: label(key), items: list }))
    .sort((a, b) => (a.key === '') - (b.key === '') || b.items.length - a.items.length || a.label.localeCompare(b.label));
}

// ---------- colours ----------
// Toddle's decorative colours (500 and 400 steps), so class colours sit well next to its red.
export const PALETTE = ['#6a6af5', '#ef4371', '#e8653a', '#00ac8a', '#00b0c2', '#d67d00', '#b646ee', '#6d9c00', '#008392', '#cd3769', '#5a5ae2', '#ca4f25'];

/**
 * Gives every class a colour once and keeps it: existing choices never change,
 * new classes take the first unused palette colour (in name order).
 */
export function assignColors(names, existing = {}) {
  const out = { ...existing };
  const used = new Set(Object.values(out));
  let i = 0;
  for (const n of [...names].sort((a, b) => a.localeCompare(b))) {
    if (out[n]) continue;
    const free = PALETTE.find((c) => !used.has(c));
    out[n] = free || PALETTE[i++ % PALETTE.length];
    used.add(out[n]);
  }
  return out;
}

// Most frequent "Created By" per class: the class teacher, as far as the feed can tell.
export function teachersByClass(events) {
  const counts = {};
  for (const e of events) {
    if (e.kind !== 'task' || !e.createdBy) continue;
    for (const c of e.classes) {
      counts[c] ||= {};
      counts[c][e.createdBy] = (counts[c][e.createdBy] || 0) + 1;
    }
  }
  const out = {};
  for (const [c, m] of Object.entries(counts)) out[c] = Object.entries(m).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  return out;
}
