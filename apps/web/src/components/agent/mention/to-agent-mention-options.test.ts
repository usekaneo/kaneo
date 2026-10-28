import { describe, expect, it } from "vite-plus/test";
import { toAgentMentionOptions } from "./to-agent-mention-options";

describe("toAgentMentionOptions", () => {
  it("lists tasks with their ticket id before projects", () => {
    expect(
      toAgentMentionOptions(
        [
          {
            id: "t1",
            type: "task",
            title: "Fix login",
            projectName: "Kaneo Web",
            projectSlug: "WEB",
            taskNumber: 135,
          },
        ],
        [{ id: "p1", type: "project", title: "Launch v3", projectSlug: "LV3" }],
      ),
    ).toEqual([
      {
        type: "task",
        id: "t1",
        label: "Fix login",
        key: "WEB-135",
        context: "Kaneo Web",
      },
      { type: "project", id: "p1", label: "Launch v3", key: "LV3" },
    ]);
  });

  it("caps the list and skips other result types", () => {
    const tasks = Array.from({ length: 10 }, (_, index) => ({
      id: `t${index}`,
      type: "task",
      title: `Task ${index}`,
    }));
    const options = toAgentMentionOptions(tasks, [
      { id: "c1", type: "comment", title: "x" },
    ]);
    expect(options).toHaveLength(8);
    expect(options.every((option) => option.type === "task")).toBe(true);
  });
});
