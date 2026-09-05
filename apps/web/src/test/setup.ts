import "@testing-library/jest-dom/vitest";

// Node can expose an incomplete global localStorage when it is launched with
// --localstorage-file but no usable path. Because that property takes
// precedence over jsdom's implementation, tests then receive an object without
// the Storage methods. Install a small in-memory implementation only in that
// broken environment.
if (typeof globalThis.localStorage?.clear !== "function") {
  const values = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
  });
}
