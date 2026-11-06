import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createBaseExtensions } from "./base-extensions";
import { KaneoMention } from "./kaneo-mention";

const MARKDOWN = [
  "# Release notes",
  "",
  'Ping <kaneo-mention id="user-1" label="Ada"></kaneo-mention> about this.',
  "",
  "",
  '<kaneo-attachment url="https://kaneo.app/files/report.pdf" filename="report.pdf" mime-type="application/pdf" size="2048" />',
  "",
  "",
  "Related work:",
  "",
  "",
  '<kaneo-issue-link url="https://kaneo.app/dashboard/workspace/w1/project/p1/task/t1" issue-key="KAN-1" task-id="t1" />',
  "",
  "",
  "Demo:",
  "",
  "",
  '<kaneo-embed url="https://www.youtube.com/watch?v=abc123" mode="embed" />',
  "",
  "",
  '<img src="https://kaneo.app/diagram.png" alt="Diagram" width="320" />',
  "",
  "- [ ] Draft",
  "- [x] Review",
  "",
  "",
  "| Name  | Status |",
  "| ----- | ------ |",
  "| Board | Done   |",
  "",
].join("\n");

let editor: Editor | null = null;

function createEditor() {
  editor = new Editor({
    extensions: createBaseExtensions({
      placeholder: "Write something",
      extra: [KaneoMention],
    }),
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("createBaseExtensions", () => {
  it("round-trips Kaneo markdown without changes", () => {
    const instance = createEditor();
    instance.commands.setContent(MARKDOWN, { contentType: "markdown" });

    expect(
      instance
        .getJSON()
        .content?.map((node) => node.content?.[0]?.type ?? node.type),
    ).toEqual([
      "text",
      "text",
      "attachmentCard",
      "text",
      "kaneoIssueLink",
      "text",
      "embedBlock",
      "image",
      "taskItem",
      "tableRow",
    ]);
    expect(instance.getMarkdown()).toBe(MARKDOWN);
  });

  it("serializes custom node attributes into markdown", () => {
    const instance = createEditor();
    instance.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "attachmentCard",
              attrs: {
                url: "https://kaneo.app/files/report.pdf",
                filename: "report.pdf",
                mimeType: "application/pdf",
                size: 2048,
              },
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "kaneoIssueLink",
              attrs: {
                url: "https://kaneo.app/task/t1",
                issueKey: "KAN-1",
                taskId: "t1",
              },
            },
          ],
        },
      ],
    });

    expect(instance.getMarkdown()).toBe(
      [
        "",
        '<kaneo-attachment url="https://kaneo.app/files/report.pdf" filename="report.pdf" mime-type="application/pdf" size="2048" />',
        "",
        "",
        "",
        '<kaneo-issue-link url="https://kaneo.app/task/t1" issue-key="KAN-1" task-id="t1" />',
        "",
      ].join("\n"),
    );
  });
});
