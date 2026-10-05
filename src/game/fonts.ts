// The game's pixel fonts (visual overhaul after 6C): Pixelify Sans for reading and Jacquard 12
// for titles, both under the SIL Open Font License and bundled with the game (docs/CREDITS.md).

import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/jacquard-12/latin-400.css';
import Phaser from 'phaser';

/**
 * Loads the fonts before the first screen draws its text (Phaser draws a text once, so a late
 * font would leave the system's in its place). They come with the game, so this is quick and
 * works offline; if it fails anyway the game starts with the system font.
 */
export async function loadFonts(): Promise<void> {
  const fonts = ['16px "Pixelify Sans"', 'bold 16px "Pixelify Sans"', '24px "Jacquard 12"'];
  const loaded = Promise.all(fonts.map((font) => document.fonts.load(font)));
  await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 3000))]).catch(() => undefined);
  keepLettersApart();
}

/**
 * Pixelify Sans joins "fi" and "fl" into single letters that read as "A" ("field" came out
 * "Aeld"). Text drawn for speed skips those joins, so every text is drawn that way.
 */
function keepLettersApart(): void {
  const style = Phaser.GameObjects.TextStyle.prototype;
  const syncFont = style.syncFont;
  style.syncFont = function (this: Phaser.GameObjects.TextStyle, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    syncFont.call(this, canvas, context);
    if ('textRendering' in context) context.textRendering = 'optimizeSpeed';
  };
}
