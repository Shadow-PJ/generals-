// `npm run art:achievements -- <folder> [--scale <n>]`: writes every achievement's icon, earned
// and not yet earned, into the folder (release/achievements by default), ready to upload to the
// store. They are 256×256; `--scale 4` makes them 1024×1024 (for Epic, session 7B), each art
// pixel a bigger square.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ACHIEVEMENTS } from '../../src/data/achievements';
import { achievementIcon, ICON_SIZE } from './achievementIcons';

const args = process.argv.slice(2);
const scaleAt = args.indexOf('--scale');
const scale = scaleAt >= 0 ? Number(args[scaleAt + 1]) : 1;
if (!Number.isInteger(scale) || scale < 1) throw new Error('--scale takes a whole number, such as 4');
const folder = args.find((arg, i) => !arg.startsWith('--') && (scaleAt < 0 || i !== scaleAt + 1)) ?? path.join('release', 'achievements');
mkdirSync(folder, { recursive: true });
for (const achievement of ACHIEVEMENTS) {
  writeFileSync(path.join(folder, `${achievement.id}.png`), achievementIcon(achievement, true).scaled(scale).png());
  writeFileSync(path.join(folder, `${achievement.id}_locked.png`), achievementIcon(achievement, false).scaled(scale).png());
}
const size = ICON_SIZE * scale;
console.log(`Wrote ${ACHIEVEMENTS.length * 2} achievement icons, ${size}×${size}, to ${folder}`);
