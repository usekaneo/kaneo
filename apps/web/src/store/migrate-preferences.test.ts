import { describe, expect, it } from "vite-plus/test";
import { migratePreferences } from "./migrate-preferences";

describe("migratePreferences", () => {
  it("moves a stored core Gantt layout to the Gantt plugin's layout", () => {
    expect(
      migratePreferences({ taskLayout: "gantt", viewMode: "list" }, 0),
    ).toEqual({ taskLayout: "plugin:gantt:timeline", viewMode: "list" });
  });

  it("keeps other layouts and already migrated state as they are", () => {
    const calendar = { taskLayout: "calendar" };
    expect(migratePreferences(calendar, 0)).toBe(calendar);
    const current = { taskLayout: "gantt" };
    expect(migratePreferences(current, 1)).toBe(current);
    expect(migratePreferences(null, 0)).toBeNull();
  });
});
