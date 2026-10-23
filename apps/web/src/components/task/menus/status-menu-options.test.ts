import { describe, expect, it } from "vite-plus/test";
import { statusMenuOptions } from "./status-menu-options";

const columns = [
  { slug: "to-do", name: "To Do", isFinal: false },
  { slug: "done", name: "Done", isFinal: true },
];

describe("statusMenuOptions", () => {
  it("offers the backlog after the board columns when asked", () => {
    const options = statusMenuOptions(columns, "planned", "Move to backlog");
    expect(options.map((option) => option.value)).toEqual([
      "to-do",
      "done",
      "planned",
    ]);
    expect(options.at(-1)).toMatchObject({
      label: "Move to backlog",
      selected: true,
    });
  });

  it("lists only board columns otherwise", () => {
    expect(
      statusMenuOptions(columns, "to-do").map((option) => option.value),
    ).toEqual(["to-do", "done"]);
  });
});
