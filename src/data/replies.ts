// What your General says about your orders. Phase 3A adds several lines per rule for every
// General; until then the Captain answers. {rank} is replaced with a rank numeral.

export const CAPTAIN_REPLIES = {
  accepted: ['Understood.'],
  notTrainedYet: ["We haven't trained for that yet. Reach Rank {rank}."],
  impossible: ['No army could follow that order.'],
  autoNeedsCondition: ['Auto needs a condition to wait for.'],
  slotLocked: ['That slot opens at Rank {rank}.'],
  notUnderstood: ["I didn't catch that. Say it plainer."],
} as const;

export type ReplyKind = keyof typeof CAPTAIN_REPLIES;
