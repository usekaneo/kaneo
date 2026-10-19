import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  isCustomAvatarUrl,
  MAX_AVATAR_BYTES,
} from "../../../apps/api/src/user/avatar";
import {
  extractGooglePictureFromIdToken,
  fetchGoogleAvatar,
  fetchGoogleUserInfoPicture,
  GOOGLE_USERINFO_URL,
  isAllowedGoogleAvatarUrl,
} from "../../../apps/api/src/user/google-avatar";

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
]);

function makeJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("google-avatar helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates allowed Google avatar URLs", () => {
    expect(
      isAllowedGoogleAvatarUrl("https://lh3.googleusercontent.com/a/photo=s96"),
    ).toBe(true);
    expect(isAllowedGoogleAvatarUrl("https://yt3.ggpht.com/a/photo")).toBe(
      true,
    );
    expect(
      isAllowedGoogleAvatarUrl(
        ["http", "://lh3.googleusercontent.com/a/photo"].join(""),
      ),
    ).toBe(false);
    expect(
      isAllowedGoogleAvatarUrl(
        "https://user:pass@lh3.googleusercontent.com/a/photo",
      ),
    ).toBe(false);
    expect(isAllowedGoogleAvatarUrl("https://evil.example.com/photo.png")).toBe(
      false,
    );
  });

  it("extracts picture claim from a Google ID token", () => {
    const token = makeJwt({
      sub: "123",
      picture: "https://lh3.googleusercontent.com/a/avatar",
    });
    expect(extractGooglePictureFromIdToken(token)).toBe(
      "https://lh3.googleusercontent.com/a/avatar",
    );
    expect(extractGooglePictureFromIdToken(makeJwt({ sub: "123" }))).toBeNull();
    expect(extractGooglePictureFromIdToken("not-a-jwt")).toBeNull();
  });

  it("distinguishes custom Kaneo avatars from Google-synced and external avatars", () => {
    expect(isCustomAvatarUrl("/api/user/avatar/clxyz123")).toBe(true);
    expect(isCustomAvatarUrl("/api/user/avatar/google-clxyz123")).toBe(false);
    expect(
      isCustomAvatarUrl("https://lh3.googleusercontent.com/a/avatar"),
    ).toBe(false);
    expect(isCustomAvatarUrl(null)).toBe(false);
  });

  it("fetches and validates a Google avatar image", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(PNG_BYTES, {
        status: 200,
        headers: { "content-type": "image/png; charset=binary" },
      }),
    );

    const result = await fetchGoogleAvatar(
      "https://lh3.googleusercontent.com/a/avatar",
    );
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result).toEqual({
      mimeType: "image/png",
      bytes: PNG_BYTES,
    });
  });

  it("rejects untrusted URLs, oversized images, and magic-byte mismatches", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(
      await fetchGoogleAvatar("https://example.com/avatar.png"),
    ).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockResolvedValueOnce(
      new Response(PNG_BYTES, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": String(MAX_AVATAR_BYTES + 1),
        },
      }),
    );
    expect(
      await fetchGoogleAvatar("https://lh3.googleusercontent.com/a/oversized"),
    ).toBeNull();

    fetchSpy.mockResolvedValueOnce(
      new Response(Buffer.from("<html>not png</html>"), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    expect(
      await fetchGoogleAvatar("https://lh3.googleusercontent.com/a/mismatch"),
    ).toBeNull();
  });

  it("fetches picture URL from Google userinfo endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          sub: "123",
          picture: "https://lh3.googleusercontent.com/a/from-userinfo",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const url = await fetchGoogleUserInfoPicture("ya29.test-token");
    expect(url).toBe("https://lh3.googleusercontent.com/a/from-userinfo");
    expect(fetchSpy).toHaveBeenCalledWith(
      GOOGLE_USERINFO_URL,
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          Authorization: "Bearer ya29.test-token",
        },
      }),
    );
  });
});
