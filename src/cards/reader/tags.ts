// What the order reader marks on each word. A word belongs to a trigger (part of the condition),
// a step, or neither; inside a trigger or step it plays a role. "B" marks the first word of a new
// trigger or step, "I" a word inside it.
//
//   when   their assassin   dives   ,   rangers   fall back   to the healer
//   C      BE    IE         IT      O   BA        IV   IV     IG IG  IG
//
//   O  not part of the card (filler, separator)     C  starts the condition ("when", "every time")
//   T  trigger word        E  who sets off the trigger ("their assassin", "my ranger", "3 enemies")
//   A  who does the step   V  what they do           G  whom or where ("the healer", "forward")
//   X  any other word in a step ("have", "should", "first")

/** Roles inside a trigger (T, E) or a step (A, V, G, X), plus O and C outside them. */
export type Role = 'O' | 'C' | 'T' | 'E' | 'A' | 'V' | 'G' | 'X';

export const TAGS = ['O', 'C', 'BT', 'IT', 'BE', 'IE', 'BA', 'IA', 'BV', 'IV', 'BG', 'IG', 'BX', 'IX'] as const;
export type Tag = (typeof TAGS)[number];

const TRIGGER_ROLES = new Set(['T', 'E']);
const STEP_ROLES = new Set(['A', 'V', 'G', 'X']);

export function roleOf(tag: Tag): Role {
  return (tag.length === 2 ? tag[1] : tag) as Role;
}

function partOf(tag: Tag): 'trigger' | 'step' | null {
  const role = roleOf(tag);
  return TRIGGER_ROLES.has(role) ? 'trigger' : STEP_ROLES.has(role) ? 'step' : null;
}

/** Whether `next` may follow `prev` (null = the first word): an "I" tag continues a trigger or step. */
export function canFollow(prev: Tag | null, next: Tag): boolean {
  if (next[0] !== 'I') return true;
  return prev !== null && partOf(prev) === partOf(next);
}

export function tagFor(role: Role, first: boolean): Tag {
  return (role === 'O' || role === 'C' ? role : `${first ? 'B' : 'I'}${role}`) as Tag;
}

/** A trigger or step: the words from `start` up to (not including) `end`. */
export interface Segment {
  kind: 'trigger' | 'step';
  start: number;
  end: number;
}

/** The triggers and steps in a tagged order, in the order they were written. */
export function segmentsOf(tags: readonly Tag[]): Segment[] {
  const segments: Segment[] = [];
  tags.forEach((tag, i) => {
    const part = partOf(tag);
    if (part === null) return;
    const last = segments.at(-1);
    if (tag[0] === 'I' && last && last.end === i && last.kind === part) last.end = i + 1;
    else segments.push({ kind: part, start: i, end: i + 1 });
  });
  return segments;
}
