// Icons in pixel art (session 6B): the stops on a run's map, the regions and the Capital.

import type { RegionId } from '../../data/regions';
import type { NodeKind } from '../../data/runs';
import { still, type Sprite } from './pixels';
import { PROP_ART } from './props';

const castle = still([
  '.......k........',
  '.......kgggk....',
  '.......kggk.....',
  '.......k........',
  '.k.k.k.k..k.k.k.',
  '.kkkkk.k..kkkkk.',
  '.kooOkkkkkkooOk.',
  '.koeOkooOOkoeOk.',
  '.kooOkoooOkooOk.',
  '.kooOkkeekkooOk.',
  '.kooOkkeekkooOk.',
  '.kooOkkeekkooOk.',
  '.kqqqqqqqqqqqqk.',
  '.kkkkkkkkkkkkkk.',
  '................',
  '................',
]);

/** On a crossroads battle's medallion (session 7F): a signpost, its boards pointing two ways. */
export const CROSSROADS_MARK: Sprite = still([
  '...kWk...',
  '.kkkWkkkk',
  '.kwwwwwwk',
  '.kkkWkkkk',
  'kkkkWkkk.',
  'kwwwwwwk.',
  'kkkkWkkk.',
  '...kWk...',
  '...kWk...',
  '..kkWkk..',
]);

/** A stop on a run's map, by kind. */
export const NODE_ICONS: Readonly<Record<NodeKind, Sprite>> = {
  battle: still([
    'mk........km',
    'kmk......kmk',
    '.kmk....kmk.',
    '..kmk..kmk..',
    '...kmkkmk...',
    '....kmmk....',
    '...kgkkgk...',
    '..kgk..kgk..',
    '.kWk....kWk.',
    'kWk......kWk',
    'kk........kk',
    '............',
  ]),
  elite: still([
    '...kkkkkk...',
    '..kxxxxxxk..',
    '.kxxxxxxxxk.',
    '.kxxxxxxxxk.',
    '.kxeexxeexk.',
    '.kxeexxeexk.',
    '.kxxxeexxxk.',
    '..kxxxxxxk..',
    '...kxkkxk...',
    '...kkkkkk...',
    '............',
    '............',
  ]),
  event: still([
    '...kkkkk....',
    '..kxxxxxk...',
    '.kxxkkkxxk..',
    '.kxk...kxk..',
    '..k...kxxk..',
    '.....kxxk...',
    '....kxxk....',
    '....kxk.....',
    '....kkk.....',
    '....kxk.....',
    '....kxk.....',
    '....kkk.....',
  ]),
  merchant: still([
    '....k..k....',
    '....kkkk....',
    '.....kk.....',
    '....kwwk....',
    '..kkwwwwkk..',
    '.kwwwwwwwwk.',
    'kwwwwkkwwwwk',
    'kwwwkggkwwwk',
    'kwwwkgGkwwwk',
    'kWwwwkkwwwWk',
    '.kWWwwwwWWk.',
    '..kkkkkkkk..',
  ]),
  camp: still([
    '.....k......',
    '....kfk.....',
    '....kfFk....',
    '...kfyfk....',
    '...kfyyfk...',
    '..kFfyyfFk..',
    '..kFfyyfFk..',
    '...kFffFk...',
    '.kkWkkkkWkk.',
    'kWWWWkkWWWWk',
    '.kkWWWWWWkk.',
    '...kkkkkk...',
  ]),
  boss: still([
    '............',
    '............',
    '.k...kk...k.',
    'kgk.kggk.kgk',
    'kggkggggkggk',
    'kggggggggggk',
    'kgzgguuggzgk',
    'kggggggggggk',
    'kGGGGGGGGGGk',
    '.kkkkkkkkkk.',
    '............',
    '............',
  ]),
};

/** Each region's emblem on the world map. */
export const REGION_ICONS: Readonly<Record<RegionId, Sprite>> = {
  deepForest: PROP_ART.pine,
  voidRuins: PROP_ART.crystal,
  redCanyon: PROP_ART.canyonRock,
  ironFortress: castle,
  glassPlains: PROP_ART.shard,
};

export const CAPITAL_ICON: Sprite = castle;
