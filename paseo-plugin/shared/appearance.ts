import { defineRpc } from '@getpaseo/plugin';
import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const size = (maximum: number) => z.number().min(6).max(maximum);

export const appearanceSchema = z.object({
  fontSizes: z.object({ icon: size(22), timer: size(12), title: size(16), activity: size(12) }),
  colors: z.object({
    active: color, question: color, permission: color, attention: color,
    error: color, idle: color, offline: color,
  }),
});

export type Appearance = z.infer<typeof appearanceSchema>;

export const defaults: Appearance = {
  fontSizes: { icon: 18, timer: 9, title: 12, activity: 8.4 },
  colors: {
    active: '#ff6570', question: '#ffe45c', permission: '#ba8dff',
    attention: '#72df91', error: '#ffab67', idle: '#50657b', offline: '#727784',
  },
};

export const readAppearance = defineRpc({
  name: 'appearance.read',
  input: z.object({}),
  output: z.object({ settings: appearanceSchema }),
});

export const writeAppearance = defineRpc({
  name: 'appearance.write',
  input: appearanceSchema,
  output: z.object({ settings: appearanceSchema }),
});
