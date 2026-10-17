import { describe, expect, it } from "vite-plus/test";
import { toTimeEntryJson } from "./time-entry-json.js";

const now = new Date("2026-10-08T12:00:00.000Z");

describe("toTimeEntryJson", () => {
  it("shapes a finished entry", () => {
    expect(
      toTimeEntryJson(
        {
          id: "e1",
          taskId: "t1",
          userId: "u1",
          userName: "Ada Lovelace",
          description: "Pairing",
          startTime: "2026-10-08T09:00:00.000Z",
          endTime: "2026-10-08T10:30:00.000Z",
          duration: 5400,
        },
        "KAN-12",
        now,
      ),
    ).toEqual({
      id: "e1",
      taskId: "t1",
      ticketId: "KAN-12",
      user: { id: "u1", name: "Ada Lovelace" },
      startedAt: "2026-10-08T09:00:00.000Z",
      endedAt: "2026-10-08T10:30:00.000Z",
      durationSeconds: 5400,
      note: "Pairing",
      running: false,
    });
  });

  it("counts a running entry to now and turns an empty note into null", () => {
    const json = toTimeEntryJson(
      {
        id: "e2",
        taskId: "t1",
        userId: "u1",
        description: "",
        startTime: "2026-10-08T11:00:00.000Z",
        endTime: null,
        duration: null,
      },
      null,
      now,
      "Ada Lovelace",
    );
    expect(json.running).toBe(true);
    expect(json.durationSeconds).toBe(3600);
    expect(json.note).toBeNull();
    expect(json.user).toEqual({ id: "u1", name: "Ada Lovelace" });
  });

  it("keeps entries whose user was removed", () => {
    expect(
      toTimeEntryJson(
        {
          id: "e3",
          taskId: "t1",
          userId: null,
          description: null,
          startTime: "2026-10-08T09:00:00.000Z",
          endTime: "2026-10-08T09:10:00.000Z",
          duration: 600,
        },
        "KAN-12",
        now,
      ).user,
    ).toBeNull();
  });
});
