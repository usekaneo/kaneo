import { describe, expect, it, vi } from "vitest";

vi.mock("@i18n/resources", async () => {
  const actual =
    await vi.importActual<typeof import("@i18n/resources")>("@i18n/resources");
  return {
    ...actual,
    loadLocale: vi.fn(async () => ({
      common: { testCommon: "common-value" },
      auth: { testAuth: "auth-value" },
    })),
  };
});

const { i18n, preloadNamespaces } = await import("./index");
const resources = await import("@i18n/resources");

describe("preloadNamespaces", () => {
  it("loads every namespace so non-default keys resolve after async init", async () => {
    await preloadNamespaces("en-US");

    expect(i18n.t("auth:testAuth")).toBe("auth-value");
    expect(i18n.t("common:testCommon")).toBe("common-value");
  });

  it("reuses the cached locale JSON across calls", async () => {
    const callsBefore = (resources.loadLocale as ReturnType<typeof vi.fn>).mock
      .calls.length;

    await preloadNamespaces("en-US");

    expect(
      (resources.loadLocale as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(callsBefore);
  });
});
