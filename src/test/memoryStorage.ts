import { vi } from 'vitest';

/** Minimal in-memory Storage so unit tests do not need jsdom. */
export const createMemoryStorage = (initial: Record<string, string> = {}): Storage => {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => (data.has(key) ? (data.get(key) as string) : null),
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
};

/** Make `window.localStorage` point at `storage` for the current test. Undo with vi.unstubAllGlobals(). */
export const stubWindowStorage = (storage: Storage = createMemoryStorage()): Storage => {
  vi.stubGlobal('window', { localStorage: storage });
  return storage;
};

/** A Storage whose reads and/or writes throw, like Safari private mode or a full quota. */
export const createBrokenStorage = (opts: { read?: boolean; write?: boolean } = { read: true, write: true }): Storage => {
  const base = createMemoryStorage();
  return {
    get length() {
      return base.length;
    },
    clear: () => base.clear(),
    key: (index) => base.key(index),
    removeItem: (key) => base.removeItem(key),
    getItem: (key) => {
      if (opts.read) throw new Error('storage read blocked');
      return base.getItem(key);
    },
    setItem: (key, value) => {
      if (opts.write) throw new Error('storage quota exceeded');
      base.setItem(key, value);
    },
  };
};
