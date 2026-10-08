import { describe, expect, it } from "vite-plus/test";
import { absoluteImageUrl, resolveImageUrl, sendsToken } from "./image-url.js";

const api = "https://kaneo.example.com";

describe("resolveImageUrl", () => {
  it("resolves API paths against the server URL", () => {
    expect(resolveImageUrl("/api/user/avatar/a1", api)?.href).toBe(
      "https://kaneo.example.com/api/user/avatar/a1",
    );
    expect(
      resolveImageUrl("/api/asset/x", "https://example.com/kaneo")?.href,
    ).toBe("https://example.com/kaneo/api/asset/x");
  });

  it("keeps absolute links and resolves protocol relative ones", () => {
    expect(resolveImageUrl("https://cdn.test/a.png", api)?.href).toBe(
      "https://cdn.test/a.png",
    );
    expect(resolveImageUrl("//cdn.test/a.png", api)?.href).toBe(
      "https://cdn.test/a.png",
    );
  });

  it("rejects links that are not http", () => {
    expect(resolveImageUrl("data:image/png;base64,AAAA", api)).toBeNull();
    expect(resolveImageUrl("javascript:alert(1)", api)).toBeNull();
    expect(resolveImageUrl("  ", api)).toBeNull();
  });

  it("leaves unusable links as they were when making them absolute", () => {
    expect(absoluteImageUrl("data:x", api)).toBe("data:x");
    expect(absoluteImageUrl("/api/asset/1", api)).toBe(
      "https://kaneo.example.com/api/asset/1",
    );
  });
});

describe("sendsToken", () => {
  const url = (value: string) => new URL(value);

  it("sends the token to assets on the API origin", () => {
    expect(sendsToken(url(`${api}/api/asset/abc`), api)).toBe(true);
  });

  it("never sends it to other hosts, ports or schemes", () => {
    expect(sendsToken(url("https://evil.test/api/asset/abc"), api)).toBe(false);
    expect(
      sendsToken(url("https://kaneo.example.com:8443/api/asset/abc"), api),
    ).toBe(false);
    expect(sendsToken(url("http://kaneo.example.com/api/asset/abc"), api)).toBe(
      false,
    );
    expect(
      sendsToken(url("https://kaneo.example.com.evil.test/api/asset/a"), api),
    ).toBe(false);
  });

  it("keeps it off other API routes, including public avatars", () => {
    expect(sendsToken(url(`${api}/api/user/avatar/a1`), api)).toBe(false);
    expect(sendsToken(url(`${api}/api/task/export/p1`), api)).toBe(false);
  });
});
