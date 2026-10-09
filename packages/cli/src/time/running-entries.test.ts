import { describe, expect, it } from "vite-plus/test";
import { runningEntries } from "./running-entries.js";

const entry = (
  id: string,
  userId: string | null,
  startTime: string,
  endTime: string | null,
) => ({ id, userId, startTime, endTime });

describe("runningEntries", () => {
  it("keeps only my open entries, newest first", () => {
    const entries = [
      entry(
        "done",
        "me",
        "2026-10-08T08:00:00.000Z",
        "2026-10-08T09:00:00.000Z",
      ),
      entry("older", "me", "2026-10-08T09:00:00.000Z", null),
      entry("theirs", "someone", "2026-10-08T11:00:00.000Z", null),
      entry("newer", "me", "2026-10-08T10:00:00.000Z", null),
      entry("orphan", null, "2026-10-08T11:30:00.000Z", null),
    ];
    expect(runningEntries(entries, "me").map((e) => e.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("finds nothing when every entry is closed", () => {
    expect(
      runningEntries(
        [
          entry(
            "a",
            "me",
            "2026-10-08T08:00:00.000Z",
            "2026-10-08T08:30:00.000Z",
          ),
        ],
        "me",
      ),
    ).toEqual([]);
  });
});
