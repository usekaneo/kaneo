import { describe, expect, it } from "vite-plus/test";
import { mapComments } from "./comments.js";
import { createJiraHtmlToMarkdown } from "./html.js";

const toMarkdown = createJiraHtmlToMarkdown("https://jira.example.com");

describe("mapComments", () => {
  it("orders comments oldest first with Markdown bodies and authors", () => {
    expect(
      mapComments(
        [
          {
            id: "2",
            author: {
              displayName: "Grace Hopper",
              emailAddress: "grace@example.com",
            },
            body: { type: "doc" },
            renderedBody: "<p>Second <b>reply</b></p>",
            created: "2024-03-02T09:00:00.000+0000",
          },
          {
            id: "1",
            author: { displayName: "Ada Lovelace" },
            renderedBody: "<p>First</p>",
            created: "2024-03-01T09:00:00.000+0000",
          },
          {
            id: "3",
            author: null,
            body: " Wiki *text* ",
            created: "2024-03-03T09:00:00.000+0000",
          },
          {
            id: "4",
            author: { emailAddress: "bot@example.com" },
            renderedBody: "<p></p>",
            created: "2024-03-04T09:00:00.000+0000",
          },
        ],
        toMarkdown,
      ),
    ).toEqual([
      {
        author: { name: "Ada Lovelace" },
        body: "First",
        createdAt: "2024-03-01T09:00:00.000Z",
      },
      {
        author: { name: "Grace Hopper", email: "grace@example.com" },
        body: "Second **reply**",
        createdAt: "2024-03-02T09:00:00.000Z",
      },
      {
        author: { name: "Jira user" },
        body: "Wiki *text*",
        createdAt: "2024-03-03T09:00:00.000Z",
      },
    ]);
  });

  it("uses the email as the name when there is no display name", () => {
    expect(
      mapComments(
        [
          {
            author: { emailAddress: "bot@example.com" },
            renderedBody: "<p>Hi</p>",
          },
        ],
        toMarkdown,
      ),
    ).toEqual([
      {
        author: { name: "bot@example.com", email: "bot@example.com" },
        body: "Hi",
      },
    ]);
  });
});
