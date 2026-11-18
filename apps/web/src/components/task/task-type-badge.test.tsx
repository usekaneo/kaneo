import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import TaskTypeBadge from "./task-type-badge";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const bug = { type: "bug" } as Task;
const task = { type: "task" } as Task;
const legacyTask = {} as Task;

describe("TaskTypeBadge", () => {
  it("labels a bug with the bug translation", () => {
    render(<TaskTypeBadge task={bug} />);

    expect(screen.getByText("tasks:type.bug")).toBeInTheDocument();
    expect(screen.queryByText("tasks:type.task")).toBeNull();
  });

  it("labels a task with the task translation", () => {
    render(<TaskTypeBadge task={task} />);

    expect(screen.getByText("tasks:type.task")).toBeInTheDocument();
    expect(screen.queryByText("tasks:type.bug")).toBeNull();
  });

  it("falls back to the task label when the type is missing", () => {
    render(<TaskTypeBadge task={legacyTask} />);

    expect(screen.getByText("tasks:type.task")).toBeInTheDocument();
  });
});
