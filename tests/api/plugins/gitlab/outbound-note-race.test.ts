import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    // The stored metadata, standing in for the external_link row.
    metadata: null as string | null,
    lockedReads: 0,
  };

  return {
    state,
    db: {
      transaction: async (
        run: (tx: Record<string, unknown>) => Promise<unknown>,
      ) =>
        run({
          select: () => ({
            from: () => ({
              where: () => ({
                for: async () => {
                  state.lockedReads += 1;
                  return [{ metadata: state.metadata }];
                },
              }),
            }),
          }),
          update: () => ({
            set: (values: { metadata: string }) => {
              state.metadata = values.metadata;
              return { where: async () => undefined };
            },
          }),
        }),
    },
  };
});

vi.mock("../../../../apps/api/src/database", () => ({ default: mocks.db }));

const { isOutboundNoteId, recordOutboundNoteId } = await import(
  "../../../../apps/api/src/plugins/gitlab/utils/outbound-notes"
);

beforeEach(() => {
  mocks.state.metadata = JSON.stringify({ state: "opened" });
  mocks.state.lockedReads = 0;
});

describe("recordOutboundNoteId", () => {
  it("re-reads the row under a lock before merging", async () => {
    await recordOutboundNoteId("link-1", 1);

    expect(mocks.state.lockedReads).toBe(1);
    expect(isOutboundNoteId(mocks.state.metadata, 1)).toBe(true);
  });

  it("keeps both ids when two comments are recorded in sequence", async () => {
    await recordOutboundNoteId("link-1", 1);
    await recordOutboundNoteId("link-1", 2);

    expect(isOutboundNoteId(mocks.state.metadata, 1)).toBe(true);
    expect(isOutboundNoteId(mocks.state.metadata, 2)).toBe(true);
  });

  it("does not clobber an id written between this handler's read and write", async () => {
    // Reading the stale in-memory metadata instead of re-reading under the lock
    // would drop id 1, letting that note's echo through as a duplicate comment.
    const stale = mocks.state.metadata;
    await recordOutboundNoteId("link-1", 1);

    expect(isOutboundNoteId(stale, 1)).toBe(false);

    await recordOutboundNoteId("link-1", 2);

    expect(isOutboundNoteId(mocks.state.metadata, 1)).toBe(true);
    expect(isOutboundNoteId(mocks.state.metadata, 2)).toBe(true);
  });

  it("leaves the rest of the link metadata intact", async () => {
    await recordOutboundNoteId("link-1", 7);

    expect(JSON.parse(mocks.state.metadata as string)).toMatchObject({
      state: "opened",
    });
  });
});
