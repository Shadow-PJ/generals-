import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataFiles, isAllowedName } from './dataFiles.js';

describe('desktop data files', () => {
  let folder: string;
  let files: DataFiles;

  beforeEach(async () => {
    folder = await mkdtemp(path.join(tmpdir(), 'generals-'));
    files = new DataFiles(folder);
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('allows only the game’s own file names', () => {
    expect(isAllowedName('settings.json')).toBe(true);
    expect(isAllowedName('saves/profile.json')).toBe(true);
    for (const bad of ['../settings.json', 'saves/../../x.json', '/etc/passwd', 'C:\\x.json', 'saves\\profile.json', 'a.txt', '', 'saves/', 42]) {
      expect(isAllowedName(bad)).toBe(false);
    }
  });

  it('reads null for a file that was never written', async () => {
    expect(await files.read('saves/profile.json')).toBeNull();
  });

  it('writes into a saves folder it creates, and reads back', async () => {
    await files.write('saves/profile.json', '{"version":1}');
    expect(await files.read('saves/profile.json')).toBe('{"version":1}');
    expect(await readFile(path.join(folder, 'saves', 'profile.json'), 'utf8')).toBe('{"version":1}');
    // No temporary file is left behind.
    expect(await readdir(path.join(folder, 'saves'))).toEqual(['profile.json']);
  });

  it('keeps writes to one file in order', async () => {
    const writes = Array.from({ length: 20 }, (_, i) => files.write('settings.json', `{"n":${i}}`));
    await Promise.all(writes);
    expect(await files.read('settings.json')).toBe('{"n":19}');
  });

  it('refuses names outside the folder and things that are not text', async () => {
    await expect(files.write('../evil.json', '{}')).rejects.toThrow();
    await expect(files.read('../evil.json')).rejects.toThrow();
    await expect(files.write('settings.json', { not: 'text' })).rejects.toThrow();
    await expect(files.write('settings.json', 'x'.repeat(1_000_001))).rejects.toThrow();
  });

  it('keeps writing after a failed write', async () => {
    await expect(files.write('settings.json', 42)).rejects.toThrow();
    await files.write('settings.json', '{}');
    expect(await files.read('settings.json')).toBe('{}');
  });
});
