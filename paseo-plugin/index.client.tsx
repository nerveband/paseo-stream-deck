import type { PluginClientContext } from '@getpaseo/plugin/client';
import { AppearanceSettings } from './client/settings';

export default function contribute(client: PluginClientContext) {
  return client.addSettingsScreen({
    id: 'appearance',
    title: 'Paseo Deck',
    icon: 'Settings2',
    Component: AppearanceSettings,
  });
}
