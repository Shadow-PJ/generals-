// The on-screen buttons of each screen, so a controller can reach every one of them with View
// (session 6C). ui.ts registers each button it makes; the input layer moves focus among them.

/** What the input layer needs from a button. */
export interface FocusableButton {
  /** Where it is on screen, to put buttons in reading order. */
  readonly x: number;
  readonly y: number;
  /** False once it is hidden or gone. */
  usable(): boolean;
  press(): void;
  setFocused(on: boolean): void;
}

const registry = new WeakMap<object, Set<FocusableButton>>();

export function registerButton(scene: object, button: FocusableButton): () => void {
  let set = registry.get(scene);
  if (!set) registry.set(scene, (set = new Set()));
  set.add(button);
  return () => set.delete(button);
}

/** The screen's usable buttons in reading order: top to bottom, then left to right. */
export function sceneButtons(scene: object): FocusableButton[] {
  return [...(registry.get(scene) ?? [])]
    .filter((b) => b.usable())
    .sort((a, b) => (Math.abs(a.y - b.y) > 12 ? a.y - b.y : a.x - b.x));
}
