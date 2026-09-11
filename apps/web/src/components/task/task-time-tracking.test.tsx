import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskTimeTracking } from "./task-time-tracking";

const createEntry = vi.fn();
const updateEntry = vi.fn();
let entries: Array<{
  id: string;
  taskId: string;
  userId: string | null;
  userName: string | null;
  description: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
}> = [];
let canEdit = true;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "u1" } }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => canEdit }),
}));

vi.mock("@/hooks/queries/time-entry/use-get-time-entries", () => ({
  default: () => ({ data: entries, isLoading: false }),
}));

vi.mock("@/hooks/mutations/time-entry/use-create-time-entry", () => ({
  default: () => ({ mutateAsync: createEntry, isPending: false }),
}));

vi.mock("@/hooks/mutations/time-entry/use-update-time-entry", () => ({
  default: () => ({ mutateAsync: updateEntry, isPending: false }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function closed(id: string, userId: string, duration: number) {
  return {
    id,
    taskId: "t1",
    userId,
    userName: userId === "u1" ? "Me" : "Someone",
    description: null,
    startTime: "2026-09-11T10:00:00Z",
    endTime: "2026-09-11T11:00:00Z",
    duration,
  };
}

describe("TaskTimeTracking", () => {
  afterEach(cleanup);

  beforeEach(() => {
    createEntry.mockReset().mockResolvedValue(undefined);
    updateEntry.mockReset().mockResolvedValue(undefined);
    entries = [];
    canEdit = true;
  });

  it("starts a timer when there is no running entry", async () => {
    entries = [closed("e1", "u2", 3600)];
    render(<TaskTimeTracking taskId="t1" />);

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:timeTracking.start" }),
    );

    await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1));
    const arg = createEntry.mock.calls[0][0];
    expect(arg.taskId).toBe("t1");
    expect(typeof arg.startTime).toBe("string");
  });

  it("stops my running entry, sending its start time and an end time", async () => {
    entries = [
      {
        id: "run1",
        taskId: "t1",
        userId: "u1",
        userName: "Me",
        description: null,
        startTime: "2026-09-11T10:00:00Z",
        endTime: null,
        duration: null,
      },
    ];
    render(<TaskTimeTracking taskId="t1" />);

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:timeTracking.stop" }),
    );

    await waitFor(() => expect(updateEntry).toHaveBeenCalledTimes(1));
    const arg = updateEntry.mock.calls[0][0];
    expect(arg.id).toBe("run1");
    expect(arg.startTime).toBe("2026-09-11T10:00:00Z");
    expect(typeof arg.endTime).toBe("string");
  });

  it("hides the timer controls without task-update permission", () => {
    canEdit = false;
    entries = [closed("e1", "u1", 3600)];
    render(<TaskTimeTracking taskId="t1" />);

    expect(
      screen.queryByRole("button", { name: "tasks:timeTracking.start" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "tasks:timeTracking.stop" }),
    ).toBeNull();
  });

  it("shows the summed total of logged time", () => {
    entries = [closed("e1", "u1", 3600), closed("e2", "u2", 900)];
    render(<TaskTimeTracking taskId="t1" />);

    // 3600 + 900 = 4500s = 1h 15m
    expect(screen.getByText("1h 15m")).toBeTruthy();
  });
});
