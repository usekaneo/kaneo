import { describe, expect, it } from "vite-plus/test";
import type { TimeEntryWithUser } from "../api/time-entries.js";
import { summarizeTime } from "./time-summary.js";

const now = new Date("2026-10-07T12:00:00.000Z");

const entry = (
  overrides: Partial<TimeEntryWithUser> & { readonly id: string },
): TimeEntryWithUser => ({
  taskId: "t1",
  userId: "u1",
  userName: "Ada Lovelace",
  description: null,
  startTime: "2026-10-07T08:00:00.000Z",
  endTime: "2026-10-07T09:00:00.000Z",
  duration: 3600,
  ...overrides,
});

describe("summarizeTime", () => {
  it("adds up finished entries and the time on running timers", () => {
    expect(
      summarizeTime(
        [
          entry({ id: "e1" }),
          entry({
            id: "e2",
            userId: "u2",
            userName: "Grace Hopper",
            startTime: "2026-10-07T11:30:00.000Z",
            endTime: null,
            duration: null,
          }),
          entry({
            id: "e3",
            startTime: "2026-10-07T11:00:00.000Z",
            endTime: null,
            duration: null,
          }),
        ],
        now,
      ),
    ).toEqual({
      totalSeconds: 3600 + 1800 + 3600,
      running: [
        {
          user: { id: "u1", name: "Ada Lovelace" },
          startedAt: "2026-10-07T11:00:00.000Z",
        },
        {
          user: { id: "u2", name: "Grace Hopper" },
          startedAt: "2026-10-07T11:30:00.000Z",
        },
      ],
    });
  });

  it("reports nothing tracked for a task without entries", () => {
    expect(summarizeTime([], now)).toEqual({ totalSeconds: 0, running: [] });
  });

  it("keeps a running timer without a user", () => {
    expect(
      summarizeTime(
        [entry({ id: "e1", userId: null, endTime: null, duration: null })],
        now,
      ).running,
    ).toEqual([{ user: null, startedAt: "2026-10-07T08:00:00.000Z" }]);
  });
});
