// Where a stop screen's cursor starts (session 7H): on the first option you can take, so the
// first press of Enter does something; a merchant's stock you can't afford is passed over.

/** The first option without a problem, or the first option when every one has one. */
export function firstTakeable(options: readonly { problem: string | null }[]): number {
  return Math.max(0, options.findIndex((option) => !option.problem));
}
