import { describe, expect, it } from "vite-plus/test";
import { isEdited, latest, toCommentJson } from "./comment-json.js";

const comment = {
  id: "c1",
  taskId: "t1",
  userId: "u1",
  content: "Looks good",
  createdAt: "2026-10-08T10:00:00.000Z",
  updatedAt: "2026-10-08T10:00:00.000Z",
  user: { name: "Ada Lovelace" },
};

describe("toCommentJson", () => {
  it("maps the author and keeps the timestamps", () => {
    expect(toCommentJson(comment)).toEqual({
      id: "c1",
      taskId: "t1",
      author: { id: "u1", name: "Ada Lovelace" },
      content: "Looks good",
      createdAt: "2026-10-08T10:00:00.000Z",
      updatedAt: "2026-10-08T10:00:00.000Z",
      edited: false,
    });
  });

  it("leaves the author out when the user is gone", () => {
    expect(
      toCommentJson({ ...comment, userId: null, user: null }).author,
    ).toBeNull();
  });
});

describe("isEdited", () => {
  it("ignores timestamps written in the same moment", () => {
    expect(
      isEdited("2026-10-08T10:00:00.000Z", "2026-10-08T10:00:00.400Z"),
    ).toBe(false);
  });

  it("flags a later update", () => {
    expect(
      isEdited("2026-10-08T10:00:00.000Z", "2026-10-08T10:05:00.000Z"),
    ).toBe(true);
  });

  it("is false for unreadable timestamps", () => {
    expect(isEdited("", "2026-10-08T10:05:00.000Z")).toBe(false);
  });
});

describe("latest", () => {
  it("keeps the newest items in their order", () => {
    expect(latest([1, 2, 3, 4], 2)).toEqual([3, 4]);
  });

  it("keeps everything under the limit", () => {
    expect(latest([1, 2], 5)).toEqual([1, 2]);
  });
});
