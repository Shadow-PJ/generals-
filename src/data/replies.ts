// What your General says about your orders. The validator's answers (refusals) are the same
// for every General; each General's reading of a card has its own lines below.
// {rank} is replaced with a rank numeral, {general} with a General's name.

export const CAPTAIN_REPLIES = {
  accepted: ['Understood.'],
  notTrainedYet: ["We haven't trained for that yet. Reach Rank {rank}."],
  impossible: ['No army could follow that order.'],
  autoNeedsCondition: ['Auto needs a condition to wait for.'],
  slotLocked: ['That slot opens at Rank {rank}.'],
  notUnderstood: ["I didn't catch that. Say it plainer."],
  legendaryOnlySlot: ['That is a Legendary order. It goes in the Legendary slot.'],
  legendaryMissing: ['The Legendary slot is for a Legendary order.'],
  oneLegendary: ['One Legendary order per card.'],
  legendaryNotLearned: ["We don't know that one. Beat {general} to learn it."],
  legendaryLocked: ['The Legendary slot opens when you beat your first boss General.'],
} as const;

export type ReplyKind = keyof typeof CAPTAIN_REPLIES;

/**
 * What each General says after reading your card, by the personality rule that shaped it
 * ('asWritten' when no rule changed anything). Several lines per rule keep replies from repeating.
 */
export const GENERAL_REPLIES = {
  captain: {
    asWritten: ['Understood.', 'As you say.', 'Consider it done.', 'Orders received.'],
  },
  warlord: {
    counterAttack: [
      'Retreat? We regroup and hit back!',
      'We fall back only to strike harder.',
      'A step back, then blood.',
      'Run? Fine. Then we turn and charge.',
    ],
    heldBack: ['Hold back? ...As you command.', 'Fine. We hold. This once.', 'Timid. But I will obey.'],
    asWritten: ['Now that is an order!', 'Blood will flow.', 'Finally, something worth fighting for.'],
  },
  engineer: {
    holdBeforeMove: [
      'Securing the position first.',
      'Anchor, then advance.',
      'We brace before we move. It costs a pip; it saves a squad.',
    ],
    asWritten: ['Sound plan. Executing.', 'The numbers check out.', 'Within tolerances.'],
  },
  hiveMother: {
    dropSteps: ['Too many words. Hunt.', 'The swarm keeps it short.', 'Two things. No more.'],
    simplifyTargets: ['Hunt.', 'Nearest prey.', 'We take what is close.'],
    asWritten: ['The swarm obeys.', 'Yesss.', 'We hunger.'],
  },
  strategist: {
    suggestCondition: [
      'Wait for them to commit. Then strike.',
      'An order without timing wastes pips. I suggest a moment.',
      'Patience. I have a better moment for this.',
      'Strike when they are exposed, not before.',
    ],
    asWritten: ['Precise. Good.', 'A well-timed order.', 'No weakness I can see.'],
  },
  conductor: {
    reorderForCombo: ['On the beat.', 'Wrong order, right notes. There.', 'Let me fix the tempo.'],
    alreadyCombo: ['Perfect harmony.', 'Already on the beat.', 'Bravo. That is a combo.'],
    asWritten: ['Fine. Not music, but fine.', 'Playable.', 'No combo here, but I will conduct it.'],
  },
} as const;
