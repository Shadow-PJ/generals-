// `npm run art:achievements -- <folder>`: writes every achievement's icon, earned and not yet
// earned, into the folder (release/achievements by default), ready to upload to the store.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ACHIEVEMENTS } from '../../src/data/achievements';
import { achievementIcon } from './achievementIcons';

const folder = process.argv[2] ?? path.join('release', 'achievements');
mkdirSync(folder, { recursive: true });
for (const achievement of ACHIEVEMENTS) {
  writeFileSync(path.join(folder, `${achievement.id}.png`), achievementIcon(achievement, true).png());
  writeFileSync(path.join(folder, `${achievement.id}_locked.png`), achievementIcon(achievement, false).png());
}
console.log(`Wrote ${ACHIEVEMENTS.length * 2} achievement icons to ${folder}`);
