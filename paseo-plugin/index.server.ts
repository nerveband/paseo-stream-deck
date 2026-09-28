import type { PluginServerContext } from '@getpaseo/plugin/server';
import { readAppearance, writeAppearance } from './shared/appearance';
import { readSettings, writeSettings } from './server/appearance';

export default function contribute(server: PluginServerContext) {
  server.handle(readAppearance, readSettings);
  server.handle(writeAppearance, writeSettings);
  return () => {};
}
