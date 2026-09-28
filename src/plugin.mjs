import streamDeck from '@elgato/streamdeck';
import { createPaseoClient } from '@getpaseo/client';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { imageFor } from './render.mjs';
import { activityOf, clean, statusOf, visibleAgents } from './model.mjs';

const ACTION = 'com.nerveband.paseodeck.agent';
const CONFIG = join(homedir(), 'Library/Application Support/paseo-deck/config.json');
const APPEARANCE = join(homedir(), 'Library/Application Support/paseo-deck/appearance.json');
function sources() {
  try {
    const value = JSON.parse(readFileSync(CONFIG, 'utf8'));
    if (Array.isArray(value.sources) && value.sources.length) return value.sources.filter(x => typeof x.label === 'string' && /^wss?:\/\//.test(x.url));
  } catch {}
  return [{ label: 'Mac', url: 'ws://127.0.0.1:6767/ws' }];
}
const SOURCES = sources();
const entries = new Map();
const activities = new Map();
const timelines = new Map();
const keys = new Map();
const prior = new Map();
let agents = [];
const connected = new Set();
let frame = 0;
let settings = {};
let settingsFingerprint = '{}';
let appearanceMtime = 0;

function mirrorAppearance(value) {
  try {
    mkdirSync(join(homedir(), 'Library/Application Support/paseo-deck'), { recursive: true });
    const temporary = `${APPEARANCE}.tmp-${process.pid}`;
    writeFileSync(temporary, JSON.stringify(value, null, 2));
    renameSync(temporary, APPEARANCE);
    appearanceMtime = statSync(APPEARANCE).mtimeMs;
  } catch (error) {
    streamDeck.logger.warn(`Appearance mirror failed: ${String(error)}`);
  }
}

function useSettings(value) {
  const next = value && typeof value === 'object' ? value : {};
  const fingerprint = JSON.stringify(next);
  if (fingerprint === settingsFingerprint) return;
  settings = next;
  settingsFingerprint = fingerprint;
  prior.clear();
  show();
  streamDeck.logger.info('Paseo Deck appearance settings updated');
  return true;
}

function hasAppearance(value) {
  return value && typeof value.fontSizes === 'object' && typeof value.colors === 'object';
}

async function refreshSettings() {
  try {
    const modified = statSync(APPEARANCE).mtimeMs;
    if (modified > appearanceMtime) {
      const shared = JSON.parse(readFileSync(APPEARANCE, 'utf8'));
      appearanceMtime = modified;
      if (hasAppearance(shared) && useSettings(shared)) await streamDeck.settings.setGlobalSettings(shared);
      return;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') streamDeck.logger.warn(`Appearance read failed: ${String(error)}`);
  }
  const global = await streamDeck.settings.getGlobalSettings();
  if (hasAppearance(global) && (useSettings(global) || !appearanceMtime)) mirrorAppearance(global);
}

function indexOf(action) {
  const at = action.coordinates;
  return at ? at.row * 5 + at.column : -1;
}

function show() {
  for (const [id, key] of keys) {
    const slot = indexOf(key.action);
    if (slot < 0 || slot >= 15) continue;
    const agent = agents[slot];
    const state = agent && activities.get(agent.deckId);
    const image = imageFor(agent, {
      offline: agent ? !connected.has(agent.sourceLabel) : connected.size === 0,
      activity: state?.activity,
      startedAt: state?.startedAt,
      endedAt: state?.endedAt,
      pressed: key.pressedUntil > Date.now(),
      frame,
      settings,
    });
    if (prior.get(id) === image) continue;
    prior.set(id, image);
    void key.action.setImage(image).catch(error => {
      prior.delete(id);
      streamDeck.logger.warn(`Image update failed: ${String(error)}`);
    });
  }
}

function updateActivity(agentId, item) {
  const text = activityOf(item);
  if (text) {
    const state = activities.get(agentId) || {};
    state.activity = clean(text);
    activities.set(agentId, state);
    show();
  }
}

async function watchTimeline(client, agent) {
  if (timelines.has(agent.deckId)) return;
  const handle = client.agents.ref(agent.id);
  const observer = handle.timeline.subscribe(update => {
    if (update.event?.type === 'timeline') updateActivity(agent.deckId, update.event.item);
  });
  timelines.set(agent.deckId, observer);
  try {
    const page = await handle.timeline.refetch({ direction: 'before', limit: 25, projection: 'projected' });
    for (let i = page.entries.length - 1; i >= 0; i--) {
      const text = activityOf(page.entries[i].item);
      if (text) { updateActivity(agent.deckId, page.entries[i].item); break; }
    }
  } catch (error) {
    streamDeck.logger.warn(`Timeline read failed: ${String(error)}`);
  }
}

function applyEntries() {
  const next = visibleAgents([...entries.values()]
    .filter(agent => {
      const source = SOURCES.find(x => x.label === agent.sourceLabel);
      return !agent.workspaceId || source?.activeWorkspaces?.has(agent.workspaceId);
    })
    .map(agent => ({ agent })));
  const visible = new Set(next.map(a => a.deckId));
  for (const agent of next) {
    const state = activities.get(agent.deckId) || {};
    const priorAgent = agents.find(a => a.deckId === agent.deckId);
    if (statusOf(agent) === 'active') {
      state.startedAt = agent.activeTurn?.startedAt || state.startedAt;
      state.endedAt = undefined;
    } else if (priorAgent && statusOf(priorAgent) === 'active' && state.startedAt) {
      state.endedAt = agent.updatedAt || new Date().toISOString();
    }
    activities.set(agent.deckId, state);
    const source = SOURCES.find(x => x.label === agent.sourceLabel);
    if (source?.client) void watchTimeline(source.client, agent);
  }
  for (const [id, observer] of timelines) {
    if (!visible.has(id)) {
      void observer.release?.();
      timelines.delete(id);
    }
  }
  agents = next;
  show();
}

async function connectPaseo(source) {
  while (true) {
    let client;
    try {
      client = createPaseoClient({ url: source.url, reconnect: { enabled: true } });
      await client.connect();
      source.client = client;
      const workspaces = await client.workspaces.list();
      source.activeWorkspaces = new Set(workspaces.entries.map(workspace => workspace.id));
      const directory = await client.agents.list({ filter: { includeArchived: false }, subscribe: {} });
      connected.add(source.label);
      const put = agent => entries.set(`${source.label}:${agent.id}`, { ...agent, deckId: `${source.label}:${agent.id}`, sourceLabel: source.label });
      for (const { agent } of directory.entries) put(agent);
      directory.subscription.subscribe({
        snapshot(snapshot) {
          for (const id of entries.keys()) if (id.startsWith(`${source.label}:`)) entries.delete(id);
          for (const { agent } of snapshot.entries || []) put(agent);
          applyEntries();
        },
        update(message) {
          if (message.type !== 'agent_update') return;
          const change = message.payload;
          if (change.kind === 'upsert') put(change.agent);
          if (change.kind === 'remove') entries.delete(`${source.label}:${change.agentId}`);
          applyEntries();
        },
      });
      applyEntries();
      streamDeck.logger.info(`Connected to Paseo source ${source.label}`);
      return;
    } catch (error) {
      connected.delete(source.label);
      show();
      streamDeck.logger.warn(`Paseo source ${source.label} unavailable: ${String(error)}`);
      await client?.close().catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

streamDeck.actions.onWillAppear(event => {
  if (event.action.manifestId !== ACTION || !event.action.isKey()) return;
  keys.set(event.action.id, { action: event.action, pressedUntil: 0 });
  show();
});
streamDeck.actions.onWillDisappear(event => {
  keys.delete(event.action.id);
  prior.delete(event.action.id);
});
streamDeck.actions.onKeyDown(event => {
  if (event.action.manifestId !== ACTION) return;
  const key = keys.get(event.action.id);
  if (!key) return;
  key.pressedUntil = Date.now() + 400;
  show();
  setTimeout(show, 450);
  const agent = agents[indexOf(event.action)];
  if (agent) {
    const source = SOURCES.find(x => x.label === agent.sourceLabel);
    const target = source?.serverId
      ? `paseo://h/${encodeURIComponent(source.serverId)}/agent/${encodeURIComponent(agent.id)}`
      : null;
    spawn('open', target ? [target] : ['-a', 'Paseo'], { stdio: 'ignore' }).unref();
  }
});

streamDeck.settings.onDidReceiveGlobalSettings(event => {
  const incoming = event.payload?.settings;
  if (hasAppearance(incoming) && useSettings(incoming)) mirrorAppearance(settings);
});

console.error("Paseo Deck bootstrap");
try { await streamDeck.connect(); console.error("Paseo Deck socket connected"); } catch (error) { console.error("Paseo Deck socket failed", String(error)); throw error; }
await refreshSettings().catch(error => streamDeck.logger.warn(`Initial appearance read failed: ${String(error)}`));
for (const source of SOURCES) void connectPaseo(source);
setInterval(() => {
  void refreshSettings().catch(error => {
    streamDeck.logger.warn(`Appearance settings refresh failed: ${String(error)}`);
  });
}, 3000);
setInterval(() => {
  frame = Math.floor(Date.now() / 1000);
  for (const source of SOURCES) {
    if (source.client?.getConnectionState().status === 'connected') connected.add(source.label);
    else connected.delete(source.label);
  }
  show();
}, 1000);
setInterval(() => {
  for (const source of SOURCES) {
    if (!connected.has(source.label)) continue;
    void source.client.workspaces.list().then(result => {
      source.activeWorkspaces = new Set(result.entries.map(workspace => workspace.id));
      applyEntries();
    }).catch(error => streamDeck.logger.warn(`Workspace refresh failed for ${source.label}: ${String(error)}`));
  }
}, 30000);
