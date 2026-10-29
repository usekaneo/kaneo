import { expect, it } from "vite-plus/test";
import { i18n } from "@/lib/i18n";
import { formatDateCondition } from "./format-date-condition";

it("shows both chosen dates and the comparison in chip labels", () => {
  const t = i18n.getFixedT("en-US");
  expect(formatDateCondition("exact:2026-10-15", t)).toBe("On Oct 15, 2026");
  expect(formatDateCondition("before:2026-10-15", t)).toBe(
    "Before Oct 15, 2026",
  );
  expect(formatDateCondition("after:2026-10-15", t)).toBe("After Oct 15, 2026");
  expect(formatDateCondition("range:2026-10-01:2026-10-15", t)).toBe(
    "Oct 1, 2026 – Oct 15, 2026",
  );
});
