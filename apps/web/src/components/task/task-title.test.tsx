import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import TaskTitle from "./task-title";

const mocks = vi.hoisted(() => ({
  tasks: new Map<string, { id: string; projectId: string; title: string }>(),
  mutateAsync: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: (taskId: string) => ({ data: mocks.tasks.get(taskId) }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-title", () => ({
  useUpdateTaskTitle: () => ({ mutateAsync: mocks.mutateAsync }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => true }),
}));

const DEBOUNCE_MS = 800;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setServerTitle(title: string, taskId = "task-a") {
  mocks.tasks.set(taskId, { id: taskId, projectId: "project-1", title });
}

function field() {
  return document.querySelector("textarea") as HTMLTextAreaElement;
}

function type(value: string) {
  fireEvent.change(field(), { target: { value } });
}

async function waitForDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(DEBOUNCE_MS);
  });
}

function savedTitles() {
  return mocks.mutateAsync.mock.calls.map((call) => call[0].title);
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.mutateAsync.mockReset().mockResolvedValue({});
  mocks.tasks.clear();
  setServerTitle("Initial");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TaskTitle", () => {
  it("keeps typed text when an older server title arrives mid-edit", async () => {
    const view = render(<TaskTitle taskId="task-a" />);
    fireEvent.focus(field());
    type("Hello");
    await waitForDebounce();
    expect(savedTitles()).toEqual(["Hello"]);

    type("Hello world");
    // A refetch that started before the second edit reports the first save.
    setServerTitle("Hello");
    view.rerender(<TaskTitle taskId="task-a" />);
    expect(field().value).toBe("Hello world");

    // Still editing after blur until the latest text is saved.
    fireEvent.blur(field());
    setServerTitle("Initial");
    view.rerender(<TaskTitle taskId="task-a" />);
    expect(field().value).toBe("Hello world");

    await waitForDebounce();
    expect(savedTitles()).toEqual(["Hello", "Hello world"]);
  });

  it("waits for a running save before sending the latest title", async () => {
    const first = deferred();
    mocks.mutateAsync.mockImplementationOnce(() => first.promise);
    render(<TaskTitle taskId="task-a" />);
    fireEvent.focus(field());

    type("One");
    await waitForDebounce();
    type("One two");
    await waitForDebounce();
    type("One two three");
    await waitForDebounce();
    expect(savedTitles()).toEqual(["One"]);

    await act(async () => {
      first.resolve();
    });
    // Only the newest text is sent; the intermediate edit is skipped.
    expect(savedTitles()).toEqual(["One", "One two three"]);
  });

  it("shows a rename from elsewhere when the user is not editing", () => {
    const view = render(<TaskTitle taskId="task-a" />);
    expect(field().value).toBe("Initial");

    setServerTitle("Renamed by a teammate");
    view.rerender(<TaskTitle taskId="task-a" />);
    expect(field().value).toBe("Renamed by a teammate");
  });

  it("applies a rename that arrived while focused once the field is left", () => {
    const view = render(<TaskTitle taskId="task-a" />);
    fireEvent.focus(field());

    setServerTitle("Renamed by a teammate");
    view.rerender(<TaskTitle taskId="task-a" />);
    expect(field().value).toBe("Initial");

    fireEvent.blur(field());
    expect(field().value).toBe("Renamed by a teammate");
  });

  it("saves a pending edit to the task it was typed in", async () => {
    setServerTitle("Bravo", "task-b");
    const view = render(<TaskTitle taskId="task-a" />);
    fireEvent.focus(field());
    type("Alpha edited");

    view.rerender(<TaskTitle taskId="task-b" />);
    expect(field().value).toBe("Bravo");

    await waitForDebounce();
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({
      id: "task-a",
      title: "Alpha edited",
    });
  });
});
