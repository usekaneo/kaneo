import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLinkMetadata } from "../../../../../apps/api/src/plugins/github/utils/parse-link-metadata";

const context = { externalLinkId: "link-1", source: "issue_closed" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseLinkMetadata", () => {
  it("reads a well formed object", () => {
    expect(
      parseLinkMetadata('{"state":"open","createdFrom":"kaneo"}', context),
    ).toEqual({
      state: "open",
      createdFrom: "kaneo",
    });
  });

  it("treats an absent value as no metadata", () => {
    expect(parseLinkMetadata(null, context)).toEqual({});
    expect(parseLinkMetadata(undefined, context)).toEqual({});
    expect(parseLinkMetadata("", context)).toEqual({});
  });

  it("warns and carries on when the row cannot be parsed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // A row truncated by an older write, which used to throw out of the handler
    // and fail the whole webhook delivery.
    expect(parseLinkMetadata('{"state":"op', context)).toEqual({});
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][1]).toMatchObject({
      externalLinkId: "link-1",
      source: "issue_closed",
    });
  });
});
