import { mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { svgFor } from '../src/render.mjs';

const now = Date.now();
const samples = [
  [{ title: 'Build storefront', status: 'running', activeTurn: { startedAt: new Date(now - 8 * 60000 - 34 * 1000).toISOString() } }, 'Running tests'],
  [{ title: 'Review migration', status: 'idle', attentionReason: 'question' }, 'Question for you'],
  [{ title: 'Deploy staging', status: 'idle', pendingPermissions: [{}] }, 'Approval needed'],
  [{ title: 'Fix checkout', status: 'error' }, 'Run failed'],
  [{ title: 'Publish docs', status: 'idle', requiresAttention: true }, 'Finished, review'],
  [{ title: 'Update homepage', status: 'running', activeTurn: { startedAt: new Date(now - 3 * 60000 - 12 * 1000).toISOString() } }, 'Editing layout'],
  [{ title: 'Audit analytics', status: 'idle' }, 'Ready'],
  [{ title: 'Write proposal', status: 'running', activeTurn: { startedAt: new Date(now - 15 * 60000 - 9 * 1000).toISOString() } }, 'Drafting summary'],
  [{ title: 'Check backup', status: 'idle', attentionReason: 'question' }, 'Choose a path'],
  [{ title: 'Import content', status: 'idle', requiresAttention: true }, 'Finished, review'],
  [{ title: 'Release build', status: 'error' }, 'Run failed'],
  [{ title: 'Optimize images', status: 'running', activeTurn: { startedAt: new Date(now - 1 * 60000 - 42 * 1000).toISOString() } }, 'Processing images'],
  [{ title: 'Client review', status: 'idle', pendingPermissions: [{}] }, 'Approval needed'],
  [{ title: 'Sync assets', status: 'idle' }, 'Ready'],
  [null, ''],
];

const keys = samples.map(([agent, activity], index) => {
  const svg = svgFor(agent, { activity, frame: 0, offline: index === 14 });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return `<div class="key"><img src="${src}" alt="${agent?.title || 'Offline source'}"></div>`;
}).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Paseo Deck mock status display</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 15%,#263849,#101822 62%,#0a1018);color:#e9f0f8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:1040px;padding:40px 50px 44px}header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:30px}h1{font-size:34px;letter-spacing:-.03em;margin:0 0 5px}p{font-size:15px;color:#9eb0c4;margin:0}.badge{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#96acc1;border:1px solid #415367;border-radius:100px;padding:10px 15px}.deck{width:720px;margin:auto;padding:38px 43px 42px;background:linear-gradient(150deg,#363b43,#171b21 52%,#242a32);border:4px solid #515a65;border-radius:38px;box-shadow:0 35px 80px #0009,inset 0 3px 8px #ffffff1c,inset 0 -12px 25px #0007;display:grid;grid-template-columns:repeat(5,1fr);gap:20px}.key{width:110px;height:110px;border:4px solid #0d1218;border-radius:13px;box-shadow:0 3px 2px #000,inset 0 0 0 2px #ffffff25;overflow:hidden;background:#0c1118}.key img{width:100%;height:100%;display:block}.legend{display:flex;justify-content:center;gap:22px;margin-top:30px;font-size:12px;color:#b6c4d2}.legend span{display:flex;align-items:center;gap:7px}.dot{width:9px;height:9px;border-radius:50%}
</style></head><body><div class="wrap"><header><div><h1>Paseo Deck</h1><p>Live agent status across 15 keys. Illustrative data.</p></div><div class="badge">15-key preview</div></header><div class="deck">${keys}</div><div class="legend"><span><i class="dot" style="background:#ff6570"></i>Running</span><span><i class="dot" style="background:#ffe45c"></i>Question</span><span><i class="dot" style="background:#ba8dff"></i>Approval</span><span><i class="dot" style="background:#72df91"></i>Finished</span><span><i class="dot" style="background:#ffab67"></i>Failed</span></div></div></body></html>`;

await mkdir('docs', { recursive: true });
await writeFile('docs/mockup.html', html);

const tileSvg = samples.map(([agent, activity], index) => {
  const x = 250 + (index % 5) * 124;
  const y = 225 + Math.floor(index / 5) * 124;
  const svg = svgFor(agent, { activity, frame: 0, offline: index === 14 });
  return `<rect x="${x - 5}" y="${y - 5}" width="118" height="118" rx="13" fill="#0a0e13" stroke="#525b66" stroke-width="3"/>
  <g transform="translate(${x} ${y}) scale(1.5)">${svg}</g>`;
}).join('');

const legend = [
  ['Running', '#ff6570'], ['Question', '#ffe45c'], ['Approval', '#ba8dff'],
  ['Finished', '#72df91'], ['Failed', '#ffab67'],
].map(([label, color], index) => {
  const x = 290 + index * 132;
  return `<circle cx="${x}" cy="694" r="5" fill="${color}"/><text x="${x + 12}" y="699" fill="#b6c4d2" font-family="Arial,sans-serif" font-size="14">${label}</text>`;
}).join('');

const composition = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="900" viewBox="0 0 1120 900">
  <defs><radialGradient id="page"><stop stop-color="#263849"/><stop offset="1" stop-color="#0a1018"/></radialGradient><linearGradient id="case" x2="1" y2="1"><stop stop-color="#3a4049"/><stop offset=".5" stop-color="#1a1f26"/><stop offset="1" stop-color="#282e37"/></linearGradient></defs>
  <rect width="1120" height="900" fill="url(#page)"/>
  <text x="100" y="108" fill="#e9f0f8" font-family="Arial,sans-serif" font-size="42" font-weight="bold">Paseo Deck</text>
  <text x="100" y="140" fill="#9eb0c4" font-family="Arial,sans-serif" font-size="18">Live agent status across 15 keys. Illustrative data.</text>
  <rect x="850" y="90" width="170" height="36" rx="18" fill="none" stroke="#415367"/>
  <text x="875" y="113" fill="#96acc1" font-family="Arial,sans-serif" font-size="14" letter-spacing="2">15-KEY PREVIEW</text>
  <rect x="197" y="171" width="730" height="433" rx="38" fill="#000000" opacity=".3"/>
  <rect x="195" y="164" width="730" height="433" rx="38" fill="url(#case)" stroke="#55606c" stroke-width="5"/>
  ${tileSvg}
  ${legend}
</svg>`;

const cleanComposition = composition.replace(/[ \t]+$/gm, '');
await writeFile('docs/mockup.svg', cleanComposition);
await writeFile('docs/mockup.png', new Resvg(cleanComposition).render().asPng());
