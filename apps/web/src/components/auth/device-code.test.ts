import { expect, it } from "vite-plus/test";
import { formatDeviceCode, normalizeDeviceCode } from "./device-code";

it.each([
  [" wdjb-mjht ", "WDJBMJHT"],
  ["wdjb mjht", "WDJBMJHT"],
  [undefined, ""],
])("normalizes %j", (input, expected) => {
  expect(normalizeDeviceCode(input)).toBe(expected);
});

it.each([
  ["WDJBMJHT", "WDJB-MJHT"],
  ["ABC123", "ABC-123"],
  ["ABCDE", "ABCDE"],
])("formats %s for reading", (input, expected) => {
  expect(formatDeviceCode(input)).toBe(expected);
});
