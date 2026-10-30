import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { PublicTaskCard } from "@/components/public-project/task-card";
import { PublicTaskRow } from "@/components/public-project/task-row";
import type { ExternalLink } from "@/types/external-link";
import type Task from "@/types/task";
import { TaskPullRequests } from ".";

const onParentClick = vi.fn();

beforeAll(() => document.body.addEventListener("click", onParentClick));
afterAll(() => document.body.removeEventListener("click", onParentClick));
afterEach(() => {
  cleanup();
  onParentClick.mockClear();
});

function pullRequest(externalId: string, title: string): ExternalLink {
  return {
    id: `link-${externalId}`,
    taskId: "task-1",
    integrationId: "integration-1",
    resourceType: "pull_request",
    externalId,
    url: `https://github.com/o/r/pull/${externalId}`,
    title,
    metadata: { merged: false, draft: false },
  } as ExternalLink;
}

const task = {
  id: "task-1",
  title: "Linked task",
  number: 1,
  status: "in-progress",
  priority: null,
  dueDate: null,
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
} as unknown as Task;

describe("TaskPullRequests", () => {
  it("links a single pull request without activating its parent", () => {
    render(<TaskPullRequests externalLinks={[pullRequest("42", "Fix it")]} />);

    const link = screen.getByRole("link", { name: /#42/ });
    expect(link).toHaveAttribute("href", "https://github.com/o/r/pull/42");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    fireEvent.click(link);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("lists every pull request in the hover card", async () => {
    render(
      <TaskPullRequests
        externalLinks={[
          pullRequest("42", "Fix it"),
          pullRequest("43", "Follow up"),
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "2 PRs" });
    fireEvent.click(trigger);
    expect(onParentClick).not.toHaveBeenCalled();

    fireEvent.focus(trigger);
    fireEvent.pointerEnter(trigger);
    fireEvent.mouseEnter(trigger);

    const first = await screen.findByRole("link", { name: /Fix it/ });
    const second = screen.getByRole("link", { name: /Follow up/ });
    expect(first).toHaveAttribute("href", "https://github.com/o/r/pull/42");
    expect(second).toHaveAttribute("href", "https://github.com/o/r/pull/43");

    fireEvent.click(second);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it.each([PublicTaskCard, PublicTaskRow])(
    "keeps pull request links outside the public task button",
    (Component) => {
      const onTaskClick = vi.fn();
      render(
        <Component
          task={{ ...task, externalLinks: [pullRequest("42", "Fix it")] }}
          projectSlug="kan"
          onTaskClick={onTaskClick}
        />,
      );

      const taskButton = screen.getByRole("button");
      const link = screen.getByRole("link", { name: /#42/ });
      expect(taskButton).not.toContainElement(link);
      expect(link.closest("button, [role='button']")).toBeNull();

      fireEvent.click(link);
      expect(onTaskClick).not.toHaveBeenCalled();

      fireEvent.click(taskButton);
      expect(onTaskClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: "task-1" }),
      );
    },
  );
});
