// The layout check (session 7E): finds words that run into buttons, into other words or off the
// screen, and button labels too wide for their button. Development builds run it on every screen
// as it opens and print what it finds to the console (see layoutWatch.ts), so a long line or a
// crowded header shows up while the game is being made, not in a player's screenshot.

/** A box on the screen, in world units, and what it is called in a report. */
export interface LayoutBox {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A button: its face, and the label written on it. */
export interface LayoutButton extends LayoutBox {
  text: LayoutBox | null;
}

export interface LayoutItems {
  /** Every word on the screen that is not a button's label. */
  texts: LayoutBox[];
  buttons: LayoutButton[];
}

/**
 * How far, in world units, two boxes may run into each other before it counts: text boxes carry
 * a pixel or two of shadow and spacing that hide nothing.
 */
export const LAYOUT_SLACK = 2;

/** How deep two boxes run into each other, across and down; zero or less when they don't meet. */
function overlap(a: LayoutBox, b: LayoutBox): { x: number; y: number } {
  return {
    x: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
    y: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
  };
}

function meets(a: LayoutBox, b: LayoutBox, slack: number): boolean {
  const o = overlap(a, b);
  return o.x > slack && o.y > slack;
}

const quote = (box: LayoutBox) => `"${box.label.length > 40 ? `${box.label.slice(0, 39)}…` : box.label}"`;

/** What is wrong with a screen's layout, one line per problem; empty when nothing is. */
export function layoutProblems(items: LayoutItems, screen: { w: number; h: number }, slack = LAYOUT_SLACK): string[] {
  const problems: string[] = [];
  const { texts, buttons } = items;
  for (const t of texts) {
    if (t.x < -slack || t.y < -slack || t.x + t.w > screen.w + slack || t.y + t.h > screen.h + slack) {
      problems.push(`${quote(t)} runs off the screen`);
    }
  }
  for (const b of buttons) {
    const t = b.text;
    if (t && (t.x < b.x - slack || t.x + t.w > b.x + b.w + slack)) problems.push(`button ${quote(b)}: its label is wider than the button`);
  }
  for (const t of texts) {
    for (const b of buttons) if (meets(t, b, slack)) problems.push(`${quote(t)} runs into the button ${quote(b)}`);
  }
  texts.forEach((a, i) => {
    for (const b of texts.slice(i + 1)) if (meets(a, b, slack)) problems.push(`${quote(a)} runs into ${quote(b)}`);
  });
  buttons.forEach((a, i) => {
    for (const b of buttons.slice(i + 1)) if (meets(a, b, slack)) problems.push(`button ${quote(a)} runs into the button ${quote(b)}`);
  });
  return problems;
}
