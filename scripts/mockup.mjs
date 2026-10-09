import { mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { svgFor, crossfadeSvg, pageTransitionSvg, navigationSvg } from '../src/render.mjs';
import { agentIndexForSlot, AGENTS_PER_PAGE } from '../src/model.mjs';

const now = Date.now();
const samples = [
  [{ title: 'Build storefront', status: 'running', activeTurn: { startedAt: new Date(now - 8 * 60000 - 34 * 1000).toISOString() } }, 'Running tests'],
  [{ title: 'i have tayseerseminary org for github', deckTitle: 'Plan repository migration', workspaceId: 'demo-plan', tabIndex: 1, tabCount: 2, status: 'idle', attentionReason: 'question' }, 'Question for you'],
  [{ title: 'Deploy staging', status: 'idle', pendingPermissions: [{}] }, 'Approval needed'],
  [{ title: 'Fix checkout', status: 'error' }, 'Run failed'],
  [{ title: 'Publish docs', status: 'idle', requiresAttention: true }, 'Finished, review'],
  [{ title: 'Update homepage', status: 'running', activeTurn: { startedAt: new Date(now - 3 * 60000 - 12 * 1000).toISOString() } }, 'Editing layout'],
  [{ title: 'Audit analytics', status: 'idle' }, 'Ready'],
  [{ title: 'Write proposal', status: 'running', activeTurn: { startedAt: new Date(now - 15 * 60000 - 9 * 1000).toISOString() } }, 'Drafting summary'],
  [{ title: 'give me a map repo', deckTitle: 'Plan repository migration', workspaceId: 'demo-plan', tabIndex: 2, tabCount: 2, status: 'idle', attentionReason: 'question' }, 'Question for you'],
  [{ title: 'Tell me that these errors are not for this', status: 'idle', requiresAttention: true }, 'Finished, review'],
  [{ title: 'Release build', status: 'error' }, 'Run failed'],
  [{ title: 'Optimize images', status: 'running', activeTurn: { startedAt: new Date(now - 1 * 60000 - 42 * 1000).toISOString() } }, 'Processing images'],
  [{ title: 'Client review', status: 'idle', pendingPermissions: [{}] }, 'Approval needed'],
  [{ title: 'Sync assets', status: 'idle' }, 'Ready'],
  [{ title: 'Paseo offline', status: 'idle', offline: true }, ''],
];
const deckPageCount = Math.ceil(samples.length / AGENTS_PER_PAGE);
const slotSample = (slot, page) => samples[agentIndexForSlot(slot, page)] || [null, ''];

function image(agent, activity, index, frame = 0, spinnerPhase = 0, deckPage = 0) {
  const svg = index % 5 === 4 ? navigationSvg(index === 4 ? 'up' : index === 9 ? 'page' : 'down', deckPage, deckPageCount) : svgFor(agent, { activity, frame, spinnerPhase, offline: agent?.offline });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
function imageTransition(agent, activity, index, fromFrame, toFrame, progress, deckPage) {
  if (index % 5 === 4) return image(agent, activity, index, 0, 0, deckPage);
  const from = svgFor(agent, { activity, frame: fromFrame, offline: agent?.offline });
  const to = svgFor(agent, { activity, frame: toFrame, offline: agent?.offline });
  return `data:image/svg+xml;base64,${Buffer.from(pageTransitionSvg(from, to, progress)).toString('base64')}`;
}
const deckPages = Array.from({length: deckPageCount}, (_, deckPage) => Array.from({length: 15}, (_, index) => {
  const [agent, activity] = slotSample(index, deckPage);
  return {
    first: Array.from({ length: 8 }, (_, phase) => image(agent, activity, index, 0, phase, deckPage)),
    second: image(agent, activity, index, 10, 0, deckPage),
    forward: Array.from({ length: 10 }, (_, step) => imageTransition(agent, activity, index, 0, 10, (step + 1) / 10, deckPage)),
    reverse: Array.from({ length: 10 }, (_, step) => imageTransition(agent, activity, index, 10, 0, (step + 1) / 10, deckPage)),
  };
}));
const previewFrames = deckPages[0];
const demoAgents = [
  samples[0][0],
  { title: 'Build storefront', status: 'idle', attentionReason: 'question' },
  { title: 'Build storefront', status: 'idle', pendingPermissions: [{}] },
  { title: 'Build storefront', status: 'idle', requiresAttention: true },
  { title: 'Build storefront', status: 'error' },
];
const demoImages = demoAgents.map(agent => Array.from({ length: 8 }, (_, phase) => image(agent, '', 0, 0, phase)));
const demoFades = demoAgents.map((agent, index) => Array.from({ length: 4 }, (_, step) => {
  const previous = svgFor(demoAgents[(index + demoAgents.length - 1) % demoAgents.length], { spinnerPhase: 0 });
  const next = svgFor(agent, { spinnerPhase: 0 });
  return `data:image/svg+xml;base64,${Buffer.from(crossfadeSvg(previous, next, (step + 1) / 4)).toString('base64')}`;
}));
const keys = Array.from({length: 15}, (_, index) =>
  `<div class="key" ${index === 4 ? 'onclick="turnPage(-1)"' : index === 14 ? 'onclick="turnPage(1)"' : ''}><img id="key-${index}" src="${previewFrames[index].first[0]}" alt="${index % 5 === 4 ? 'Page navigation' : slotSample(index, 0)[0]?.title || 'Empty key'}"></div>`
).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Paseo Deck mock status display</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 15%,#263849,#101822 62%,#0a1018);color:#e9f0f8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:1040px;padding:40px 50px 44px}header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:30px}h1{font-size:34px;letter-spacing:-.03em;margin:0 0 5px}p{font-size:15px;color:#9eb0c4;margin:0}.badge{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#96acc1;border:1px solid #415367;border-radius:100px;padding:10px 15px}.deck{width:720px;margin:auto;padding:38px 43px 42px;background:linear-gradient(150deg,#363b43,#171b21 52%,#242a32);border:4px solid #515a65;border-radius:38px;box-shadow:0 35px 80px #0009,inset 0 3px 8px #ffffff1c,inset 0 -12px 25px #0007;display:grid;grid-template-columns:repeat(5,1fr);gap:20px}.key{width:110px;height:110px;border:4px solid #0d1218;border-radius:13px;box-shadow:0 3px 2px #000,inset 0 0 0 2px #ffffff25;overflow:hidden;background:#0c1118}.key img{width:100%;height:100%;display:block}.legend{display:flex;justify-content:center;gap:22px;margin-top:30px;font-size:12px;color:#b6c4d2}.legend span{display:flex;align-items:center;gap:7px}.dot{width:9px;height:9px;border-radius:50%}
</style></head><body><div class="wrap"><header><div><h1>Paseo Deck</h1><p>Live agent status across 15 keys. Illustrative data.</p></div><div class="badge">15-key preview</div></header><div class="deck">${keys}</div><div class="legend"><span><i class="dot" style="background:#ff6570"></i>Running</span><span><i class="dot" style="background:#ffe45c"></i>Question</span><span><i class="dot" style="background:#ba8dff"></i>Approval</span><span><i class="dot" style="background:#72df91"></i>Finished</span><span><i class="dot" style="background:#ffab67"></i>Failed</span></div></div><script>
const deckPages = ${JSON.stringify(deckPages)};
let deckPage = 0;
function turnPage(direction) { deckPage = Math.max(0, Math.min(deckPages.length - 1, deckPage + direction)); tick(); }
const demo = ${JSON.stringify({ images: demoImages, fades: demoFades })};
let started = performance.now();
function tick() {
  const elapsed = performance.now() - started;
  const phase = Math.floor(elapsed / 120) % 8;
  const page = Math.floor(elapsed / 10000) % 2;
  const pageTime = elapsed % 10000;
  deckPages[deckPage].forEach((item, index) => {
    let next = page ? item.second : item.first[phase];
    if (elapsed >= 10000 && pageTime < 600) {
      const steps = page ? item.forward : item.reverse;
      next = steps[Math.min(9, Math.floor(pageTime / 60))];
    }
    if (index === 0 && deckPage === 0) {
      const stage = Math.floor(elapsed / 8000) % demo.images.length;
      const stageTime = elapsed % 8000;
      next = stageTime < 400 && elapsed > 400 ? demo.fades[stage][Math.min(3, Math.floor(stageTime / 100))] : demo.images[stage][phase];
    }
    const key = document.getElementById('key-' + index);
    if (key.src !== next) key.src = next;
  });
}
tick(); setInterval(tick, 60);
</script></body></html>`;

await mkdir('docs', { recursive: true });
await writeFile('docs/mockup.html', html);

const tileSvg = Array.from({length: 15}, (_, index) => {
  const [agent, activity] = slotSample(index, 0);
  const x = 250 + (index % 5) * 124;
  const y = 225 + Math.floor(index / 5) * 124;
  const svg = (index % 5 === 4 ? navigationSvg(index === 4 ? 'up' : index === 9 ? 'page' : 'down', 0, deckPageCount) : svgFor(agent, { activity, frame: 0, offline: agent?.offline }))
    .replaceAll('id="bg"', `id="bg-${index}"`).replaceAll('url(#bg)', `url(#bg-${index})`)
    .replaceAll('id="copy"', `id="copy-${index}"`).replaceAll('url(#copy)', `url(#copy-${index})`);
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
