import { describe, expect, it } from "vite-plus/test";
import { formatTelegramMention } from "../../../apps/api/src/plugins/telegram/mention";

describe("formatTelegramMention", () => {
  it.each([
    [{ name: "Alex", telegramHandle: "alex" }, "@alex"],
    [
      { name: "Alex", telegramHandle: "123456789" },
      '<a href="tg://user?id=123456789">Alex</a>',
    ],
    [{ name: "A & B", telegramHandle: null }, "A &amp; B"],
    [
      { name: "A <B>", telegramHandle: "123" },
      '<a href="tg://user?id=123">A &lt;B&gt;</a>',
    ],
  ])("formats %p as %p", (identity, expected) => {
    expect(formatTelegramMention(identity)).toBe(expected);
  });
});
