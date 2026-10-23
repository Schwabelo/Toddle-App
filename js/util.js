// Small shared helpers: escaping, local-date math, formatting.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const parseYmd = (s) => new Date(s + 'T12:00:00');

export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export const diffDays = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 864e5);

export function fmtDate(s, opts) {
  return parseYmd(s).toLocaleDateString('en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtTime(t, h24) {
  if (!t) return '';
  if (h24) return t;
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
}

export function relDay(s) {
  const d = diffDays(s, today());
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d > 1) return `in ${d} days`;
  return `${-d} days ago`;
}

export function linkify(text) {
  return esc(text).replace(
    /https?:\/\/[^\s<]+[^\s<.,;:!?)]/g,
    (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`
  );
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Teachers prefix titles with emoji (🏠, ✏️). The type tag already says it, so drop them for display.
export const displayTitle = (t) => t.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '') || t;
