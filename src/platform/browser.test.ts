import { describe, expect, it } from 'vitest';
import { storageFiles } from './browser';

/** A stand-in for the browser's local storage. */
function fakeStorage(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('browser files', () => {
  it('keeps each file under its own key in local storage', async () => {
    const storage = fakeStorage();
    const files = storageFiles(storage);
    expect(await files.read('saves/profile.json')).toBeNull();
    await files.write('saves/profile.json', '{"version":1}');
    await files.write('settings.json', '{}');
    expect(storage.data.get('generals/saves/profile.json')).toBe('{"version":1}');
    expect(await storageFiles(storage).read('saves/profile.json')).toBe('{"version":1}');
    expect(await files.read('settings.json')).toBe('{}');
  });

  it('keeps working in memory when storage is blocked or full', async () => {
    const blocked = fakeStorage();
    blocked.getItem = () => {
      throw new Error('blocked');
    };
    blocked.setItem = () => {
      throw new Error('quota');
    };
    for (const storage of [null, blocked]) {
      const files = storageFiles(storage);
      await files.write('settings.json', '{"a":1}');
      expect(await files.read('settings.json')).toBe('{"a":1}');
    }
  });
});
