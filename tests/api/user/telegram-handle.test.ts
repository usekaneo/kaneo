import { describe, expect, it } from "vite-plus/test";
import {
  normalizeTelegramHandle,
  TelegramHandleError,
} from "../../../apps/api/src/user/telegram-handle";

describe("normalizeTelegramHandle", () => {
  it.each([
    ["@Alex_Name", "alex_name"],
    ["alex_name", "alex_name"],
    ["t.me/alex_name", "alex_name"],
    ["telegram.me/alex_name", "alex_name"],
    ["https://t.me/alex_name", "alex_name"],
    ["123456789", "123456789"],
    ["  123456789  ", "123456789"],
    ["", null],
    ["   ", null],
    [null, null],
    [undefined, null],
  ])("normalizes %p to %p", (input, expected) => {
    expect(normalizeTelegramHandle(input)).toBe(expected);
  });

  it.each([
    "ab",
    "1alex",
    "alex-name",
    "alex name",
    "a".repeat(33),
    "0",
    "99999999999999999999",
    123,
    {},
  ])("rejects %p", (input) => {
    expect(() => normalizeTelegramHandle(input)).toThrow(TelegramHandleError);
  });
});
