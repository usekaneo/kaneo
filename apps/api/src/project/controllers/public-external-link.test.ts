import { describe, expect, it } from "vite-plus/test";
import { publicExternalLink } from "./public-external-link";

const link = {
  id: "link",
  taskId: "task",
  integrationId: "integration",
  resourceType: "pull_request",
  externalId: "42",
  url: "https://example.com/pull/42",
  title: "Linked pull request",
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe("public external links", () => {
  it("only exposes display metadata and explicit link fields", () => {
    const metadata = {
      state: "closed",
      merged: true,
      draft: false,
      lastSync: { description: { value: "previous text" } },
      unknownProviderField: "private value",
    };
    const input = { ...link, metadata, future: "private" };
    const result = publicExternalLink(input);
    expect(result).toEqual({
      ...link,
      integrationId: null,
      metadata: { state: "closed", merged: true, draft: false },
    });
    expect(metadata.lastSync.description.value).toBe("previous text");
  });

  it.each([
    null,
    { state: "unknown", merged: "true", draft: { value: true } },
    { lastSync: { title: { value: "previous title" } } },
  ])("drops unknown metadata and invalid display values: %j", (metadata) => {
    expect(publicExternalLink({ ...link, metadata }).metadata).toBeNull();
  });
});
