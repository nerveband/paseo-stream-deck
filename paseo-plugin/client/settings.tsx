import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { PluginSurfaceProps } from '@getpaseo/plugin/client';
import { useRpc } from '@getpaseo/plugin/client';
import { SettingsAction, SettingsCard, SettingsInput, SettingsSection, SettingsSelect } from '@getpaseo/plugin/client/ui';
import { defaults, readAppearance, writeAppearance, type Appearance } from '../shared/appearance';

const fontFields = [
  ['icon', 'Icon', 22], ['timer', 'Timer', 12], ['title', 'Title', 16], ['activity', 'Activity', 12],
] as const;
const colorFields = [
  ['active', 'Running'], ['question', 'Question'], ['permission', 'Approval'],
  ['attention', 'Finished'], ['error', 'Failed'], ['idle', 'Idle'], ['offline', 'Offline'],
] as const;

function flatten(settings: Appearance): Record<string, string> {
  return {
    paginationPosition: settings.paginationPosition,
    family: settings.typography.family,
    titleWeight: settings.typography.titleWeight,
    statusWeight: settings.typography.statusWeight,
    titleTracking: String(settings.typography.titleTracking),
    statusTracking: String(settings.typography.statusTracking),
    ...Object.fromEntries(fontFields.map(([key]) => [key, String(settings.fontSizes[key])])),
    ...Object.fromEntries(colorFields.map(([key]) => [key, settings.colors[key]])),
  };
}

function parseDraft(draft: Record<string, string>): Appearance {
  const fontSizes = Object.fromEntries(fontFields.map(([key]) => [key, Number(draft[key])])) as Appearance['fontSizes'];
  const colors = Object.fromEntries(colorFields.map(([key]) => [key, draft[key]])) as Appearance['colors'];
  for (const [key, label, maximum] of fontFields) {
    const value = fontSizes[key];
    if (!Number.isFinite(value) || value < 6 || value > maximum) throw new Error(`${label} size must be between 6 and ${maximum}.`);
  }
  for (const value of Object.values(colors)) {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error('Colors must be six-digit hex values, such as #ff6570.');
  }
  const titleTracking = Number(draft.titleTracking);
  const statusTracking = Number(draft.statusTracking);
  if (!Number.isFinite(titleTracking) || titleTracking < 0 || titleTracking > 0.8) throw new Error('Title spacing must be between 0 and 0.8.');
  if (!Number.isFinite(statusTracking) || statusTracking < 0 || statusTracking > 1) throw new Error('Status spacing must be between 0 and 1.');
  return { fontSizes, colors, paginationPosition: draft.paginationPosition as Appearance['paginationPosition'],
    typography: { family: draft.family as Appearance['typography']['family'], titleWeight: draft.titleWeight as Appearance['typography']['titleWeight'],
      statusWeight: draft.statusWeight as Appearance['typography']['statusWeight'], titleTracking, statusTracking } };
}

export function AppearanceSettings({ theme }: PluginSurfaceProps) {
  const read = useRpc(readAppearance);
  const write = useRpc(writeAppearance);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('Loading settings…');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const result = await read({});
      setDraft(flatten(result.settings));
      setRevision(value => value + 1);
      setMessage('Changes made in OpenDeck appear here after Reload.');
    } catch (error) {
      setMessage(`Could not load settings: ${String(error)}`);
    }
  }

  useEffect(() => { void load(); }, []);

  function change(key: string, value: string) {
    setDraft(current => current ? { ...current, [key]: value } : current);
    setMessage('Unsaved changes');
  }

  async function save() {
    if (!draft || saving) return;
    try {
      const settings = parseDraft(draft);
      setSaving(true);
      const result = await write(settings);
      setDraft(flatten(result.settings));
      setRevision(value => value + 1);
      setMessage('Saved. The Stream Deck updates within a few seconds.');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setSaving(false);
    }
  }

  return <View style={{ gap: 18 }}>
    <Text style={{ color: theme.colors.foregroundMuted }}>
      These settings control the Stream Deck connected to this Mac. OpenDeck and Paseo use the same appearance file.
    </Text>
    {draft && <>
      <SettingsSection title="Text size">
        <SettingsCard>
          {fontFields.map(([key, label]) =>
            <SettingsInput key={`${revision}-${key}`} label={label} initialValue={draft[key] ?? String(defaults.fontSizes[key])}
              onChangeText={value => change(key, value)} />)}
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Typography">
        <SettingsCard>
          <SettingsSelect label="Font" value={(draft.family || 'avenir') as Appearance['typography']['family']}
            options={[{ label: 'Avenir Next Condensed', value: 'avenir' }, { label: 'Arial Narrow', value: 'arial' }, { label: 'DIN Condensed', value: 'din' }]}
            onValueChange={value => change('family', value)} />
          <SettingsSelect label="Title weight" value={(draft.titleWeight || '600') as Appearance['typography']['titleWeight']}
            options={[{ label: 'Medium', value: '500' }, { label: 'Semibold', value: '600' }, { label: 'Bold', value: '700' }]}
            onValueChange={value => change('titleWeight', value)} />
          <SettingsSelect label="Status weight" value={(draft.statusWeight || '700') as Appearance['typography']['statusWeight']}
            options={[{ label: 'Medium', value: '500' }, { label: 'Semibold', value: '600' }, { label: 'Bold', value: '700' }]}
            onValueChange={value => change('statusWeight', value)} />
          <SettingsInput key={`${revision}-titleTracking`} label="Title spacing" initialValue={draft.titleTracking ?? '0'} onChangeText={value => change('titleTracking', value)} />
          <SettingsInput key={`${revision}-statusTracking`} label="Status spacing" initialValue={draft.statusTracking ?? '0.25'} onChangeText={value => change('statusTracking', value)} />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Status colors">
        <SettingsCard>
          {colorFields.map(([key, label]) =>
            <SettingsInput key={`${revision}-${key}`} label={label} initialValue={draft[key] ?? defaults.colors[key]}
              onChangeText={value => change(key, value)} />)}
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Pagination">
        <SettingsCard>
          <SettingsSelect label="Text page scrollbar" hint="Shows which part of a long title is visible" value={(draft.paginationPosition || 'right') as Appearance['paginationPosition']}
            options={[{ label: 'Right edge', value: 'right' }, { label: 'Bottom right', value: 'bottom-right' }, { label: 'Bottom left', value: 'bottom-left' }, { label: 'Off', value: 'off' }]}
            onValueChange={value => change('paginationPosition', value)} />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Apply">
        <SettingsCard>
          <SettingsAction label="Save changes" actionLabel={saving ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={saving} />
          <SettingsAction label="Read current settings" actionLabel="Reload" onPress={() => void load()} disabled={saving} />
        </SettingsCard>
      </SettingsSection>
    </>}
    <Text style={{ color: theme.colors.foregroundMuted }}>{message}</Text>
  </View>;
}
