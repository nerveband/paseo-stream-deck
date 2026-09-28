const priority = { permission: 0, question: 1, error: 2, active: 3, attention: 4, idle: 5 };

export function statusOf(agent) {
  if (agent.pendingPermissions?.length || agent.attentionReason === 'permission' || agent.attentionReason === 'approval') return 'permission';
  if (agent.attentionReason === 'question') return 'question';
  if (agent.status === 'error') return 'error';
  if (agent.status === 'running') return 'active';
  if (agent.requiresAttention || agent.attentionReason === 'finished') return 'attention';
  return 'idle';
}

export function visibleAgents(entries) {
  return entries.map(x => x.agent).filter(a => a && !a.archivedAt && a.status !== 'closed').sort((a, b) => {
    const p = priority[statusOf(a)] - priority[statusOf(b)];
    return p || Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
  }).slice(0, 15);
}

export function activityOf(item) {
  if (!item || typeof item !== 'object') return '';
  if (item.type === 'tool_call') return `Using ${String(item.name || 'tool').split(/[./]/).pop()}`;
  if (item.type === 'assistant_message') return clean(item.text);
  if (item.type === 'todo') {
    const current = item.items?.find(x => x.status === 'in_progress') || item.items?.[0];
    return clean(current?.text || current?.content);
  }
  return '';
}

export function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export function displayTitle(value) {
  const title = clean(value);
  if (/^https?:\/\//i.test(title)) {
    try {
      const url = new URL(title);
      const host = url.hostname.replace(/^www\./, '');
      const firstSegment = url.pathname.split('/').find(Boolean);
      return firstSegment && firstSegment.length <= 16 ? `${host}/${firstSegment}` : host;
    } catch {}
  }
  return title;
}

export function duration(start, end = Date.now()) {
  const ms = Date.parse(start);
  const last = typeof end === 'number' ? end : Date.parse(end);
  if (!Number.isFinite(ms) || !Number.isFinite(last) || last < ms) return '';
  const seconds = Math.floor((last - ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
