import { clean, displayTitle, duration, statusOf } from './model.mjs';

export const palette = {
  active: { top: '#351319', bottom: '#1b1118', rim: '#ff6570', symbol: '›' },
  question: { top: '#4b3d0c', bottom: '#272109', rim: '#ffe45c', symbol: '?' },
  permission: { top: '#6034a0', bottom: '#281746', rim: '#ba8dff', symbol: '!' },
  attention: { top: '#317f4c', bottom: '#12472f', rim: '#72df91', symbol: '✓' },
  error: { top: '#bf6427', bottom: '#70311d', rim: '#ffab67', symbol: '×' },
  idle: { top: '#253444', bottom: '#141e2a', rim: '#50657b', symbol: '·' },
  offline: { top: '#30323a', bottom: '#252830', rim: '#727784', symbol: '⌁' },
};

function xml(value) {
  return String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[x]);
}

function shade(hex, fraction) {
  const channels = hex.slice(1).match(/../g).map(value => Math.round(parseInt(value, 16) * fraction));
  return `#${channels.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

const glyphs = ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/:._-!?(),&+[]';
const advances = [2.34,5.22,5.988,4.212,5.952,5.376,3.228,5.916,6.036,2.976,2.988,5.436,3,9.084,6.06,5.616,5.952,5.952,3.684,4.452,3.408,6.06,5.1,7.62,5.052,5.124,4.404,6.072,6.228,5.952,6.828,5.232,5.004,6.588,7.128,3.168,4.992,6.36,4.728,8.952,7.032,7.092,5.94,7.176,6.156,5.388,4.56,6.804,6.084,9.228,6.012,5.544,5.172,6,6,6,6,6,6,6,6,6,6,3.132,3.36,2.94,6,2.856,3.768,4.8,3.216,3.216,2.94,6.816,7.992,3.216,3.216];
const glyphWidth = new Map(Array.from(glyphs, (char, index) => [char, advances[index]]));
function textWidth(value, fontSize) {
  return Array.from(value).reduce((sum, char) => sum + (glyphWidth.get(char) ?? (char.codePointAt(0) > 127 ? 9 : 6)), 0) * fontSize / 12;
}

function wrapLines(value, fontSize, minimum) {
  const words = clean(value).replace(/([/_-])/g, '$1 ').split(/\s+/).filter(Boolean);
  const lines = [];
  const add = text => lines.push({ text, size: Math.min(fontSize, Math.round(12 * 59 / textWidth(text, 12) * 100) / 100) });
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, minimum) <= 59) { line = candidate; continue; }
    if (line) { add(line); line = ''; }
    if (textWidth(word, minimum) <= 59) { line = word; continue; }
    let chunk = '';
    for (const char of Array.from(word)) {
      if (chunk && textWidth(chunk + char, minimum) > 59) { add(chunk); chunk = ''; }
      chunk += char;
    }
    line = chunk;
  }
  if (line) add(line);
  for (let index = 0; index < lines.length - 1; index++) {
    const parts = lines[index].text.split(' ');
    const trailing = parts.at(-1)?.toLowerCase();
    if (parts.length < 2 || !['are', 'is', 'not', 'for'].includes(trailing)) continue;
    const next = `${parts.at(-1)} ${lines[index + 1].text}`;
    if (textWidth(next, minimum) > 59) continue;
    const current = parts.slice(0, -1).join(' ');
    lines[index] = { text: current, size: Math.min(fontSize, Math.round(12 * 59 / textWidth(current, 12) * 100) / 100) };
    lines[index + 1] = { text: next, size: Math.min(fontSize, Math.round(12 * 59 / textWidth(next, 12) * 100) / 100) };
  }
  return lines;
}

function pageLines(lines, frame, seconds, rows) {
  const page = Math.floor(frame / seconds) % Math.max(1, Math.ceil(lines.length / rows));
  return lines.slice(page * rows, page * rows + rows);
}

export function svgFor(agent, options = {}) {
  if (!agent && !options.offline) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><rect x="1.5" y="1.5" width="69" height="69" rx="5" fill="#101820" stroke="#273440" stroke-width="1"/></svg>';
  }
  const status = options.offline ? 'offline' : agent ? statusOf(agent) : 'idle';
  const base = palette[status];
  const custom = options.settings?.colors?.[status];
  const p = custom && /^#[0-9a-fA-F]{6}$/.test(custom) ? { ...base, top: shade(custom, 0.36), bottom: shade(custom, 0.17), rim: custom } : base;
  const font = options.settings?.fontSizes || {};
  const size = (value, fallback, maximum) => Number.isFinite(Number(value)) ? Math.max(6, Math.min(maximum, Number(value))) : fallback;
  const iconSize = size(font.icon, 18, 22);
  const timerSize = size(font.timer, 9, 12);
  const titleSize = size(font.title, 12, 16);
  const activitySize = size(font.activity, 8.4, 12);
  const frame = options.frame || 0;
  const title = displayTitle(agent?.title) || (options.offline ? 'Paseo offline' : 'Paseo');
  const activity = status === 'active' && options.activity
    ? options.activity
    : ({ active: 'Working', question: 'Question for you', permission: 'Approval needed', attention: 'Finished, review', error: 'Run failed', idle: 'Ready', offline: 'Disconnected' })[status];
  const started = agent?.activeTurn?.startedAt || options.startedAt;
  const ended = status === 'active' ? Date.now() : options.endedAt;
  const timer = started && ended ? duration(started, ended) : '';
  const border = options.pressed ? '#f1fbff' : p.rim;
  const stroke = options.pressed ? '2.6' : status === 'active' ? '2.3' : '1.5';
  const [titleLine1, titleLine2] = pageLines(wrapLines(title, titleSize, Math.min(titleSize, 9.5)), frame, 6, 2);
  const largeTitle = titleSize > 12;
  const activityRows = largeTitle || activitySize > 9.5 ? 1 : 2;
  const [activityLine1, activityLine2] = pageLines(wrapLines(activity, activitySize, Math.min(activitySize, 7.5)), frame, 8, activityRows);
  const hasSecondTitle = Boolean(titleLine2?.text);
  const hasSecondActivity = Boolean(activityLine2?.text);
  const titleY = largeTitle ? (hasSecondTitle ? [35, 50] : [40, 50]) : (hasSecondTitle ? [32, 43] : [39, 43]);
  const activityY = largeTitle ? [62] : hasSecondTitle ? (hasSecondActivity ? [54, 64] : [59]) : (hasSecondActivity ? [52, 63] : [57]);
  const face = 'Avenir Next Condensed, Arial Narrow, sans-serif';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
    <defs><linearGradient id="bg" x2="0" y2="1"><stop stop-color="${p.top}"/><stop offset="1" stop-color="${p.bottom}"/></linearGradient><clipPath id="copy"><rect x="5" y="21" width="61" height="47"/></clipPath></defs>
    <rect x="1.4" y="1.4" width="69.2" height="69.2" rx="5" fill="url(#bg)" stroke="${border}" stroke-width="${stroke}"/>
    <text x="6" y="22" fill="#fff" font-family="Arial, sans-serif" font-size="${iconSize}" font-weight="bold">${p.symbol}</text>
    ${timer ? `<text x="65" y="18" fill="#fff" text-anchor="end" font-family="Arial, sans-serif" font-size="${timerSize}" font-weight="bold">${xml(timer)}</text>` : ''}
    <g clip-path="url(#copy)"><text x="5" y="${titleY[0]}" fill="#fff" font-family="${face}" font-size="${titleLine1?.size || titleSize}" font-weight="600" font-kerning="normal">${xml(titleLine1?.text)}</text>
    <text x="5" y="${titleY[1]}" fill="#fff" font-family="${face}" font-size="${titleLine2?.size || titleSize}" font-weight="600" font-kerning="normal">${xml(titleLine2?.text)}</text>
    <text x="5" y="${activityY[0]}" fill="#fff" font-family="${face}" font-size="${activityLine1?.size || activitySize}" font-weight="600" font-kerning="normal">${xml(activityLine1?.text)}</text>
    ${activityY[1] ? `<text x="5" y="${activityY[1]}" fill="#fff" font-family="${face}" font-size="${activityLine2?.size || activitySize}" font-weight="600" font-kerning="normal">${xml(activityLine2?.text)}</text>` : ''}</g>
  </svg>`;
}

export function imageFor(agent, options) {
  return `data:image/svg+xml;base64,${Buffer.from(svgFor(agent, options)).toString('base64')}`;
}
