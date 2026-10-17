import { describe, expect, it } from "vite-plus/test";
import type { JiraIssue } from "./api-types.js";
import { issueLabels, LABEL_PALETTE, labelColor, mapLabels } from "./labels.js";

function issue(id: string, labels: string[] | null): JiraIssue {
  return { id, key: `ABC-${id}`, fields: { labels } };
}

describe("labelColor", () => {
  it("picks the same palette color for the same name every time", () => {
    expect(labelColor("frontend")).toBe(labelColor("frontend"));
    expect(LABEL_PALETTE).toContain(labelColor("frontend"));
    expect(labelColor("")).toBe(LABEL_PALETTE[0x811c9dc5 % 8]);
  });

  it("spreads common names over several colors", () => {
    const names = [
      "bug",
      "frontend",
      "backend",
      "ux",
      "tech-debt",
      "security",
      "performance",
      "docs",
      "infra",
      "mobile",
    ];
    expect(new Set(names.map(labelColor)).size).toBeGreaterThan(3);
  });
});

describe("issueLabels", () => {
  it("trims, drops blanks and dedupes", () => {
    expect(issueLabels(issue("1", [" ui ", "ui", "", "api"]))).toEqual([
      "ui",
      "api",
    ]);
    expect(issueLabels(issue("2", null))).toEqual([]);
  });
});

describe("mapLabels", () => {
  it("lists every label used in the project once, sorted by name", () => {
    expect(
      mapLabels([issue("1", ["ux", "Backend"]), issue("2", ["ux", "api"])]),
    ).toEqual([
      { key: "api", name: "api", color: labelColor("api") },
      { key: "Backend", name: "Backend", color: labelColor("Backend") },
      { key: "ux", name: "ux", color: labelColor("ux") },
    ]);
  });
});
