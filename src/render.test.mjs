import test from 'node:test';
import assert from 'node:assert/strict';
import { svgFor } from './render.mjs';
import { displayTitle } from './model.mjs';

test('URL titles use the host and remain readable in the key window', () => {
  assert.equal(displayTitle('https://www.example.com/docs'), 'example.com/docs');
  assert.equal(displayTitle('https://www.scribd.com/document/123456789/a-long-path'), 'scribd.com/document');
  const image = svgFor({ title: 'https://www.example.com/docs', status: 'running' });
  assert.ok(image.includes('example.com'));
  assert.ok(!image.includes('https://'));
});

test('global colors and font sizes change the rendered key', () => {
  const image = svgFor({ title: 'Build', status: 'running' }, {
    settings: { colors: { active: '#123456' }, fontSizes: { title: 10 } },
  });
  assert.ok(image.includes('stroke="#123456"'));
  assert.ok(image.includes('stop-color="#06131f"'));
  assert.ok(image.includes('font-size="10"'));
});

test('long titles use two readable lines and rotate through later words', () => {
  const agent = { title: 'Review the storefront migration', status: 'running' };
  const first = svgFor(agent, { frame: 0, settings: { fontSizes: { title: 15 } } });
  const next = svgFor(agent, { frame: 6, settings: { fontSizes: { title: 15 } } });
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
  assert.ok(first.indexOf('Finished,') < first.indexOf('review'));
  assert.ok(later.indexOf('Finished,') < later.indexOf('review'));
});

test('title and activity fit natural phrases on one line', () => {
  const image = svgFor({ title: 'are not for this', status: 'idle', requiresAttention: true });
  assert.match(image, />are not for this<\/text>/);
  assert.match(image, />Finished, review<\/text>/);
  const longTitle = { title: 'Tell me that these errors are not for this', status: 'idle', requiresAttention: true };
  assert.match(svgFor(longTitle, { frame: 0 }), />Tell me that<\/text>/);
  assert.match(svgFor(longTitle, { frame: 6 }), />are not for this<\/text>/);
});

test('idle and disconnected keys do not claim to be using an old tool', () => {
  const agent = { title: 'Review', status: 'idle' };
  const idle = svgFor(agent, { activity: 'Using bash' });
  const offline = svgFor(agent, { activity: 'Using bash', offline: true });
  assert.ok(idle.includes('Ready'));
  assert.ok(!idle.includes('Using bash'));
  assert.ok(offline.includes('Disconnected'));
  assert.ok(!offline.includes('Using bash'));
});

test('unused slots stay visually quiet', () => {
  const empty = svgFor(null);
  assert.ok(empty.includes('fill="#101820"'));
  assert.ok(!empty.includes('Ready'));
});
