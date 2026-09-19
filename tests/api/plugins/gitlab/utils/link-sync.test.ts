import { describe, expect, it } from "vitest";
import {
  isEchoOf,
  type LinkSyncState,
  parseLinkSyncMetadata,
  TEXT_ECHO_WINDOW_MS,
  withLastSync,
} from "../../../../../apps/api/src/plugins/gitlab/utils/link-sync";

function writtenAgo(
  ms: number,
  value: string,
  source = "kaneo",
): LinkSyncState {
  return {
    timestamp: new Date(Date.now() - ms).toISOString(),
    source,
    value,
  };
}

describe("isEchoOf", () => {
  it("treats the same value written by the other side as an echo", () => {
    expect(isEchoOf(writtenAgo(500, "Fix login"), "kaneo", "Fix login")).toBe(
      true,
    );
  });

  it("keeps a different value arriving right after a write", () => {
    expect(isEchoOf(writtenAgo(500, "Fix login"), "kaneo", "Fix logout")).toBe(
      false,
    );
  });

  it("keeps the value once the echo window has passed, so a revert still lands", () => {
    expect(
      isEchoOf(
        writtenAgo(TEXT_ECHO_WINDOW_MS + 1000, "Fix login"),
        "kaneo",
        "Fix login",
      ),
    ).toBe(false);
  });

  it("only matches the source it is asked about", () => {
    expect(
      isEchoOf(writtenAgo(500, "Fix login", "gitlab"), "kaneo", "Fix login"),
    ).toBe(false);
  });

  it("is not an echo when there is nothing recorded", () => {
    expect(isEchoOf(undefined, "kaneo", "Fix login")).toBe(false);
  });

  it("is not an echo when the recorded timestamp is unusable", () => {
    expect(
      isEchoOf(
        { timestamp: "not a date", source: "kaneo", value: "Fix login" },
        "kaneo",
        "Fix login",
      ),
    ).toBe(false);
  });
});

describe("parseLinkSyncMetadata", () => {
  const context = { externalLinkId: "link-1", field: "title" };

  it("returns an empty object for a row with no metadata", () => {
    expect(parseLinkSyncMetadata(null, context)).toEqual({});
    expect(parseLinkSyncMetadata(undefined, context)).toEqual({});
  });

  it("returns an empty object rather than throwing on unparseable metadata", () => {
    expect(parseLinkSyncMetadata("{not json", context)).toEqual({});
  });

  it("ignores metadata that parses to something other than an object", () => {
    expect(parseLinkSyncMetadata("null", context)).toEqual({});
    expect(parseLinkSyncMetadata('"kaneo"', context)).toEqual({});
    expect(parseLinkSyncMetadata("[1,2]", context)).toEqual({});
  });

  it("keeps the fields a previous write left behind", () => {
    expect(
      parseLinkSyncMetadata('{"state":"open","createdFrom":"kaneo"}', context),
    ).toEqual({ state: "open", createdFrom: "kaneo" });
  });
});

describe("withLastSync", () => {
  it("records the field without dropping the rest of the metadata", () => {
    const result = withLastSync(
      { state: "open", syncedNoteIds: [1] },
      "title",
      "kaneo",
      "Fix login",
    );

    expect(result.state).toBe("open");
    expect(result.syncedNoteIds).toEqual([1]);
    expect(result.lastSync?.title).toMatchObject({
      source: "kaneo",
      value: "Fix login",
    });
  });

  it("leaves the other field's state alone", () => {
    const result = withLastSync(
      { lastSync: { description: writtenAgo(0, "body") } },
      "title",
      "gitlab",
      "Fix login",
    );

    expect(result.lastSync?.description?.value).toBe("body");
    expect(result.lastSync?.title?.value).toBe("Fix login");
  });
});
