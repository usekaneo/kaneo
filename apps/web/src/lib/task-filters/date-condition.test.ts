import { expect, it } from "vite-plus/test";
import { matchesDateCondition, parseDateCondition } from "./date-condition";

it.each([
  "exact:2026-02-30",
  "exact:2026-1-1",
  "range:2026-10-01",
  "range:2026-10-15:2026-10-01",
  "range:2026-10-01:2026-10-15:",
  "exact:2026-10-15:2026-10-16",
  "unknown:2026-10-15",
])("rejects malformed saved condition %s", (value) => {
  expect(parseDateCondition(value)).toBeNull();
});

it("compares timestamps using the local calendar, including offset and DST boundaries", () => {
  const date = new Date(2026, 10, 1, 23, 59, 59);
  expect(
    matchesDateCondition(date.toISOString(), {
      operator: "exact",
      date: "2026-11-01",
    }),
  ).toBe(true);
  expect(
    matchesDateCondition("invalid", { operator: "before", date: "2026-11-01" }),
  ).toBe(false);
});
