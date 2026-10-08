// The Captain's tutorial (session 6A): in your first battles the Captain, your first General,
// says a short tip the first time each moment comes: on each screen of a run, and in battle when
// a card is ready, the ultimate is ready, the pips are full or a troop falls. Each tip shows once;
// the Settings screen turns them off or plays them again.
//
// In the texts, {key:<action>} is the key (or controller button) for that input action, {slot}
// the card's slot number, {slotKey} its key or button, and {ultimate} your General's ultimate.

export const TIP_IDS = [
  'capital',
  'runMap',
  'army',
  'prep',
  'orders',
  'battleStart',
  'cardReady',
  'ultimateReady',
  'pipsFull',
  'troopLost',
  'result',
] as const;
export type TipId = (typeof TIP_IDS)[number];

/** The screens with a tip, by their scene names. */
export type TipScene = 'Capital' | 'Run' | 'Army' | 'Prep' | 'Orders' | 'Battle' | 'Result';

export interface Tip {
  scene: TipScene;
  text: string;
}

export const TIPS: Readonly<Record<TipId, Tip>> = {
  capital: {
    scene: 'Capital',
    text: "I'm your Captain. Each region on this map is ruled by a General. Pick one with {key:left} {key:right} and press {key:confirm} to set out on a run: a road of battles that ends at its ruler.",
  },
  runMap: {
    scene: 'Run',
    text: 'This is the road. Pick the next stop with {key:left} {key:right} and {key:confirm}. A fight shows the army waiting there; win it for fighters and gold. Camps heal, the merchant sells. The ruler waits at the end.',
  },
  army: {
    scene: 'Army',
    text: 'Choose who fights: five troops on the field, three in reserve. Vanguards hold the front, Rangers shoot from behind, Guardians shield. {key:confirm} when you are set.',
  },
  prep: {
    scene: 'Prep',
    text: 'Place your troops on your half: drag them, or pick one with {key:next} and move it with the arrows. Vanguards in front, Rangers behind them. {key:confirm} goes on to your orders.',
  },
  orders: {
    scene: 'Orders',
    text: 'Your first two slots hold orders to start with. Write your own in plain words, like "everyone focus their Rangers", and I turn it into a card for the slot. Press {key:start} to start the battle.',
  },
  battleStart: {
    scene: 'Battle',
    text: 'Your troops fight on their own. Your cards wait in the slots below; when one says Ready, press its number. {key:pause} pauses if you need a moment.',
  },
  cardReady: {
    scene: 'Battle',
    text: 'Card {slot} is ready: press {slotKey}! A card with a condition glows NOW! when its moment comes; fire it then for a Perfect.',
  },
  ultimateReady: {
    scene: 'Battle',
    text: 'Momentum is full: press {key:ultimate} for {ultimate}! Fire two cards one after the other and they chain into a combo, too.',
  },
  pipsFull: {
    scene: 'Battle',
    text: 'Your pips are full. Cards cost pips, and a full bar earns no more: spend them.',
  },
  troopLost: {
    scene: 'Battle',
    text: 'We lost a troop. A Call Reserve card brings a fresh one in; a Protect card can save the next.',
  },
  result: {
    scene: 'Result',
    text: 'After every fight I grade your command. The Battle IQ report shows your best moment and your worst mistake; a better grade earns more XP in a run.',
  },
};

export const TUTORIAL_RULES = {
  /** How long a tip stays before it fades by itself, in seconds. */
  tipSeconds: 12,
  /** In battle tips are shorter-lived: the fight goes on. */
  battleTipSeconds: 8,
} as const;
