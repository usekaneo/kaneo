import { describe, expect, it } from "vite-plus/test";
import type { Avatar } from "./avatar.js";
import { placeAvatar } from "./avatar-layout.js";

const account = ["", "  ✓ Ada", "", "    Server     kaneo.test", ""];

const picture = (placement: Avatar["placement"]): Avatar => ({
  lines: ["AAAA", "BBBB", "CCCC", "DDDD", "EEEE"],
  columns: 4,
  placement,
});

describe("placeAvatar", () => {
  it("leaves the account alone without an avatar", () => {
    expect(placeAvatar(account, null, 80)).toEqual(account);
  });

  it("puts block avatars to the left of the account", () => {
    expect(placeAvatar(account, picture("beside"), 80)).toEqual([
      "",
      "  AAAA",
      "  BBBB   ✓ Ada",
      "  CCCC",
      "  DDDD     Server     kaneo.test",
      "  EEEE",
      "",
    ]);
  });

  it("stacks the avatar above in narrow terminals and for graphics", () => {
    const above = [
      "",
      "  AAAA",
      "  BBBB",
      "  CCCC",
      "  DDDD",
      "  EEEE",
      ...account,
    ];
    expect(placeAvatar(account, picture("beside"), 40)).toEqual(above);
    expect(placeAvatar(account, picture("above"), 120)).toEqual(above);
  });
});
