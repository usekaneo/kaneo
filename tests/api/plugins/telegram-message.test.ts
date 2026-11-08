import { describe, expect, it } from "vite-plus/test";
import { buildTelegramMessage } from "../../../apps/api/src/plugins/telegram/message";

const base = {
  taskTitle: "Fix login",
  taskNumber: 12,
  projectName: "Web",
  taskUrl: "https://kaneo.test/task/1",
  actorName: "Creator",
  status: "to-do",
  priority: null,
};

describe("buildTelegramMessage", () => {
  it("mentions a username assignee", () => {
    expect(
      buildTelegramMessage("New task created", "Body", {
        ...base,
        assignee: { name: "Alex", telegramHandle: "alex" },
      }),
    ).toContain("<b>Assignee:</b> @alex");
  });

  it("mentions a numeric assignee with an inline link", () => {
    expect(
      buildTelegramMessage("New task created", "Body", {
        ...base,
        assignee: { name: "Alex", telegramHandle: "123" },
      }),
    ).toContain('<b>Assignee:</b> <a href="tg://user?id=123">Alex</a>');
  });

  it("omits the assignee line when there is no assignee", () => {
    expect(
      buildTelegramMessage("New task created", "Body", {
        ...base,
        assignee: null,
      }),
    ).not.toContain("<b>Assignee:</b>");
  });

  it("escapes task titles and names", () => {
    const text = buildTelegramMessage("New task created", "Body", {
      ...base,
      taskTitle: "A & B",
      assignee: { name: "<Alex>", telegramHandle: "123" },
    });
    expect(text).toContain("A &amp; B");
    expect(text).toContain("&lt;Alex&gt;");
  });

  it("renders exactly one Triggered by line", () => {
    const text = buildTelegramMessage("New task created", "Body", {
      ...base,
      assignee: { name: "Alex", telegramHandle: "alex" },
    });
    expect(text.match(/<b>Triggered by:<\/b>/g)).toHaveLength(1);
  });
});
