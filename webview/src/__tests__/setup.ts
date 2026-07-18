import 'reflect-metadata';
import '@testing-library/jest-dom/vitest';

// ---------------------------------------------------------------------------
// Hermetic browser-env guarantees (issue #193)
//
// The webview suite runs under jsdom, but a couple of browser globals are not
// dependable across the Node/jsdom versions contributors run on:
//   - `localStorage`/`sessionStorage` can be `undefined` on some Node+jsdom
//     combos. That surfaced directly as "Cannot read properties of undefined
//     (reading 'setItem')" and indirectly as theme/dir tests failing — a
//     swallowed seed write left components rendering on their defaults.
//   - jsdom never implements `matchMedia`, so any code path that reaches it
//     (e.g. SYSTEM theme resolution) throws unless a test stubs it first.
//
// We install deterministic implementations here so a red always means a real
// regression, regardless of the host environment. Individual tests remain free
// to re-define these (the descriptors are `configurable`/`writable`).
// ---------------------------------------------------------------------------

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(String(key), String(value));
    },
  } as Storage;
}

function installStorage(name: 'localStorage' | 'sessionStorage'): void {
  const mock = createStorageMock();
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: mock });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, { configurable: true, writable: true, value: mock });
  }
}

installStorage('localStorage');
installStorage('sessionStorage');

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  const matchMediaStub = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMediaStub });
}
