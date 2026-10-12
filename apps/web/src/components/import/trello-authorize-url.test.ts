import { describe, expect, it } from "vite-plus/test";
import { trelloAuthorizeUrl } from "@/components/import/trello-authorize-url";

describe("trelloAuthorizeUrl", () => {
  it("asks Trello for a read-only token that expires in a day", () => {
    expect(trelloAuthorizeUrl(" abc123 ")).toBe(
      "https://trello.com/1/authorize?expiration=1day&scope=read&response_type=token&name=Kaneo&key=abc123",
    );
  });

  it("encodes the key", () => {
    expect(trelloAuthorizeUrl("a&b")).toContain("key=a%26b");
  });

  it("has no link until a key is typed", () => {
    expect(trelloAuthorizeUrl("   ")).toBeNull();
  });
});
