import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { matchNotificationId } from "./match-notification.js";

const known = [
  "abcd1234efgh5678ijkl9012",
  "abcd9999efgh5678ijkl9012",
  "zyxw1234efgh5678ijkl9012",
];

const match = (reference: string) => {
  const result = matchNotificationId(known, reference);
  return Result.isSuccess(result) ? result.success : result.failure.message;
};

describe("matchNotificationId", () => {
  it("accepts full ids and unique prefixes", () => {
    expect(match("abcd1234efgh5678ijkl9012")).toBe("abcd1234efgh5678ijkl9012");
    expect(match("zyxw")).toBe("zyxw1234efgh5678ijkl9012");
    expect(match("abcd1")).toBe("abcd1234efgh5678ijkl9012");
  });

  it("refuses ambiguous and too-short prefixes", () => {
    expect(match("abcd")).toBe('"abcd" matches 2 notifications.');
    expect(match("zyx")).toBe('No recent notification matches "zyx".');
  });

  it("passes older full ids through to the server", () => {
    expect(match("qqqq1234efgh5678ijkl9012")).toBe("qqqq1234efgh5678ijkl9012");
  });
});
