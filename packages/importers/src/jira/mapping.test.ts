import { describe, expect, it } from "vite-plus/test";
import type { JiraIssue } from "./api-types.js";
import { createJiraHtmlToMarkdown } from "./html.js";
import {
  issueDescription,
  issueNumber,
  mapIssue,
  mapPriority,
} from "./mapping.js";

const toMarkdown = createJiraHtmlToMarkdown("https://acme.atlassian.net");

describe("mapPriority", () => {
  it.each([
    ["Highest", "urgent"],
    ["Blocker", "urgent"],
    ["critical", "urgent"],
    ["High", "high"],
    ["Major", "high"],
    ["Medium", "medium"],
    ["Low", "low"],
    ["Minor", "low"],
    ["Lowest", "low"],
    [" Trivial ", "low"],
    ["P1", "no-priority"],
    ["constructor", "no-priority"],
    [null, "no-priority"],
    [undefined, "no-priority"],
  ])("maps %j to %s", (name, expected) => {
    expect(mapPriority(name)).toBe(expected);
  });
});

describe("issueNumber", () => {
  it.each([
    ["ABC-123", 123],
    ["MY_PROJ-7", 7],
    ["A1-0", undefined],
    ["ABC", undefined],
    ["", undefined],
    [null, undefined],
    ["ABC-99999999999999999999", undefined],
  ])("reads the number of %j", (key, expected) => {
    expect(issueNumber(key)).toBe(expected);
  });
});

describe("issueDescription", () => {
  it("prefers the rendered HTML and falls back to raw wiki text", () => {
    expect(
      issueDescription(
        {
          id: "1",
          key: "ABC-1",
          fields: { description: { type: "doc" } },
          renderedFields: { description: "<p>Hello <b>you</b></p>" },
        },
        toMarkdown,
      ),
    ).toBe("Hello **you**");
    expect(
      issueDescription(
        { id: "1", key: "ABC-1", fields: { description: " h1. Raw " } },
        toMarkdown,
      ),
    ).toBe("h1. Raw");
    expect(
      issueDescription(
        { id: "1", key: "ABC-1", fields: { description: { type: "doc" } } },
        toMarkdown,
      ),
    ).toBe("");
  });
});

describe("mapIssue", () => {
  const issue: JiraIssue = {
    id: "10042",
    key: "ABC-42",
    fields: {
      summary: "  Fix login  ",
      status: { id: "3" },
      priority: { name: "High" },
      assignee: {
        accountId: "5b10",
        displayName: "Ada Lovelace",
        emailAddress: null,
      },
      labels: ["auth", "auth", "ux"],
      duedate: "2024-05-01",
      created: "2024-04-01T08:30:00.000+0200",
    },
    renderedFields: { description: "<p>Steps</p>" },
  };

  it("maps the fields Kaneo keeps", () => {
    expect(
      mapIssue(issue, {
        columnKey: "column-2",
        comments: [{ author: { name: "Grace" }, body: "Hi" }],
        toMarkdown,
      }),
    ).toEqual({
      key: "10042",
      number: 42,
      columnKey: "column-2",
      title: "Fix login",
      description: "Steps",
      priority: "high",
      dueDate: "2024-05-01T00:00:00.000Z",
      createdAt: "2024-04-01T06:30:00.000Z",
      assignee: { name: "Ada Lovelace" },
      labelKeys: ["auth", "ux"],
      comments: [{ author: { name: "Grace" }, body: "Hi" }],
    });
  });

  it("falls back to the issue key as title and leaves out empty fields", () => {
    expect(
      mapIssue(
        { id: "1", key: "ABC-1", fields: { summary: " " } },
        { columnKey: null, comments: [], toMarkdown },
      ),
    ).toEqual({
      key: "1",
      number: 1,
      columnKey: null,
      title: "ABC-1",
      description: "",
      priority: "no-priority",
      labelKeys: [],
      comments: [],
    });
  });
});
