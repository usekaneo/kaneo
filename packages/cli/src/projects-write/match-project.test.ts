import { describe, expect, it } from "vite-plus/test";
import { matchProjectRecord } from "./match-project.js";

const projects = [
  { id: "p1", slug: "KAN", name: "Kaneo Web" },
  { id: "p2", slug: "mob", name: "Mobile App" },
];

describe("matchProjectRecord", () => {
  it("matches by id, key and name without regard to case", () => {
    expect(matchProjectRecord(projects, "p2")?.id).toBe("p2");
    expect(matchProjectRecord(projects, "MOB")?.id).toBe("p2");
    expect(matchProjectRecord(projects, " kan ")?.id).toBe("p1");
    expect(matchProjectRecord(projects, "kaneo web")?.id).toBe("p1");
  });

  it("returns nothing for an unknown project", () => {
    expect(matchProjectRecord(projects, "XYZ")).toBeUndefined();
  });
});
