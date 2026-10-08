import { describe, expect, it, vi } from "vite-plus/test";
import { catalogStatus } from "../../../apps/api/src/cli/commands/add/catalog-status";
import {
  catalogUrl,
  DEFAULT_CATALOG_URL,
  lookupCatalog,
} from "../../../apps/api/src/cli/commands/add/lookup-catalog";

const URL = "https://catalog.example/index.json";

function respond(response: Response | Error) {
  return vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch;
}

describe("catalogStatus", () => {
  it("finds listed packages by npm name", () => {
    const index = {
      plugins: [{ package: "kaneo-plugin-task-progress", repository: "x" }],
    };
    expect(catalogStatus(index, "kaneo-plugin-task-progress")).toBe("listed");
    expect(catalogStatus(index, "kaneo-plugin-other")).toBe("unlisted");
    expect(catalogStatus({ plugins: [] }, "x")).toBe("unlisted");
  });

  it("returns null for anything that is not an index", () => {
    expect(catalogStatus(null, "x")).toBeNull();
    expect(catalogStatus([], "x")).toBeNull();
    expect(catalogStatus({ plugins: {} }, "x")).toBeNull();
  });
});

describe("catalogUrl", () => {
  it("reads KANEO_PLUGIN_CATALOG_URL and falls back to the default", () => {
    expect(catalogUrl({ KANEO_PLUGIN_CATALOG_URL: ` ${URL} ` })).toBe(URL);
    expect(catalogUrl({ KANEO_PLUGIN_CATALOG_URL: "" })).toBe(
      DEFAULT_CATALOG_URL,
    );
    expect(catalogUrl({})).toBe(DEFAULT_CATALOG_URL);
  });
});

describe("lookupCatalog", () => {
  it("reports listed and unlisted packages", async () => {
    const index = { plugins: [{ package: "kaneo-plugin-task-progress" }] };
    const fetchIndex = respond(Response.json(index));
    expect(
      await lookupCatalog("kaneo-plugin-task-progress", {
        url: URL,
        fetchIndex,
      }),
    ).toEqual({ status: "listed" });
    expect(fetchIndex).toHaveBeenCalledWith(URL, expect.anything());
    expect(
      await lookupCatalog("kaneo-plugin-other", {
        url: URL,
        fetchIndex: respond(Response.json(index)),
      }),
    ).toEqual({ status: "unlisted" });
  });

  it("reports an unavailable catalog instead of failing", async () => {
    expect(
      await lookupCatalog("x", {
        url: URL,
        fetchIndex: respond(new TypeError("fetch failed")),
      }),
    ).toEqual({ status: "unavailable", reason: "fetch failed" });
    expect(
      await lookupCatalog("x", {
        url: URL,
        fetchIndex: respond(new Response("nope", { status: 404 })),
      }),
    ).toEqual({
      status: "unavailable",
      reason: `${URL} answered with HTTP 404`,
    });
    expect(
      await lookupCatalog("x", {
        url: URL,
        fetchIndex: respond(new Response("<html>")),
      }),
    ).toEqual({ status: "unavailable", reason: `${URL} did not return JSON` });
    expect(
      await lookupCatalog("x", {
        url: URL,
        fetchIndex: respond(Response.json({ packages: [] })),
      }),
    ).toEqual({
      status: "unavailable",
      reason: `${URL} is not a Kaneo plugin catalog index`,
    });
  });
});
