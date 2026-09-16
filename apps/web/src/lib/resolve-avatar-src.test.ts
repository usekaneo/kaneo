import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAvatarSrc } from "./resolve-avatar-src";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveAvatarSrc", () => {
  it("points an uploaded avatar at the API origin", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");

    expect(resolveAvatarSrc("/api/user/avatar/abc123")).toBe(
      "https://api.example.com/api/user/avatar/abc123",
    );
  });

  it("leaves provider avatars untouched", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");

    expect(resolveAvatarSrc("https://avatars.githubusercontent.com/u/1")).toBe(
      "https://avatars.githubusercontent.com/u/1",
    );
  });

  it("passes through empty and undefined values", () => {
    expect(resolveAvatarSrc("")).toBe("");
    expect(resolveAvatarSrc(undefined)).toBeUndefined();
  });
});
