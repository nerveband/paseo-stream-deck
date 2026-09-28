import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { appearanceSchema, defaults, type Appearance } from '../shared/appearance';

const path = join(homedir(), 'Library/Application Support/paseo-deck/appearance.json');

export async function readSettings(): Promise<{ settings: Appearance }> {
  try {
    return { settings: appearanceSchema.parse(JSON.parse(await readFile(path, 'utf8'))) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { settings: defaults };
    throw error;
  }
}

export async function writeSettings(input: Appearance): Promise<{ settings: Appearance }> {
  const settings = appearanceSchema.parse(input);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, JSON.stringify(settings, null, 2));
  await rename(temporary, path);
  return { settings };
}
