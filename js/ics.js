// Parses a Toddle calendar feed (.ics) into plain assignment objects.
import { addDays } from './util.js';
import { sanitizeHtml, htmlToText, extractLinks } from './enrich.js';

const FIELD_RE = /^(Task Type|Classes|Description|Created By|View Task|Event Type|Location): ?(.*)$/;

function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

// RFC 5545 text unescape, plus cleanup for Toddle's double-escaped quotes/newlines.
function unescapeText(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const n = s[++i];
      out += n === 'n' || n === 'N' ? '\n' : n;
    } else {
      out += c;
    }
  }
  return out;
}

function cleanTitle(s) {
  return unescapeText(s)
    .replace(/\\"/g, '"')
    .replace(/\\[ntr]/g, ' ') // Toddle double-escapes pasted tabs and newlines ("HML: \\tIXL")
    .replace(/\t/g, ' ')
    .replace(/\\+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value, params) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/);
  if (!m) return null;
  const allDay = /VALUE=DATE(?!-)/.test(params) || m[4] === undefined;
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    time: allDay ? null : `${m[4]}:${m[5]}`,
    allDay,
    tz: (params.match(/TZID=([^;:]+)/) || [])[1] || null,
  };
}

export function splitClasses(raw) {
  if (!raw) return [];
  return raw.split(/(?<=\))\s*,\s*/).map((s) => s.trim()).filter(Boolean);
}

export function parseFields(description) {
  const fields = {};
  let key = null;
  for (const line of unescapeText(description).split('\n')) {
    const m = line.match(FIELD_RE);
    if (m) {
      key = m[1];
      fields[key] = m[2];
    } else if (key && line.trim()) {
      fields[key] += '\n' + line;
    }
  }
  for (const k of Object.keys(fields)) fields[k] = fields[k].trim();
  return fields;
}

// The description part of Toddle's HTML version (X-ALT-DESC), which keeps links and paragraphs.
const HTML_FIELDS = 'Task Type|Classes|Created By|View Task|Event Type|Location';
export function htmlDescription(altDesc) {
  if (!altDesc) return '';
  const html = unescapeText(altDesc).replace(/\\"/g, '"').replace(/\\[tr]/g, ' ').replace(/\\n/g, '<br>');
  const m = html.match(new RegExp(`<b>\\s*Description\\s*</b>\\s*:?\\s*([\\s\\S]*?)(?:<br>\\s*<b>\\s*(?:${HTML_FIELDS})\\s*</b>|$)`));
  return m ? sanitizeHtml(m[1]) : '';
}

export function parseIcs(text) {
  const lines = unfold(text).split('\n');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const head = line.slice(0, idx);
    const [name, ...rest] = head.split(';');
    cur[name] = { value: line.slice(idx + 1), params: rest.join(';') };
  }

  const out = [];
  for (const e of events) {
    if (!e.UID || !e.DTSTART) continue;
    const start = parseDate(e.DTSTART.value, e.DTSTART.params);
    if (!start) continue;
    const end = e.DTEND ? parseDate(e.DTEND.value, e.DTEND.params) : null;
    const fields = parseFields(e.DESCRIPTION ? e.DESCRIPTION.value : '');
    const title = cleanTitle(e.SUMMARY ? e.SUMMARY.value : '(untitled)');
    const classes = splitClasses(fields.Classes);
    const html = htmlDescription(e['X-ALT-DESC'] && e['X-ALT-DESC'].value);
    const plain = (fields.Description || '').replace(/\\[ntr]/g, ' ');
    const description = html ? htmlToText(html) : plain;
    const isTask = Boolean(fields['Task Type']);
    // All-day DTEND is exclusive, so the last day is one before it.
    let endDate = end ? end.date : start.date;
    if (start.allDay && end && end.date > start.date) endDate = addDays(end.date, -1);
    out.push({
      uid: e.UID.value,
      title,
      date: start.date,
      time: start.time,
      endDate,
      endTime: end && !end.allDay ? end.time : null,
      allDay: start.allDay,
      tz: start.tz,
      kind: isTask ? 'task' : 'event',
      type: fields['Task Type'] || fields['Event Type'] || 'Event',
      classes,
      description,
      html,
      links: extractLinks(html, description),
      createdBy: fields['Created By'] || '',
      link: /^https:\/\/[\w.-]*toddleapp\.com\//.test(fields['View Task'] || '') ? fields['View Task'] : '',
      location: e.LOCATION ? unescapeText(e.LOCATION.value) : fields.Location || '',
    });
  }
  out.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  return out;
}
