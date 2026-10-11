import { describe, expect, it } from "vite-plus/test";
import type { TrelloCommentAction, TrelloMember } from "./client.js";
import { mapCommentActions } from "./comments.js";

const owner: TrelloMember = {
  id: "m-owner",
  fullName: "Olive Owner",
  email: "olive@example.com",
};

function action(
  id: string,
  cardId: string | null,
  text: string,
  date: string,
  creator?: TrelloMember,
): TrelloCommentAction {
  return {
    id,
    date,
    idMemberCreator: creator?.id ?? null,
    data: { text, ...(cardId ? { card: { id: cardId } } : {}) },
    ...(creator ? { memberCreator: creator } : {}),
  };
}

describe("mapCommentActions", () => {
  it("groups by card, oldest first, with the owner's email only", () => {
    const sam = { id: "m-sam", fullName: "Sam Smith", username: "sam" };
    const comments = mapCommentActions(
      [
        action("a4", "c1", "Newest", "2024-03-04T10:00:00.000Z", sam),
        action("a3", "c2", "Other card", "2024-03-03T10:00:00.000Z", owner),
        action("a2", "c1", "Middle", "2024-03-02T10:00:00.000Z", owner),
        action("a1", "c1", "**Oldest**", "2024-03-01T10:00:00.000Z", sam),
      ],
      owner,
    );

    expect(comments.get("c1")).toEqual([
      {
        author: { name: "Sam Smith" },
        body: "**Oldest**",
        createdAt: "2024-03-01T10:00:00.000Z",
      },
      {
        author: { name: "Olive Owner", email: "olive@example.com" },
        body: "Middle",
        createdAt: "2024-03-02T10:00:00.000Z",
      },
      {
        author: { name: "Sam Smith" },
        body: "Newest",
        createdAt: "2024-03-04T10:00:00.000Z",
      },
    ]);
    expect(comments.get("c2")).toHaveLength(1);
  });

  it("skips comments without a card or text and tolerates unknown authors", () => {
    const comments = mapCommentActions(
      [
        action("a3", null, "Lost", "2024-03-03T10:00:00.000Z"),
        action("a2", "c1", "   ", "2024-03-02T10:00:00.000Z"),
        action("a1", "c1", "Kept", "2024-03-01T10:00:00.000Z"),
      ],
      owner,
    );

    expect([...comments.keys()]).toEqual(["c1"]);
    expect(comments.get("c1")).toEqual([
      { author: {}, body: "Kept", createdAt: "2024-03-01T10:00:00.000Z" },
    ]);
  });
});
