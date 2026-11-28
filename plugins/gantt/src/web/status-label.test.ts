import { describe, expect, it } from "vite-plus/test";
import { statusLabel } from "./status-label.js";

const columns = [
  { id: "in-progress", name: "Doing", slug: "in-progress", isFinal: false },
];
const t = (key: string) => `t:${key}`;

describe("statusLabel", () => {
  it("uses the project's column name", () => {
    expect(statusLabel("in-progress", columns, t)).toBe("Doing");
  });

  it("translates planned tasks, which have no column", () => {
    expect(statusLabel("planned", columns, t)).toBe("t:status.planned");
  });

  it("falls back to a readable form of unknown statuses", () => {
    expect(statusLabel("waiting_on-review", columns, t)).toBe(
      "Waiting On Review",
    );
  });
});
