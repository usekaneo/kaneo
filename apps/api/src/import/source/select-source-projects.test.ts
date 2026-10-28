import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vite-plus/test";
import { selectSourceProjects } from "./select-source-projects";

const available = [
  { id: "1", name: "Website" },
  { id: "2", name: "  Mobile  ", detail: "Team A" },
  { id: "3", name: " " },
];

describe("selectSourceProjects", () => {
  it("keeps the requested order and takes names from the source", () => {
    expect(
      selectSourceProjects(["3", "2", "1"], available, "PLANKA").map(
        ({ sourceId, name, status }) => ({ sourceId, name, status }),
      ),
    ).toEqual([
      { sourceId: "3", name: "Untitled project", status: "pending" },
      { sourceId: "2", name: "Mobile", status: "pending" },
      { sourceId: "1", name: "Website", status: "pending" },
    ]);
  });

  it("refuses projects the source no longer lists", () => {
    expect(() => selectSourceProjects(["1", "9"], available, "Linear")).toThrow(
      HTTPException,
    );
    expect(() => selectSourceProjects(["8", "9"], available, "Linear")).toThrow(
      "2 selected projects are no longer available in Linear. Refresh the list and try again.",
    );
  });
});
