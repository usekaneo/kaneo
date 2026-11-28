import { describe, expect, it } from "vite-plus/test";
import { arrangeQuickFilterMembers } from "./quick-filter-members";

const member = (id: string, name: string) => ({ userId: id, user: { name } });

describe("arrangeQuickFilterMembers", () => {
  it("puts the viewer first and sorts the rest by name", () => {
    const { visible } = arrangeQuickFilterMembers(
      [member("b", "Bea"), member("me", "Zed"), member("a", "Al")],
      [],
      "me",
    );
    expect(visible.map((item) => item.userId)).toEqual(["me", "a", "b"]);
  });

  it("moves members beyond the limit into the overflow", () => {
    const members = Array.from({ length: 5 }, (_, i) =>
      member(`u${i}`, `U${i}`),
    );
    const { visible, overflow } = arrangeQuickFilterMembers(
      members,
      [],
      "x",
      3,
    );
    expect(visible.map((item) => item.userId)).toEqual(["u0", "u1", "u2"]);
    expect(overflow.map((item) => item.userId)).toEqual(["u3", "u4"]);
  });

  it("keeps a selected member visible even past the limit", () => {
    const members = Array.from({ length: 5 }, (_, i) =>
      member(`u${i}`, `U${i}`),
    );
    const { visible, overflow } = arrangeQuickFilterMembers(
      members,
      ["u4"],
      "x",
      3,
    );
    expect(visible.map((item) => item.userId)).toEqual([
      "u0",
      "u1",
      "u2",
      "u4",
    ]);
    expect(overflow.map((item) => item.userId)).toEqual(["u3"]);
  });
});
