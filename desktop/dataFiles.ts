// The game's files on disk, inside one data folder (on Windows, %APPDATA%\Generals).
// Only plain names like `settings.json` or `saves/profile.json` are allowed, so the game can
// never reach outside the folder. A write goes to a temporary file first and then replaces the
// old file in one step, so a crash or power cut leaves either the old save or the new one,
// never half of each. Writes to the same file happen one after another, in order.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const NAME = /^(saves\/)?[a-z0-9][a-z0-9-]*\.json$/;
/** No file the game writes comes close to this; anything bigger is a bug or an attack. */
const MAX_BYTES = 1_000_000;
/** On Windows a virus scanner or cloud sync can hold a file for a moment; try again a few times. */
const RENAME_TRIES = 5;
const RENAME_WAIT_MS = 50;

export function isAllowedName(name: unknown): name is string {
  return typeof name === 'string' && NAME.test(name);
}

export class DataFiles {
  private readonly queues = new Map<string, Promise<void>>();

  constructor(readonly folder: string) {}

  private pathOf(name: unknown): string {
    if (!isAllowedName(name)) throw new Error(`Not a game file: ${String(name)}`);
    return path.join(this.folder, ...name.split('/'));
  }

  /** The file's text, or null if it doesn't exist. */
  async read(name: unknown): Promise<string | null> {
    try {
      return await readFile(this.pathOf(name), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  write(name: unknown, text: unknown): Promise<void> {
    let file: string;
    try {
      file = this.pathOf(name);
    } catch (error) {
      return Promise.reject(error);
    }
    if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_BYTES) {
      return Promise.reject(new Error(`Refusing to write ${String(name)}: not text, or too big`));
    }
    const previous = this.queues.get(file) ?? Promise.resolve();
    const next = previous.then(async () => {
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.tmp`;
      await writeFile(temporary, text, 'utf8');
      await replace(temporary, file);
    });
    // A failed write is reported to its caller and doesn't stop later writes.
    this.queues.set(file, next.catch(() => undefined));
    return next;
  }
}

async function replace(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= RENAME_TRIES || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw error;
      await new Promise((resolve) => setTimeout(resolve, RENAME_WAIT_MS * attempt));
    }
  }
}
