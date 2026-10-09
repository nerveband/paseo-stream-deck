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
function textWidth(value, fontSize, tracking = 0, factor = 1) {
  const characters = Array.from(value);
  return characters.reduce((sum, char) => sum + (glyphWidth.get(char) ?? (char.codePointAt(0) > 127 ? 9 : 6)), 0) * fontSize * factor / 12
    + Math.max(0, characters.length - 1) * tracking;
}

function wrapLines(value, fontSize, minimum, tracking = 0, factor = 1) {
  const words = clean(value).replace(/([/_-])/g, '$1 ').split(/\s+/).filter(Boolean);
  const lines = [];
  const add = text => lines.push({ text, size: Math.min(fontSize, Math.round(12 * (59 - Math.max(0, Array.from(text).length - 1) * tracking) / (textWidth(text, 12, 0, factor)) * 100) / 100) });
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, minimum, tracking, factor) <= 59) { line = candidate; continue; }
    if (line) { add(line); line = ''; }
    if (textWidth(word, minimum, tracking, factor) <= 59) { line = word; continue; }
    let chunk = '';
    for (const char of Array.from(word)) {
      if (chunk && textWidth(chunk + char, minimum, tracking, factor) > 59) { add(chunk); chunk = ''; }
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
    if (textWidth(next, minimum, tracking, factor) > 59) continue;
    const current = parts.slice(0, -1).join(' ');
    lines[index] = { text: current, size: Math.min(fontSize, Math.round(12 * (59 - Math.max(0, Array.from(current).length - 1) * tracking) / textWidth(current, 12, 0, factor) * 100) / 100) };
    lines[index + 1] = { text: next, size: Math.min(fontSize, Math.round(12 * (59 - Math.max(0, Array.from(next).length - 1) * tracking) / textWidth(next, 12, 0, factor) * 100) / 100) };
  }
  return lines;
}

function pageLines(lines, page, rows) { return lines.slice(page * rows, page * rows + rows); }

function pagination(page, count, position) {
  if (count < 2 || position === 'off') return '';
  if (position === 'right') {
    const height = 27;
    const thumb = Math.max(5, height / count);
    const y = 27 + page * (height - thumb) / (count - 1);
    return `<rect x="66.2" y="27" width="2" height="${height}" rx="1" fill="#fff" opacity="0.2"/><rect x="66.2" y="${y.toFixed(2)}" width="2" height="${thumb.toFixed(2)}" rx="1" fill="#fff" opacity="0.95"/>`;
  }
  const x = position === 'bottom-left' ? 6 : 46;
  const width = 20;
  const thumb = Math.max(4, width / count);
  const left = x + page * (width - thumb) / (count - 1);
  return `<rect x="${x}" y="66" width="${width}" height="2" rx="1" fill="#fff" opacity="0.2"/><rect x="${left.toFixed(2)}" y="66" width="${thumb.toFixed(2)}" height="2" rx="1" fill="#fff" opacity="0.95"/>`;
}

function workspaceAccent(agent) {
  if (!agent || !(agent.tabCount > 1)) return '';
  const colors = ['#75c7d7', '#a6a0e8', '#d6a86b', '#9ec985', '#d18fad', '#79aee3'];
  const group = String(agent.workspaceId || agent.deckTitle || 'workspace');
  let hash = 0;
  for (const character of group) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `<line x1="7" y1="68" x2="65" y2="68" stroke="${colors[hash % colors.length]}" stroke-width="1.5" opacity="0.85"/>`;
}

function spinner(phase) {
  const spokes = Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    const x1 = (Math.cos(angle) * 5).toFixed(2);
    const y1 = (Math.sin(angle) * 5).toFixed(2);
    const x2 = (Math.cos(angle) * 8).toFixed(2);
    const y2 = (Math.sin(angle) * 8).toFixed(2);
    const distance = (index - phase + 8) % 8;
    const opacity = (1 - distance * 0.11).toFixed(2);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="${opacity}"/>`;
  }).join('');
  return `<g transform="translate(14 14)">${spokes}</g>`;
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
  const typography = options.settings?.typography || {};
  const family = ({ avenir: 'Avenir Next Condensed, Arial Narrow, sans-serif', arial: 'Arial Narrow, Avenir Next Condensed, sans-serif', din: 'DIN Condensed, Avenir Next Condensed, sans-serif' })[typography.family] || 'Avenir Next Condensed, Arial Narrow, sans-serif';
  const familyFactor = ({ avenir: 1, arial: 1.1, din: 1 })[typography.family] || 1;
  const titleWeight = ['500', '600', '700'].includes(typography.titleWeight) ? typography.titleWeight : '600';
  const statusWeight = ['500', '600', '700'].includes(typography.statusWeight) ? typography.statusWeight : '700';
  const titleTracking = Number.isFinite(Number(typography.titleTracking)) ? Math.max(0, Math.min(0.8, Number(typography.titleTracking))) : 0;
  const statusTracking = Number.isFinite(Number(typography.statusTracking)) ? Math.max(0, Math.min(1, Number(typography.statusTracking))) : 0.25;
  const size = (value, fallback, maximum) => Number.isFinite(Number(value)) ? Math.max(6, Math.min(maximum, Number(value))) : fallback;
  const iconSize = size(font.icon, 18, 22);
  const timerSize = size(font.timer, 9, 12);
  const titleSize = size(font.title, 12, 16);
  const activitySize = size(font.activity, 8.4, 12);
  const frame = options.frame || 0;
  const title = displayTitle(agent?.tabCount > 1 ? (agent?.title || agent?.deckTitle) : (agent?.deckTitle || agent?.title)) || (options.offline ? 'Paseo offline' : 'Paseo');
  const activity = status === 'active' ? 'WORKING…' :
    ({ question: 'QUESTION FOR YOU', permission: 'APPROVAL NEEDED', attention: 'FINISHED, REVIEW', error: 'RUN FAILED', idle: 'READY', offline: 'DISCONNECTED' })[status];
  const started = agent?.activeTurn?.startedAt || options.startedAt;
  const ended = status === 'active' ? Date.now() : options.endedAt;
  const timer = started && ended ? duration(started, ended) : '';
  const border = options.pressed ? '#f1fbff' : p.rim;
  const stroke = options.pressed ? '2.6' : status === 'active' ? '2.3' : '1.5';
  const titleLines = wrapLines(title, titleSize, Math.min(titleSize, 9.5), titleTracking, familyFactor);
  const largeTitle = titleSize > 12;
  const activityRows = largeTitle || activitySize > 9.5 ? 1 : 2;
  const activityLines = wrapLines(activity, activitySize, Math.min(activitySize, 7.5), statusTracking, familyFactor);
  const titlePages = Math.max(1, Math.ceil(titleLines.length / 2));
  const activityPages = Math.max(1, Math.ceil(activityLines.length / activityRows));
  const pageCount = status === 'active' ? 1 : Math.max(titlePages, activityPages);
  const page = status === 'active' ? 0 : Math.floor(frame / 10) % pageCount;
  const [titleLine1, titleLine2] = pageLines(titleLines, page % titlePages, 2);
  const [activityLine1, activityLine2] = pageLines(activityLines, page % activityPages, activityRows);
  const pageTitleSize = Math.min(...[titleLine1, titleLine2].filter(Boolean).map(line => line.size));
  const pageActivitySize = Math.min(...[activityLine1, activityLine2].filter(Boolean).map(line => line.size));
  const hasSecondTitle = Boolean(titleLine2?.text);
  const hasSecondActivity = Boolean(activityLine2?.text);
  const titleY = largeTitle ? (hasSecondTitle ? [35, 50] : [40, 50]) : (hasSecondTitle ? [32, 43] : [39, 43]);
  const activityY = largeTitle ? [62] : hasSecondTitle ? (hasSecondActivity ? [54, 64] : [59]) : (hasSecondActivity ? [52, 63] : [57]);
  const pagePosition = ['right', 'bottom-right', 'bottom-left', 'off'].includes(options.settings?.paginationPosition) ? options.settings.paginationPosition : 'right';
  const face = family;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
    <defs><linearGradient id="bg" x2="0" y2="1"><stop stop-color="${p.top}"/><stop offset="1" stop-color="${p.bottom}"/></linearGradient><clipPath id="copy"><rect x="5" y="21" width="61" height="47"/></clipPath></defs>
    <rect x="1.4" y="1.4" width="69.2" height="69.2" rx="5" fill="url(#bg)" stroke="${border}" stroke-width="${stroke}"/>
    ${status === 'active' ? spinner(Math.floor(options.spinnerPhase || 0) % 8) : `<text x="6" y="22" fill="#fff" font-family="Arial, sans-serif" font-size="${iconSize}" font-weight="bold">${p.symbol}</text>`}
    ${agent?.tabCount > 1 ? `<text x="32" y="18" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif" font-size="7.5" font-weight="bold" opacity="0.85">${agent.tabIndex}/${agent.tabCount}</text>` : ''}
    ${timer ? `<text x="65" y="18" fill="#fff" text-anchor="end" font-family="Arial, sans-serif" font-size="${timerSize}" font-weight="bold">${xml(timer)}</text>` : ''}
    <g clip-path="url(#copy)"><text x="5" y="${titleY[0]}" fill="#fff" font-family="${face}" font-size="${pageTitleSize}" font-weight="${titleWeight}" letter-spacing="${titleTracking}" font-kerning="normal">${xml(titleLine1?.text)}</text>
    <text x="5" y="${titleY[1]}" fill="#fff" font-family="${face}" font-size="${pageTitleSize}" font-weight="${titleWeight}" letter-spacing="${titleTracking}" font-kerning="normal">${xml(titleLine2?.text)}</text>
    ${!largeTitle ? '<line x1="5" y1="47" x2="61" y2="47" stroke="#fff" stroke-width="0.7" opacity="0.23"/>' : ''}
    <text x="5" y="${activityY[0]}" fill="#fff" font-family="${face}" font-size="${pageActivitySize}" font-weight="${statusWeight}" letter-spacing="${statusTracking}" font-kerning="normal">${xml(activityLine1?.text)}</text>
    ${activityY[1] ? `<text x="5" y="${activityY[1]}" fill="#fff" font-family="${face}" font-size="${pageActivitySize}" font-weight="${statusWeight}" letter-spacing="${statusTracking}" font-kerning="normal">${xml(activityLine2?.text)}</text>` : ''}</g>
    ${workspaceAccent(agent)}
    <g data-page="${page}" data-page-count="${pageCount}" data-page-position="${pagePosition}">${pagination(page, pageCount, pagePosition)}</g>
  </svg>`;
}

export function crossfadeSvg(from, to, progress) {
  const inside = (svg, suffix) => svg
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    .replaceAll('id="bg"', `id="bg-${suffix}"`).replaceAll('url(#bg)', `url(#bg-${suffix})`)
    .replaceAll('id="copy"', `id="copy-${suffix}"`).replaceAll('url(#copy)', `url(#copy-${suffix})`);
  const value = Math.max(0, Math.min(1, progress));
  const eased = 1 - (1 - value) ** 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><g opacity="${(1 - eased).toFixed(3)}">${inside(from, 'old')}</g><g opacity="${eased.toFixed(3)}">${inside(to, 'new')}</g></svg>`;
}

export function pageTransitionSvg(from, to, progress) {
  const marker = /<g data-page="([\d.]+)" data-page-count="(\d+)" data-page-position="([^"]+)">[\s\S]*?<\/g>/;
  const previous = from.match(marker);
  const next = to.match(marker);
  const strip = svg => svg.replace(marker, '');
  const value = Math.max(0, Math.min(1, progress));
  const eased = value * value * (3 - 2 * value);
  const blended = crossfadeSvg(strip(from), strip(to), value);
  if (!previous || !next || next[3] === 'off') return blended;
  const page = Number(previous[1]) + (Number(next[1]) - Number(previous[1])) * eased;
  return blended.replace('</svg>', `<g>${pagination(page, Number(next[2]), next[3])}</g></svg>`);
}

export function imageFor(agent, options) {
  return `data:image/svg+xml;base64,${Buffer.from(svgFor(agent, options)).toString('base64')}`;
}

export function navigationSvg(kind, page, count, pressed = false) {
  const enabled = kind === 'page' || (kind === 'up' ? page > 0 : page < count - 1);
  const symbol = kind === 'up' ? '<path d="M24 39 L36 27 L48 39"/>' : '<path d="M24 28 L36 40 L48 28"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
    <rect x="1.4" y="1.4" width="69.2" height="69.2" rx="5" fill="#141e2a" stroke="${pressed ? '#77b7ff' : '#50657b'}" stroke-width="${pressed ? 3 : 1.5}"/>
    ${kind === 'page' ? `<text x="36" y="40" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="22" font-weight="bold">${page + 1}/${count}</text>` : `<g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="${enabled ? 1 : 0.2}">${symbol}</g>`}
    <text x="36" y="59" text-anchor="middle" fill="#b7c6d7" font-family="Arial, sans-serif" font-size="8" letter-spacing="0.8">${kind === 'page' ? 'PAGE' : kind === 'up' ? 'PREVIOUS' : 'NEXT'}</text>
  </svg>`;
}
