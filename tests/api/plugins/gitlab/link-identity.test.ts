import { describe, expect, it } from "vitest";
import { parseIssueIid } from "../../../../apps/api/src/plugins/gitlab/utils/issue-iid";
import {
  isOutboundNoteId,
  rememberOutboundNoteId,
} from "../../../../apps/api/src/plugins/gitlab/utils/outbound-notes";

describe("parseIssueIid", () => {
  it("accepts a clean positive integer", () => {
    expect(parseIssueIid("42")).toBe(42);
    expect(parseIssueIid(" 7 ")).toBe(7);
  });

  it("rejects a value that only starts with digits", () => {
    // Number.parseInt would read this as 17 and aim a write at the wrong issue.
    expect(parseIssueIid("17invalid")).toBeNull();
    expect(parseIssueIid("17.5")).toBeNull();
  });

  it("rejects non-numeric, zero, negative, and unsafe values", () => {
    expect(parseIssueIid("")).toBeNull();
    expect(parseIssueIid("abc")).toBeNull();
    expect(parseIssueIid("0")).toBeNull();
    expect(parseIssueIid("-3")).toBeNull();
    expect(parseIssueIid("99999999999999999999")).toBeNull();
  });
});

describe("outbound note bookkeeping", () => {
  it("recognises a note Kaneo posted itself", () => {
    const metadata = rememberOutboundNoteId(null, 101);

    expect(isOutboundNoteId(JSON.stringify(metadata), 101)).toBe(true);
    expect(isOutboundNoteId(JSON.stringify(metadata), 102)).toBe(false);
  });

  it("keeps the rest of the link metadata intact", () => {
    const existing = JSON.stringify({ state: "opened", createdFrom: "kaneo" });

    expect(rememberOutboundNoteId(existing, 1)).toMatchObject({
      state: "opened",
      createdFrom: "kaneo",
    });
  });

  it("bounds the remembered ids so metadata cannot grow without limit", () => {
    let raw: string | null = null;
    for (let id = 1; id <= 60; id++) {
      raw = JSON.stringify(rememberOutboundNoteId(raw, id));
    }

    expect(isOutboundNoteId(raw, 60)).toBe(true);
    expect(isOutboundNoteId(raw, 11)).toBe(true);
    expect(isOutboundNoteId(raw, 10)).toBe(false);
  });

  it("survives metadata that is absent or not valid JSON", () => {
    expect(isOutboundNoteId(null, 1)).toBe(false);
    expect(isOutboundNoteId("not json", 1)).toBe(false);
    expect(rememberOutboundNoteId("not json", 5)).toEqual({
      outboundNoteIds: [5],
    });
  });
});
