import { describe, expect, it } from "vite-plus/test";
import { importRunMinutes } from "@/components/import/import-run-minutes";

describe("importRunMinutes", () => {
  it("is unknown until the run finishes", () => {
    expect(importRunMinutes("2026-10-11T10:00:00.000Z", null)).toBeNull();
  });

  it("rounds to whole minutes", () => {
    expect(
      importRunMinutes("2026-10-11T10:00:00.000Z", "2026-10-11T10:03:40.000Z"),
    ).toBe(4);
    expect(
      importRunMinutes("2026-10-11T10:00:00.000Z", "2026-10-11T10:00:20.000Z"),
    ).toBe(0);
  });

  it("ignores clocks that disagree", () => {
    expect(
      importRunMinutes("2026-10-11T10:05:00.000Z", "2026-10-11T10:00:00.000Z"),
    ).toBe(0);
    expect(importRunMinutes("not a date", "2026-10-11T10:00:00.000Z")).toBe(
      null,
    );
  });
});
