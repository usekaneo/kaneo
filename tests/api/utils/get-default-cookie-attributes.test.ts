import { describe, expect, it } from "vitest";
import { getDefaultCookieAttributes } from "../../../apps/api/src/utils/get-default-cookie-attributes";

describe("getDefaultCookieAttributes", () => {
  it("marks same-domain HTTPS cookies as secure", () => {
    expect(
      getDefaultCookieAttributes({
        apiUrl: "https://kaneo.example.com/api",
        clientUrl: "https://kaneo.example.com",
      }),
    ).toEqual({
      sameSite: "lax",
      secure: true,
      partitioned: false,
      domain: undefined,
    });
  });

  it("uses cross-subdomain attributes for HTTPS deployments", () => {
    expect(
      getDefaultCookieAttributes({
        apiUrl: "https://api.example.com",
        clientUrl: "https://app.example.com",
        cookieDomain: ".example.com",
      }),
    ).toEqual({
      sameSite: "none",
      secure: true,
      partitioned: true,
      domain: ".example.com",
    });
  });

  it("keeps local HTTP cookies compatible with development", () => {
    expect(
      getDefaultCookieAttributes({
        apiUrl: "http://localhost:1337",
        clientUrl: "http://localhost:5173",
      }),
    ).toEqual({
      sameSite: "lax",
      secure: false,
      partitioned: false,
      domain: undefined,
    });
  });
});
