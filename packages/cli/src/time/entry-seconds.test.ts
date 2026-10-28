import { describe, expect, it } from "vite-plus/test";
import { entrySeconds } from "./entry-seconds.js";

const now = new Date("2026-10-08T12:00:00.000Z");

describe("entrySeconds", () => {
  it("uses the stored duration of a finished entry", () => {
    expect(
      entrySeconds(
        {
          startTime: "2026-10-08T09:00:00.000Z",
          endTime: "2026-10-08T10:00:00.000Z",
          duration: 3600,
        },
        now,
      ),
    ).toBe(3600);
  });

  it("counts a running entry up to now", () => {
    expect(
      entrySeconds(
        {
          startTime: "2026-10-08T10:35:00.000Z",
          endTime: null,
          duration: null,
        },
        now,
      ),
    ).toBe(5100);
  });

  it("falls back to the time range and never goes negative", () => {
    expect(
      entrySeconds(
        {
          startTime: "2026-10-08T09:00:00.000Z",
          endTime: "2026-10-08T09:30:00.000Z",
          duration: null,
        },
        now,
      ),
    ).toBe(1800);
    expect(
      entrySeconds(
        {
          startTime: "2026-10-08T13:00:00.000Z",
          endTime: null,
          duration: null,
        },
        now,
      ),
    ).toBe(0);
  });
});
