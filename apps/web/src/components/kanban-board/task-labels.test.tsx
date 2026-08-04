import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskLabels } from "./task-labels";

const useGetLabelsByTask = vi.fn();

vi.mock("@/hooks/queries/label/use-get-labels-by-task", () => ({
  default: (...args: unknown[]) => useGetLabelsByTask(...args),
}));

afterEach(() => {
  cleanup();
  useGetLabelsByTask.mockReset();
});

describe("TaskLabels", () => {
  it("renders labels supplied by the task without fetching them", () => {
    render(
      <TaskLabels labels={[{ id: "label-1", name: "Bug", color: "red" }]} />,
    );

    expect(screen.getByText("Bug")).toBeVisible();
    expect(useGetLabelsByTask).not.toHaveBeenCalled();
  });
});
