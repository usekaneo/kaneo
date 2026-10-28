import { describe, expect, it } from "vite-plus/test";
import { formatCost, formatRunDuration, formatTokens } from "./format-run-meta";

describe("run metadata formatting", () => {
  it("abbreviates token counts", () => {
    expect(formatTokens(14_230, "en-US")).toBe("14.2K");
    expect(formatTokens(512, "en-US")).toBe("512");
  });

  it("formats provider costs and keeps tiny amounts visible", () => {
    expect(formatCost("0.05", "en-US")).toBe("$0.05");
    expect(formatCost("0.0012", "en-US")).toBe("$0.0012");
    expect(formatCost("0", "en-US")).toBe("$0.00");
    expect(formatCost(null, "en-US")).toBeNull();
    expect(formatCost("n/a", "en-US")).toBeNull();
  });

  it("reports how long a finished run took", () => {
    const start = "2026-10-28T10:00:00.000Z";
    expect(formatRunDuration(start, "2026-10-28T10:00:41.000Z", "en-US")).toBe(
      "41s",
    );
    expect(formatRunDuration(start, "2026-10-28T10:03:10.000Z", "en-US")).toBe(
      "3m",
    );
    expect(formatRunDuration(start, null, "en-US")).toBeNull();
  });
});
