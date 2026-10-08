// Every sprite in the game, with the palette it is drawn in: for the tests that check them and
// for the preview sheet (`npm run art:preview`).

import { GENERAL_IDS } from '../../data/generals';
import { NODE_KINDS } from '../../data/runs';
import { REGION_IDS } from '../../data/regions';
import { UNIT_CLASSES, type UnitClass } from '../../data/units';
import { CAPITAL_ICON, CROSSROADS_MARK, NODE_ICONS, REGION_ICONS } from './icons';
import { BASE, sidePalette } from './palette';
import type { Palette, Sprite } from './pixels';
import { PORTRAITS, portraitPalette } from './portraits';
import { PROP_ART, type PropId } from './props';
import { TROOP_ART, TURRET_ART } from './troops';
import { GEM_PALETTES, PIP_GEM, PIP_SOCKET } from './hud';
import { STOP_ART } from './stops';
import { CASTLE_ART, CASTLE_PALETTE, CLEARED_ICON, LOCK_ICON, MARKER_ARROW, RUN_BANNER } from './worldMap';

export interface SheetEntry {
  name: string;
  sprite: Sprite;
  palette: Palette;
}

const CLASSES = Object.keys(UNIT_CLASSES) as UnitClass[];

export const ART_SHEET: readonly SheetEntry[] = [
  ...CLASSES.flatMap((cls) => [
    { name: `${cls} (you)`, sprite: TROOP_ART[cls], palette: sidePalette('player') },
    { name: `${cls} (enemy)`, sprite: TROOP_ART[cls], palette: sidePalette('enemy') },
  ]),
  { name: 'turret (enemy)', sprite: TURRET_ART, palette: sidePalette('enemy') },
  ...GENERAL_IDS.map((g) => ({ name: `portrait ${g}`, sprite: PORTRAITS[g], palette: portraitPalette(g) })),
  ...(Object.keys(PROP_ART) as PropId[]).map((p) => ({ name: p, sprite: PROP_ART[p], palette: sidePalette('player') })),
  ...NODE_KINDS.map((k) => ({ name: `node ${k}`, sprite: NODE_ICONS[k], palette: BASE })),
  ...REGION_IDS.map((r) => ({ name: `region ${r}`, sprite: REGION_ICONS[r], palette: BASE })),
  { name: 'capital', sprite: CAPITAL_ICON, palette: BASE },
  { name: 'crossroads mark', sprite: CROSSROADS_MARK, palette: BASE },
  { name: 'castle', sprite: CASTLE_ART, palette: CASTLE_PALETTE },
  { name: 'pip', sprite: PIP_GEM, palette: GEM_PALETTES.pip },
  { name: 'pip (cheap)', sprite: PIP_GEM, palette: GEM_PALETTES.cheap },
  { name: 'pip socket', sprite: PIP_SOCKET, palette: BASE },
  { name: 'map arrow', sprite: MARKER_ARROW, palette: BASE },
  { name: 'run banner', sprite: RUN_BANNER, palette: sidePalette('player') },
  { name: 'lock', sprite: LOCK_ICON, palette: BASE },
  { name: 'cleared', sprite: CLEARED_ICON, palette: BASE },
  ...STOP_ART,
];
