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

  it("uses the card width instead of an arbitrary label-name cap", () => {
    const name = "Client: Totem";
    render(<TaskLabels labels={[{ id: "label-1", name, color: "purple" }]} />);

    const labelName = screen.getByText(name);
    const badge = labelName.closest('[data-slot="badge"]');
    expect(labelName).not.toHaveClass("max-w-20");
    expect(labelName).toHaveClass("min-w-0", "truncate");
    expect(labelName).toHaveAttribute("title", name);
    expect(badge).toHaveClass("max-w-full", "min-w-0");
    expect(badge?.querySelector('[aria-hidden="true"]')).toHaveClass(
      "shrink-0",
    );
  });
});
