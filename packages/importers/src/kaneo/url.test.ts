import { describe, expect, it } from "vite-plus/test";
import { normalizeKaneoUrl } from "./url.js";

describe("normalizeKaneoUrl", () => {
  it("keeps a plain instance URL", () => {
    expect(normalizeKaneoUrl("https://cloud.kaneo.app")).toBe(
      "https://cloud.kaneo.app",
    );
  });

  it("strips a trailing /api and slashes", () => {
    expect(normalizeKaneoUrl("https://cloud.kaneo.app/api/")).toBe(
      "https://cloud.kaneo.app",
    );
    expect(normalizeKaneoUrl("https://example.com/kaneo/api")).toBe(
      "https://example.com/kaneo",
    );
  });

  it("adds https when the protocol is missing", () => {
    expect(normalizeKaneoUrl("kaneo.example.com/api")).toBe(
      "https://kaneo.example.com",
    );
  });

  it("drops web app routes pasted from the address bar", () => {
    expect(
      normalizeKaneoUrl(
        "https://cloud.kaneo.app/dashboard/workspace/ws1/project/p1/board",
      ),
    ).toBe("https://cloud.kaneo.app");
    expect(normalizeKaneoUrl("http://localhost:5173/auth/sign-in")).toBe(
      "http://localhost:5173",
    );
  });
});
