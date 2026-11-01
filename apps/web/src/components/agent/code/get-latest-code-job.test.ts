import { expect, it } from "vite-plus/test";
import { getLatestCodeJob } from "./get-latest-code-job";

it("picks the most recently created job", () => {
  expect(getLatestCodeJob([])).toBeUndefined();
  expect(
    getLatestCodeJob([
      { id: "a", createdAt: "2026-10-01T10:00:00.000Z" },
      { id: "b", createdAt: "2026-10-01T11:00:00.000Z" },
      { id: "c", createdAt: "2026-10-01T09:00:00.000Z" },
    ])?.id,
  ).toBe("b");
});
