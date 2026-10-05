// The six Generals' portraits in pixel art (session 6B), 16×16, head and shoulders. Each is drawn
// in its faction's colors through the L, A and a keys (the Captain in your blue).

import type { GeneralId } from '../../data/generals';
import { BASE } from './palette';
import { still, type Palette, type Sprite } from './pixels';

export const PORTRAITS: Readonly<Record<GeneralId, Sprite>> = {
  // An officer's cap with a gold badge, a mustache, epaulettes.
  captain: still([
    '................',
    '.....kkkkkk.....',
    '....kAAAAAAk....',
    '...kAAAAgAAAk...',
    '...kaaaaaaaak...',
    '....khsssshk....',
    '....ksessesk....',
    '....kssSSssk....',
    '....khhhhhhk....',
    '.....ksSSsk.....',
    '......kSSk......',
    '..kkkAAAAAAkkk..',
    '.kggAAAAAAAAggk.',
    'kggAAAAAgAAAAggk',
    'kAAAAAAAgAAAAAAk',
    'kaAAAAAAgAAAAAak',
  ]),
  // Horned helm, glowing eyes, a scar and a beard, iron pauldrons.
  warlord: still([
    '.kk..........kk.',
    '.kck...kk...kck.',
    '..kck.kAAk.kck..',
    '...kckAAAAkck...',
    '....kMMMMMMk....',
    '....kMzkkzMk....',
    '....ksssszsk....',
    '....kSsszssk....',
    '....khhhhhhk....',
    '....khHhhHhk....',
    '.....khhhhk.....',
    '..kkkkhhhhkkkk..',
    '.kMMaAAAAAAaMMk.',
    'kMmMaAAAAAAaMmMk',
    'kMMMkAAAAAAkMMMk',
    'kaaakAAAAAAkaaak',
  ]),
  // Goggles down over the eyes, soot on the cheek, a leather apron with a wrench.
  engineer: still([
    '................',
    '.....kkkkkk.....',
    '....khhHhhhk....',
    '...khhhhhHhhk...',
    '...khhhhhhhhk...',
    '...kkkkkkkkkk...',
    '...kmuumkmuumk..',
    '...kmuumkmuumk..',
    '....ksssssSsk...',
    '....ksOssssSk...',
    '.....ksSSsk.....',
    '..kkkAAAAAAkkk..',
    '.kWWAAAAAAAAWWk.',
    'kWAAAAMMAAAAAAWk',
    'kAAAAAMMAAAAAAAk',
    'kaAAAAMMAAAAAAak',
  ]),
  // A queen of the swarm: feelers, compound eyes, mandibles, a carapace.
  hiveMother: still([
    '...k........k...',
    '....k......k....',
    '.....kkkkkk.....',
    '....kAAAAAAk....',
    '...kAALLLLAAk...',
    '...kAzzAAzzAk...',
    '...kAzyAAzyAk...',
    '...kaAAAAAAak...',
    '....kaAAAAak....',
    '...kk.kaak.kk...',
    '...kck.kk.kck...',
    '..kkAkkkkkkAkk..',
    '.kAAaAAAAAAaAAk.',
    'kALAAaAAAAaAALAk',
    'kAAAAAaAAaAAAAAk',
    'kaAAAAAaaAAAAAak',
  ]),
  // A deep hood, eyes glowing with the void, a rune on the chest.
  strategist: still([
    '................',
    '......kkkk......',
    '....kkAAAAkk....',
    '...kAAAAAAAAk...',
    '...kAAAAAAAAk...',
    '..kAAaaaaaaAAk..',
    '..kAassssssaAk..',
    '..kAasrssrsaAk..',
    '..kAassSSssaAk..',
    '..kAAasSSsaAAk..',
    '..kAAAaSSaAAAk..',
    '.kAAAAAAAAAAAAk.',
    'kAAAAAAvvAAAAAAk',
    'kAAAAAvrrvAAAAAk',
    'kaAAAAAvvAAAAAak',
    'kaaAAAAAAAAAAaak',
  ]),
  // A tall hat with a band, swept white hair, a high collar and a red bow tie.
  conductor: still([
    '....kkkkkkk.....',
    '....kbbbbbk.....',
    '....kbbbbbk.....',
    '....kAAAAAk.....',
    '..kkbbbbbbbkk...',
    '...kxxsssssxk...',
    '...kxsesssesk...',
    '...kxssSSsssk...',
    '....ksssSssk....',
    '....kssSSssk....',
    '...kAk.kk.kAk...',
    '..kAAAkxxkAAAk..',
    '.kbbAAkxxkAAbbk.',
    'kbbbbAkzzkAbbbbk',
    'kbbbbbkxxkbbbbbk',
    'kbbbbbkxxkbbbbbk',
  ]),
};

/** Each General's colors: light, main and dark (the faction's, or your blue for the Captain). */
const GENERAL_COLORS: Readonly<Record<GeneralId, { L: number; A: number; a: number }>> = {
  captain: { L: 0xa3d4ff, A: 0x3d8bff, a: 0x1f4f9e },
  warlord: { L: 0xff8a80, A: 0xc62828, a: 0x6d1111 },
  engineer: { L: 0xffc078, A: 0xe8731c, a: 0x8a3c0c },
  hiveMother: { L: 0xd9f99d, A: 0x84cc16, a: 0x3f6212 },
  strategist: { L: 0xc4b5fd, A: 0x7c3aed, a: 0x3b1a7a },
  conductor: { L: 0xa5f3fc, A: 0x22d3ee, a: 0x0e7490 },
};

export function portraitPalette(general: GeneralId): Palette {
  return { ...BASE, ...GENERAL_COLORS[general] };
}
