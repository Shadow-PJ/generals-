// The troops in pixel art (session 6B), 16×16, facing right; they are flipped to face left.
// L, A and a are the side's colors, so one drawing serves both armies. Each class has a still
// frame and two walking frames (the legs change); attacks, hits and falls are animated in code.

import type { UnitClass } from '../../data/units';
import { patch, type Rows, type Sprite } from './pixels';

export type TroopFrame = 'stand' | 'stepA' | 'stepB';
export const TROOP_FRAMES: readonly TroopFrame[] = ['stand', 'stepA', 'stepB'];

/** How many world units one art pixel covers on the battlefield. */
export const TROOP_ART_SCALE = 2;

// A knight: plumed helm, kite shield in front, sword held high behind.
const vanguard: Rows = [
  '................',
  '.......kAk......',
  '......kALk......',
  '.....kkAkk......',
  '....kmmmmmmk....',
  '...kmmmmmmmMk...',
  '...kMmkekekMk...',
  '.k.kMMMMMMMnk...',
  'kmk.knnnnnnk....',
  'kmk.kAALAAkkkkk.',
  'kmkkaAAAAkLLAAAk',
  'kgkkaAgAAkLAAAak',
  'kWkkaAAAAknmmmnk',
  '.k.kkaaaakAAAAak',
  '....kbbkbbkkAak.',
  '...kbbk.kbbkkk..',
];

// An archer: hood, bow held out in front, a quiver on the back.
const ranger: Rows = [
  '................',
  '................',
  '......kkkk......',
  '.....kAAAAk.kk..',
  '....kALAAAAkkwk.',
  '....kAAssskkk.wk',
  '....kAsesek.k.wk',
  '...kwkSSSk..k..w',
  '..kwkaAAAk..k..w',
  '..kwaAALAkkkkssw',
  '..khaAAAAk..k..w',
  '..khkhhhhk..k..w',
  '....kaAAak..k.wk',
  '....kaAAak..kkwk',
  '.....kbkbk...kk.',
  '....kbbkbbk.....',
];

// A shield-bearer: open helm, robe and tabard, a big round shield with a gold cross.
const guardian: Rows = [
  '................',
  '......kkkk......',
  '.....kmmmmk.....',
  '....kmmmmmMk....',
  '....kMssssMk....',
  '....kssesesk....',
  '.....kSSSSk.....',
  '....kcAAAAck....',
  '...kcAAAAkkkkk..',
  '...kcAAAkLAAAAk.',
  '..kscAAAkLAgAAAk',
  '...kcAAAkAgggAak',
  '...kcAAAkAAgAAak',
  '....kcccckaAAak.',
  '....kcccck.kkk..',
  '....kbbkbbk.....',
];

// A mage: tall bent hat, robe with a gold clasp, a staff with a glowing orb.
const invoker: Rows = [
  '.........kk.....',
  '........kAk..kk.',
  '.......kAAk.krrk',
  '......kAAk..kRrk',
  '.....kAAAAk..kk.',
  '...kkLAAAAAkkwk.',
  '....kkssssk..wk.',
  '.....ksesek..wk.',
  '.....kSSSSk.kwk.',
  '....kAAcAAkkswk.',
  '...kAAAcAAAk.wk.',
  '...kAAAgAAAk.wk.',
  '...kaAAcAAak.wk.',
  '..kaaAAcAAaak.k.',
  '..kkkkkkkkkkk...',
  '....kbk.kbk.....',
];

// A rogue: dark hood and mask, a scarf in the side's color flying behind, two daggers.
const assassin: Rows = [
  '................',
  '................',
  '.......kkkk.....',
  '......kaAAak....',
  '.....kaAAAAak...',
  '.....kaasssak...',
  '.....kbesesk....',
  '..kAkkAAAAAk....',
  '.kAAkbbbbbbk..k.',
  '..kk.kbbLbbk.kmk',
  '....kbbbbbbkkmk.',
  '...kskbbbbbkskk.',
  '..kmk.kbbbk.k...',
  '.kmk..khkhk.....',
  '.k...khk.khk....',
  '....khhk.khhk...',
];

// The Engineer boss's turret: a crossbow on a stone tower with a band in the side's color.
const turret: Rows = [
  '................',
  '..kk........kk..',
  '..kwk......kwk..',
  '...kwkkkkkkwk...',
  '....kwMMMMwk....',
  '...kkMnmmnMkkkk.',
  '...kMMMMMMMmmmmk',
  '...kkkkkkkkkkkk.',
  '..kAALAAAAAAAk..',
  '..kaAAAAAAAAak..',
  '..koooooooooOk..',
  '..kOookOoookOk..',
  '..koooooooooOk..',
  '..koOooooOoooOk.',
  '..kqqqqqqqqqqqk.',
  '...kkkkkkkkkkk..',
];

/** Legs for the two walking frames, by class: rows 14 and 15. */
const STEPS: Readonly<Record<UnitClass, { a: [string, string]; b: [string, string] }>> = {
  vanguard: { a: ['...kbbk.kbbk.kk.', '..kbbk...kbbk...'], b: ['.....kbbbk.kAak.', '.....kbbbbk.kk..'] },
  ranger: { a: ['....kbk..kbk.kk.', '...kbbk..kbbk...'], b: ['......kbbk....k.', '......kbbbk.....'] },
  guardian: { a: ['....kcccckkkk...', '...kbbk..kbbk...'], b: ['....kcccck.kkk..', '......kbbbk.....'] },
  invoker: { a: ['..kkkkkkkkkkk...', '...kbk...kbk....'], b: ['..kkkkkkkkkkk...', '.....kbbbk......'] },
  assassin: { a: ['....khk...khk...', '...khhk...khhk..'], b: ['......khhk......', '......khhhk.....'] },
};

function troop(cls: UnitClass, rows: Rows): Sprite {
  const steps = STEPS[cls];
  return {
    w: 16,
    h: 16,
    frames: {
      stand: rows,
      stepA: patch(rows, { 14: steps.a[0], 15: steps.a[1] }),
      stepB: patch(rows, { 14: steps.b[0], 15: steps.b[1] }),
    },
  };
}

export const TROOP_ART: Readonly<Record<UnitClass, Sprite>> = {
  vanguard: troop('vanguard', vanguard),
  ranger: troop('ranger', ranger),
  guardian: troop('guardian', guardian),
  invoker: troop('invoker', invoker),
  assassin: troop('assassin', assassin),
};

/** The turret stands still: every frame is the same. */
export const TURRET_ART: Sprite = { w: 16, h: 16, frames: { stand: turret, stepA: turret, stepB: turret } };
