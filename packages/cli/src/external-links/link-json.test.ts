import { describe, expect, it } from "vite-plus/test";
import { toLinkJson } from "./link-json.js";
import { externalLink } from "./test-links.js";

describe("toLinkJson", () => {
  it("marks manual links as removable", () => {
    expect(toLinkJson(externalLink({ id: "l1", title: "Spec" }))).toEqual({
      id: "l1",
      url: "https://example.com/l1",
      title: "Spec",
      source: "manual",
      resourceType: "url",
      removable: true,
      createdAt: "2026-10-08T10:00:00.000Z",
    });
  });

  it("names the integration a synced link comes from", () => {
    expect(
      toLinkJson(
        externalLink({
          id: "l2",
          integrationId: "i1",
          resourceType: "pull_request",
          integration: { id: "i1", type: "github" },
        }),
      ),
    ).toMatchObject({ source: "github", removable: false });
  });
});
