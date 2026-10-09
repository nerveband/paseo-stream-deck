import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('plugin survives failed cleanup and disconnected sources, pages keys, and opens the displayed agent', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'paseo-deck-test-'));
  const stub = String.raw`
    import assert from 'node:assert/strict';
    export const handlers = {};
    export const images = new Map();
    export const opened = [];
    let state = 'connected';
    let observer;
    const agents = Array.from({length: 26}, (_, i) => ({agent: {
      id: 'agent-' + i, title: 'Agent ' + i, workspaceId: 'workspace',
      status: 'idle', updatedAt: new Date(26000 - i * 1000).toISOString()
    }}));
    export function spawn(command, args) { opened.push(args); return { unref() {} }; }
    export function createPaseoClient() { return {
      connect: async () => {}, close: async () => {},
      getConnectionState: () => ({status: state}),
      workspaces: {list: async () => ({entries: [{id: 'workspace', title: 'Workspace'}]})},
      agents: {
        list: async () => ({entries: agents, subscription: {subscribe(value) { observer = value; }}}),
        ref: () => ({timeline: {
          subscribe() { return {release: async () => { throw new Error('Transport closed during release'); }}; },
          refetch: async () => ({entries: []})
        }})
      }
    }; }
    const action = slot => ({id: String(slot), manifestId: 'com.nerveband.paseodeck.agent',
      coordinates: {row: Math.floor(slot / 5), column: slot % 5}, isKey: () => true,
      async setImage(value) { images.set(slot, Buffer.from(value.split(',')[1], 'base64').toString()); }
    });
    const deck = {
      logger: {warn() {}, info() {}},
      settings: {getGlobalSettings: async () => ({}), setGlobalSettings: async () => {},
        onDidReceiveGlobalSettings(fn) {handlers.settings = fn;}},
      actions: {onWillAppear(fn) {handlers.appear = fn;}, onWillDisappear(fn) {handlers.disappear = fn;},
        onKeyDown(fn) {handlers.press = fn;}},
      async connect() {
        for (let i = 0; i < 15; i++) handlers.appear({action: action(i)});
        setTimeout(() => observer.snapshot({entries: agents.slice(0, 25)}), 100);
        setTimeout(() => { state = 'disconnected'; }, 300);
        setTimeout(() => {
          assert.match(images.get(0), /DISCONNECTED/);
          state = 'connected';
          observer.update({type: 'agent_update', payload: {kind: 'upsert', agent: {...agents[0].agent, status: 'error'}}});
        }, 1200);
        setTimeout(() => {
          assert.match(images.get(0), /RUN FAILED/);
          assert.match(images.get(9), />1\/3<\/text>/);
          handlers.press({action: action(14)});
        }, 2300);
        setTimeout(() => {
          assert.match(images.get(9), />2\/3<\/text>/);
          assert.match(images.get(0), />Agent 12<\/text>/);
          handlers.press({action: action(0)});
          assert.match(opened[0][0], /agent\/agent-12$/);
          handlers.press({action: action(14)});
          handlers.press({action: action(14)});
        }, 2900);
        setTimeout(async () => {
          assert.match(images.get(9), />3\/3<\/text>/);
          handlers.press({action: action(4)});
          handlers.press({action: action(4)});
          handlers.press({action: action(4)});
          await new Promise(resolve => setImmediate(resolve));
          assert.match(images.get(9), />1\/3<\/text>/);
          console.log('verified'); process.exit(0);
        }, 3600);
      }
    };
    export default deck;
  `;
  try {
    const configDirectory = join(temporary, 'Library/Application Support/paseo-deck');
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(configDirectory, {recursive: true});
    await writeFile(join(configDirectory, 'config.json'), JSON.stringify({sources: [{label: 'Test', url: 'ws://localhost', serverId: 'test-host'}]}));
    const source = await readFile(new URL('./plugin.mjs', import.meta.url), 'utf8');
    const bundled = join(temporary, 'plugin.mjs');
    await build({stdin: {contents: source, resolveDir: new URL('.', import.meta.url).pathname}, outfile: bundled,
      bundle: true, platform: 'node', format: 'esm', plugins: [{name: 'test-host', setup(builder) {
        builder.onResolve({filter: /^(@elgato\/streamdeck|@getpaseo\/client|node:child_process)$/}, () => ({path: 'host', namespace: 'test-host'}));
        builder.onLoad({filter: /.*/, namespace: 'test-host'}, () => ({contents: stub, loader: 'js'}));
      }}]});
    const result = spawnSync(process.execPath, [bundled], {env: {...process.env, HOME: temporary}, encoding: 'utf8', timeout: 7000});
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /verified/);
  } finally { await rm(temporary, {recursive: true, force: true}); }
});
