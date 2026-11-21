import { describe, expect, it } from "vite-plus/test";
import type { Column } from "../api/schemas.js";
import { matchStatus } from "./backlog.js";

const column = (slug: string, name: string, position: number): Column => ({
  id: `column-${slug}`,
  projectId: "project-1",
  slug,
  name,
  position,
  color: null,
  isFinal: slug === "done",
});

const columns = [column("to-do", "To Do", 0), column("done", "Done", 1)];

describe("matchStatus", () => {
  it("matches the backlog by status or name", () => {
    expect(matchStatus(columns, "planned")?.slug).toBe("planned");
    expect(matchStatus(columns, "Backlog")?.slug).toBe("planned");
  });

  it("matches the backlog in a project without columns", () => {
    expect(matchStatus([], "planned")?.slug).toBe("planned");
  });

  it("prefers a real column with the same name", () => {
    const withBacklogColumn = [...columns, column("backlog", "Backlog", 2)];
    expect(matchStatus(withBacklogColumn, "backlog")?.slug).toBe("backlog");
  });

  it("still matches columns first", () => {
    expect(matchStatus(columns, "todo")?.slug).toBe("to-do");
    expect(matchStatus(columns, "blocked")).toBeUndefined();
  });
});
