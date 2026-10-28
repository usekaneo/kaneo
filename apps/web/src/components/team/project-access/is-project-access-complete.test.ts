import { describe, expect, it } from "vite-plus/test";
import { isProjectAccessComplete } from "./is-project-access-complete";

describe("isProjectAccessComplete", () => {
  it("requires at least one project when access is limited", () => {
    expect(
      isProjectAccessComplete({ projectAccess: "all", projectIds: [] }),
    ).toBe(true);
    expect(
      isProjectAccessComplete({ projectAccess: "selected", projectIds: [] }),
    ).toBe(false);
    expect(
      isProjectAccessComplete({ projectAccess: "selected", projectIds: ["p"] }),
    ).toBe(true);
  });
});
