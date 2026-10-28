import { describe, expect, it } from "vite-plus/test";
import {
  getExpirationSeconds,
  isApiKeyExpiration,
} from "./api-key-expirations";

describe("API key expirations", () => {
  it("maps each choice to the seconds sent to the API", () => {
    expect(getExpirationSeconds("1d")).toBe(86_400);
    expect(getExpirationSeconds("7d")).toBe(604_800);
    expect(getExpirationSeconds("30d")).toBe(2_592_000);
    expect(getExpirationSeconds("90d")).toBe(7_776_000);
    expect(getExpirationSeconds("never")).toBeNull();
  });

  it("recognizes only known choices", () => {
    expect(isApiKeyExpiration("30d")).toBe(true);
    expect(isApiKeyExpiration("never")).toBe(true);
    expect(isApiKeyExpiration("365d")).toBe(false);
    expect(isApiKeyExpiration(undefined)).toBe(false);
  });
});
