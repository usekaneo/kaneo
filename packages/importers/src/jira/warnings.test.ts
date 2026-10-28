import { describe, expect, it } from "vite-plus/test";
import { BOARD_UNAVAILABLE_WARNING, buildWarnings } from "./warnings.js";

describe("buildWarnings", () => {
  it("stays quiet when nothing was dropped", () => {
    expect(
      buildWarnings({
        issuesWithAttachments: 0,
        externalLinks: 0,
        boardUnavailable: false,
      }),
    ).toEqual([]);
  });

  it("counts attachments and outside links in singular and plural", () => {
    expect(
      buildWarnings({
        issuesWithAttachments: 1,
        externalLinks: 1,
        boardUnavailable: false,
      }),
    ).toEqual([
      "1 issue has attachments, which are not imported.",
      "1 parent or issue link points to another project, so it was not imported.",
    ]);
    expect(
      buildWarnings({
        issuesWithAttachments: 3,
        externalLinks: 2,
        boardUnavailable: true,
      }),
    ).toEqual([
      "3 issues have attachments, which are not imported.",
      "2 parent or issue links point to other projects, so they were not imported.",
      BOARD_UNAVAILABLE_WARNING,
    ]);
  });
});
