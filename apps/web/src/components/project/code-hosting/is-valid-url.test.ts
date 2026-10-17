import { describe, expect, it } from "vite-plus/test";
import { isValidUrl } from "./is-valid-url";

describe("isValidUrl", () => {
  it("accepts absolute URLs and rejects anything else", () => {
    expect(isValidUrl(" https://gitea.example.com ")).toBe(true);
    expect(isValidUrl("gitea.example.com")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});
