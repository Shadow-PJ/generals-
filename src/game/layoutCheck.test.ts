import { describe, expect, it } from 'vitest';
import { layoutProblems, type LayoutBox, type LayoutButton } from './layoutCheck';

const SCREEN = { w: 1000, h: 700 };
const text = (label: string, x: number, y: number, w: number, h = 16): LayoutBox => ({ label, x, y, w, h });
const button = (label: string, x: number, y: number, w: number, h = 30, labelW = w - 20): LayoutButton => ({
  label,
  x,
  y,
  w,
  h,
  text: text(label, x + (w - labelW) / 2, y + 7, labelW),
});

describe('the layout check', () => {
  it('passes a screen where nothing touches', () => {
    const items = {
      texts: [text('The Capital', 14, 2, 140, 30), text('Rank I', 14, 600, 80)],
      buttons: [button('Versus  M', 200, 16, 104), button('Settings  Esc', 840, 16, 140)],
    };
    expect(layoutProblems(items, SCREEN)).toEqual([]);
  });

  it('finds words running into a button, as the Capital’s header did', () => {
    const items = { texts: [text('The Capital', 14, 2, 200, 30)], buttons: [button('Versus  M', 158, 16, 104)] };
    expect(layoutProblems(items, SCREEN)).toEqual(['"The Capital" runs into the button "Versus  M"']);
  });

  it('finds words running into words, and off the screen', () => {
    const items = { texts: [text('Gold 40', 10, 10, 80), text('Boons', 60, 14, 60), text('A long line', 900, 680, 160)], buttons: [] };
    expect(layoutProblems(items, SCREEN)).toEqual(['"A long line" runs off the screen', '"Gold 40" runs into "Boons"']);
  });

  it('finds a label wider than its button, and buttons on top of each other', () => {
    const items = { texts: [], buttons: [button('Oaths of Command  O', 100, 100, 120, 30, 160), button('Codex  C', 200, 100, 104)] };
    expect(layoutProblems(items, SCREEN)).toEqual([
      'button "Oaths of Command  O": its label is wider than the button',
      'button "Oaths of Command  O" runs into the button "Codex  C"',
    ]);
  });

  it('lets boxes share a pixel or two of edge', () => {
    const items = { texts: [text('Left', 0, 0, 52), text('Right', 50, 0, 50)], buttons: [] };
    expect(layoutProblems(items, SCREEN)).toEqual([]);
  });
});
