import test from 'node:test';
import assert from 'node:assert/strict';
import { Resvg } from '@resvg/resvg-js';
import { svgFor, crossfadeSvg, pageTransitionSvg } from './render.mjs';
import { displayTitle } from './model.mjs';

test('URL titles use the host and remain readable in the key window', () => {
  assert.equal(displayTitle('https://www.example.com/docs'), 'example.com/docs');
  assert.equal(displayTitle('https://www.scribd.com/document/123456789/a-long-path'), 'scribd.com/document');
  const image = svgFor({ title: 'https://www.example.com/docs', status: 'running' });
  assert.ok(image.includes('example.com'));
  assert.ok(!image.includes('https://'));
});

test('single-tab workspace keys use the Paseo sidebar title', () => {
  const image = svgFor({ title: 'Tell me that these errors are not for this', deckTitle: 'Fix m1pro environment errors', status: 'running' });
  assert.match(image, /Fix m1pro/);
  assert.doesNotMatch(image, /Tell me that/);
});

test('multiple tabs use their own agent titles and a compact tab number', () => {
  const image = svgFor({ workspaceId: 'migration', deckTitle: 'Plan repository migration', title: 'give me a map repo', tabIndex: 2, tabCount: 2, status: 'idle' });
  assert.match(image, />2\/2<\/text>/);
  assert.match(image, /give me a/);
  assert.match(image, /repo<\/text>/);
  assert.doesNotMatch(image, /Plan repository/);
  const otherTab = svgFor({ workspaceId: 'migration', deckTitle: 'Plan repository migration', title: 'Review migration', tabIndex: 1, tabCount: 2, status: 'running' });
  assert.equal(image.match(/<line x1="7" y1="68"[^>]+>/)?.[0], otherTab.match(/<line x1="7" y1="68"[^>]+>/)?.[0]);
  assert.doesNotMatch(svgFor({ deckTitle: 'Single workspace', title: 'Prompt', status: 'idle' }), /<line x1="7" y1="68"/);
});

test('global colors and font sizes change the rendered key', () => {
  const image = svgFor({ title: 'Build', status: 'running' }, {
    settings: { colors: { active: '#123456' }, fontSizes: { title: 10 } },
  });
  assert.ok(image.includes('stroke="#123456"'));
  assert.ok(image.includes('stop-color="#06131f"'));
  assert.ok(image.includes('font-size="10"'));
});

test('long non-running titles use two readable lines and rotate through later words', () => {
  const agent = { title: 'Review the storefront migration', status: 'idle' };
  const first = svgFor(agent, { frame: 0, settings: { fontSizes: { title: 15 } } });
  const next = svgFor(agent, { frame: 10, settings: { fontSizes: { title: 15 } } });
  assert.match(first, /font-family="Avenir Next Condensed, Arial Narrow, sans-serif"/);
  assert.match(first, /y="35"[^>]*>Review the<\/text>/);
  assert.match(first, /y="50"[^>]*>storefront<\/text>/);
  assert.notEqual(first, next);
  assert.match(next, />migration<\/text>/);
  assert.match(first, /<rect x="5" y="21" width="61" height="47"/);
});

test('activity pages keep their reading order', () => {
  const agent = { title: 'Review', status: 'idle', requiresAttention: true };
  const first = svgFor(agent, { frame: 0 });
  const later = svgFor(agent, { frame: 8 });
  assert.ok(first.indexOf('FINISHED,') < first.indexOf('REVIEW'));
  assert.ok(later.indexOf('FINISHED,') < later.indexOf('REVIEW'));
});

test('title and activity fit natural phrases on one line', () => {
  const image = svgFor({ title: 'are not for this', status: 'idle', requiresAttention: true });
  assert.match(image, />are not for this<\/text>/);
  assert.match(image, />FINISHED, REVIEW<\/text>/);
  const longTitle = { title: 'Tell me that these errors are not for this', status: 'idle', requiresAttention: true };
  assert.match(svgFor(longTitle, { frame: 0 }), />Tell me that<\/text>/);
  assert.match(svgFor(longTitle, { frame: 10 }), />are not for this<\/text>/);
});

test('both visible title lines use one font size', () => {
  const image = svgFor({ title: 'i have tayseerseminary org for github', status: 'idle' });
  const sizes = [...image.matchAll(/<text x="5" y="(?:32|43)"[^>]*font-size="([\d.]+)"/g)].map(match => match[1]);
  assert.equal(sizes.length, 2);
  assert.equal(sizes[0], sizes[1]);
});

test('idle and disconnected keys do not claim to be using an old tool', () => {
  const agent = { title: 'Review', status: 'idle' };
  const idle = svgFor(agent, { activity: 'Using bash' });
  const offline = svgFor(agent, { activity: 'Using bash', offline: true });
  assert.ok(idle.includes('READY'));
  assert.ok(!idle.includes('Using bash'));
  assert.ok(offline.includes('DISCONNECTED'));
  assert.ok(!offline.includes('Using bash'));
});

test('unused slots stay visually quiet', () => {
  const empty = svgFor(null);
  assert.ok(empty.includes('fill="#101820"'));
  assert.ok(!empty.includes('READY'));
});

test('running keys keep their text still while the spinner moves', () => {
  const agent = { title: 'Review the storefront migration', status: 'running' };
  const first = svgFor(agent, { activity: 'Using bash', frame: 0, spinnerPhase: 0 });
  const later = svgFor(agent, { activity: 'Using bash', frame: 12, spinnerPhase: 0 });
  const spun = svgFor(agent, { activity: 'Using bash', frame: 12, spinnerPhase: 1 });
  assert.equal(first, later);
  assert.notEqual(later, spun);
  assert.match(first, /WORKING…/);
  assert.ok(!first.includes('Using bash'));
});

test('status crossfade is a renderable 72-pixel image', () => {
  const from = svgFor({ title: 'Review', status: 'running' });
  const to = svgFor({ title: 'Review', status: 'idle', attentionReason: 'question' });
  const halfway = crossfadeSvg(from, to, 0.5);
  assert.match(halfway, /id="bg-old"/);
  assert.match(halfway, /id="bg-new"/);
  assert.ok(new Resvg(halfway).render().asPng().length > 100);
});

test('page scrollbar shows the current page and honors position', () => {
  const agent = { title: 'Tell me that these errors are not for this', status: 'idle', requiresAttention: true };
  const first = svgFor(agent, { frame: 0 });
  const second = svgFor(agent, { frame: 10 });
  assert.match(first, /<rect x="66.2" y="27" width="2" height="27"/);
  assert.match(second, /<rect x="66.2" y="40.50" width="2" height="13.50"/);
  assert.match(svgFor(agent, { settings: { paginationPosition: 'bottom-left' } }), /<rect x="6" y="66" width="20"/);
  assert.doesNotMatch(svgFor(agent, { settings: { paginationPosition: 'off' } }), /<rect x="66.2"|<rect x="6" y="66"/);
});

test('page transition keeps the scrollbar visible and moves its thumb', () => {
  const agent = { title: 'Tell me that these errors are not for this', status: 'idle', requiresAttention: true };
  const halfway = pageTransitionSvg(svgFor(agent, { frame: 0 }), svgFor(agent, { frame: 10 }), 0.5);
  assert.match(halfway, /<rect x="66.2" y="33.75" width="2" height="13.50"/);
  assert.ok(new Resvg(halfway).render().asPng().length > 100);
});

test('typography settings control font, weight, and spacing', () => {
  const image = svgFor({ title: 'Review', status: 'idle' }, { settings: { typography: {
    family: 'din', titleWeight: '700', statusWeight: '500', titleTracking: 0.4, statusTracking: 0.6,
  } } });
  assert.match(image, /font-family="DIN Condensed/);
  assert.match(image, /font-weight="700" letter-spacing="0.4"/);
  assert.match(image, /font-weight="500" letter-spacing="0.6"/);
});
