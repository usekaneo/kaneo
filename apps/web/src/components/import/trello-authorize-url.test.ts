import { brand } from "@kaneo/branding";
import { describe, expect, it } from "vite-plus/test";
import { trelloAuthorizeUrl } from "@/components/import/trello-authorize-url";

describe("trelloAuthorizeUrl", () => {
  it("asks Trello for a read-only token that expires in a day", () => {
    const url = new URL(trelloAuthorizeUrl(" abc123 ")!);
    expect(url.origin + url.pathname).toBe("https://trello.com/1/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      expiration: "1day",
      scope: "read",
      response_type: "token",
      name: brand.name,
      key: "abc123",
    });
  });

  it("encodes the key", () => {
    expect(trelloAuthorizeUrl("a&b")).toContain("key=a%26b");
  });

  it("has no link until a key is typed", () => {
    expect(trelloAuthorizeUrl("   ")).toBeNull();
  });
});
