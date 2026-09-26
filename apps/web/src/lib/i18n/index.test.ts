import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

const { loadLocaleMock, defaultResources } = vi.hoisted(() => {
  const resources = {
    common: { testCommon: "common-value" },
    auth: { testAuth: "auth-value" },
  };
  return {
    loadLocaleMock: vi.fn(
      async (
        _locale: Parameters<typeof import("@i18n/resources")["loadLocale"]>[0],
      ) => resources,
    ),
    defaultResources: resources,
  };
});

vi.mock("@i18n/resources", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@i18n/resources")>();
  return {
    ...actual,
    loadLocale: loadLocaleMock,
  };
});

const { i18n, preloadNamespaces } = await import("./index");

function staleChunkError() {
  return new TypeError(
    "Failed to fetch dynamically imported module: https://cdn.example.com/assets/en-US-BUxfZu3b.js",
  );
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("preloadNamespaces", () => {
  it("loads every namespace so non-default keys resolve after async init", async () => {
    loadLocaleMock.mockImplementation(async () => defaultResources);

    await preloadNamespaces("en-US");

    expect(i18n.t("auth:testAuth")).toBe("auth-value");
    expect(i18n.t("common:testCommon")).toBe("common-value");
  });

  it("reuses the cached locale JSON across calls", async () => {
    loadLocaleMock.mockImplementation(async () => defaultResources);

    const callsBefore = loadLocaleMock.mock.calls.length;

    await preloadNamespaces("en-US");

    expect(loadLocaleMock.mock.calls.length).toBe(callsBefore);
  });
});

describe("stale-chunk reload recovery", () => {
  const originalSessionStorage = window.sessionStorage;
  let setItemSpy: MockInstance | null = null;

  const reloadFlagWrites = () =>
    setItemSpy
      ? setItemSpy.mock.calls.filter(([key]) =>
          String(key).startsWith("locale-chunk-reload:"),
        ).length
      : 0;

  beforeEach(() => {
    loadLocaleMock.mockImplementation(async () => defaultResources);
    sessionStorage.clear();
  });

  afterEach(() => {
    setItemSpy?.mockRestore();
    setItemSpy = null;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: originalSessionStorage,
    });
  });

  it("scopes the reload guard per locale so a succeeding locale cannot clear another locale's failing guard", async () => {
    setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    loadLocaleMock.mockImplementation(async (locale: string) => {
      if (locale === "fr-FR") throw staleChunkError();
      return defaultResources;
    });

    // First "page load": the default locale succeeds while fr-FR persistently
    // fails with a stale-chunk error.
    const firstLoad = await import("./index");
    await firstLoad.preloadNamespaces("en-US");

    firstLoad.preloadNamespaces("fr-FR");
    await flushMicrotasks();

    // The stale-chunk failure set the fr-FR guard right before reloading.
    expect(sessionStorage.getItem("locale-chunk-reload:fr-FR")).toBe("1");
    expect(reloadFlagWrites()).toBe(1);

    // Simulate the reload: a fresh module instance, but the same sessionStorage
    // still holds the fr-FR guard.
    vi.resetModules();
    const secondLoad = await import("./index");
    await secondLoad.preloadNamespaces("en-US");

    // The successful default locale must only clear its own guard, leaving the
    // failing locale's guard untouched.
    expect(sessionStorage.getItem("locale-chunk-reload:fr-FR")).toBe("1");

    // fr-FR fails again. The guard must still be set, so the page must NOT
    // reload a second time and the error must propagate instead.
    await expect(secondLoad.preloadNamespaces("fr-FR")).rejects.toThrow(
      "Failed to fetch dynamically imported module",
    );
    expect(reloadFlagWrites()).toBe(1);
  });

  it("does not reload for transient failures that are not stale-chunk errors", async () => {
    vi.resetModules();
    setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    loadLocaleMock.mockImplementation(async (locale: string) => {
      if (locale === "en-US") throw new Error("network offline");
      if (locale === "de-DE")
        throw new TypeError("NetworkError when attempting to fetch resource.");
      return defaultResources;
    });

    const mod = await import("./index");

    await expect(mod.preloadNamespaces("en-US")).rejects.toThrow(
      "network offline",
    );
    await expect(mod.preloadNamespaces("de-DE")).rejects.toThrow(
      "NetworkError",
    );
    expect(reloadFlagWrites()).toBe(0);
  });

  it("does not break locale loading when sessionStorage is unavailable", async () => {
    const blockedStorage = {
      length: 0,
      clear: () => {},
      getItem: () => {
        throw new Error("session storage is blocked");
      },
      key: () => null,
      removeItem: () => {
        throw new Error("session storage is blocked");
      },
      setItem: () => {
        throw new Error("session storage is blocked");
      },
    };
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: blockedStorage,
    });

    // Success path: a blocked removeItem in the guard must not reject an
    // otherwise successful locale load.
    loadLocaleMock.mockImplementation(async () => defaultResources);
    const firstLoad = await import("./index");
    await firstLoad.preloadNamespaces("en-US");
    expect(firstLoad.i18n.t("common:testCommon")).toBe("common-value");

    // Failure path: guarded storage calls must not surface a storage error in
    // place of the original import error.
    vi.resetModules();
    loadLocaleMock.mockImplementation(async (locale: string) => {
      if (locale === "de-DE") throw staleChunkError();
      return defaultResources;
    });
    const secondLoad = await import("./index");

    const failing = secondLoad.preloadNamespaces("de-DE");

    // The page is reloading, so the pending promise stays pending rather than
    // rejecting with a storage error.
    let settled = false;
    failing.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await flushMicrotasks();
    expect(settled).toBe(false);
  });
});
