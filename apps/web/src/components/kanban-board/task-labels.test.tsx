import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TaskLabels } from "./task-labels";

afterEach(() => {
  cleanup();
});

describe("TaskLabels", () => {
  it("renders labels supplied by the task", () => {
    render(
      <TaskLabels labels={[{ id: "label-1", name: "Bug", color: "red" }]} />,
    );

    expect(screen.getByText("Bug")).toBeVisible();
  });
});
