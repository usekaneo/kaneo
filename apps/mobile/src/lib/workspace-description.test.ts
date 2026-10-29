import { describe, expect, it } from "vite-plus/test";

import {
  getWorkspaceDescription,
  workspaceDescriptionUpdate,
} from "./workspace-description";

describe("workspace descriptions", () => {
  it("prefers the first-class description over legacy metadata", () => {
    expect(
      getWorkspaceDescription({
        description: "Current description",
        metadata: { description: "Old description" },
      }),
    ).toBe("Current description");
  });

  it.each([undefined, null, "", "   "])(
    "falls back to legacy object or JSON metadata when the column is %s",
    (description) => {
      expect(
        getWorkspaceDescription({
          description,
          metadata: { description: "Legacy description" },
        }),
      ).toBe("Legacy description");
      expect(
        getWorkspaceDescription({
          description,
          metadata: '{"description":"Legacy description"}',
        }),
      ).toBe("Legacy description");
    },
  );

  it.each([undefined, null, "invalid JSON", "[]", [], 42])(
    "handles missing or malformed metadata: %j",
    (metadata) => {
      expect(getWorkspaceDescription({ metadata })).toBe("");
      expect(workspaceDescriptionUpdate("New description", metadata)).toEqual({
        description: "New description",
      });
    },
  );

  it("saves and clears a migrated description without reviving the legacy value", () => {
    for (const metadata of [
      {
        description: "Old description",
        custom: { enabled: true, value: null },
      },
      '{"description":"Old description","custom":{"enabled":true,"value":null}}',
    ]) {
      for (const description of ["New description", ""]) {
        const update = workspaceDescriptionUpdate(description, metadata);
        expect(update).toEqual({
          description,
          metadata: { description, custom: { enabled: true, value: null } },
        });
        expect(getWorkspaceDescription(update)).toBe(description);
      }
    }
  });

  it("ignores a non-string legacy description", () => {
    expect(getWorkspaceDescription({ metadata: { description: 42 } })).toBe("");
  });

  it("does not rewrite metadata that has no legacy description", () => {
    expect(
      workspaceDescriptionUpdate("New description", { custom: "kept" }),
    ).toEqual({ description: "New description" });
  });
});
