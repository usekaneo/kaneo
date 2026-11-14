import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
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
let isLoading = false;
let isFetching = false;
let isError = false;
const refetch = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      if (key === "tasks:timeTracking.durationSeconds")
        return `${values?.seconds}s`;
      if (key === "tasks:timeTracking.durationMinutes")
        return `${values?.minutes}m`;
      if (key === "tasks:timeTracking.durationHoursMinutes")
        return `${values?.hours}h ${values?.minutes}m`;
      return key;
    },
  }),
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "u1" } }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => canEdit }),
}));

vi.mock("@/hooks/queries/time-entry/use-get-time-entries", () => ({
  default: () => ({
    data: entries,
    isLoading,
    isError,
    isFetching: isLoading || isFetching,
    refetch,
  }),
}));

vi.mock("@/hooks/mutations/time-entry/use-create-time-entry", () => ({
  default: () => ({ mutateAsync: createEntry, isPending: false }),
}));

vi.mock("@/hooks/mutations/time-entry/use-update-time-entry", () => ({
  default: () => ({ mutateAsync: updateEntry, isPending: false }),
}));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: toastError },
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
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    createEntry.mockReset().mockResolvedValue(undefined);
    updateEntry.mockReset().mockResolvedValue(undefined);
    toastError.mockReset();
    entries = [];
    canEdit = true;
    isLoading = false;
    isFetching = false;
    isError = false;
    refetch.mockReset();
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

  it("still offers Start when only another user has a running entry", () => {
    entries = [
      {
        id: "run2",
        taskId: "t1",
        userId: "u2",
        userName: "Someone",
        description: null,
        startTime: "2026-09-11T10:00:00Z",
        endTime: null,
        duration: null,
      },
    ];
    render(<TaskTimeTracking taskId="t1" />);

    // Another user's open timer must not present me a Stop for their entry.
    expect(
      screen.getByRole("button", { name: "tasks:timeTracking.start" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "tasks:timeTracking.stop" }),
    ).toBeNull();
  });

  it("toasts an error when starting the timer fails", async () => {
    createEntry.mockRejectedValueOnce(new Error("nope"));
    render(<TaskTimeTracking taskId="t1" />);

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:timeTracking.start" }),
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("tasks:timeTracking.startError"),
    );
  });
  it("disables Start while loading entries", () => {
    isLoading = true;
    render(<TaskTimeTracking taskId="t1" />);
    expect(
      screen.getByRole("button", { name: "tasks:timeTracking.start" }),
    ).toBeDisabled();
  });

  it("offers retry and disables Start when entries cannot be loaded", () => {
    isError = true;
    render(<TaskTimeTracking taskId="t1" />);
    expect(
      screen.getByRole("button", { name: "tasks:timeTracking.start" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:timeTracking.title" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "tasks:timeTracking.loadError",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:timeTracking.retry" }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("ticks the running total and stops ticking when the entry closes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T10:00:05Z"));
    entries = [{ ...closed("run1", "u1", 0), endTime: null, duration: null }];
    const { rerender } = render(<TaskTimeTracking taskId="t1" />);
    expect(screen.getByText("5s")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("6s")).toBeTruthy();
    entries = [closed("run1", "u1", 6)];
    rerender(<TaskTimeTracking taskId="t1" />);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows stopping a cached running entry during a background refresh", async () => {
    entries = [{ ...closed("run1", "u1", 0), endTime: null, duration: null }];
    isFetching = true;
    render(<TaskTimeTracking taskId="t1" />);
    const stop = screen.getByRole("button", {
      name: "tasks:timeTracking.stop",
    });
    expect(stop).toBeEnabled();
    fireEvent.click(stop);
    await waitFor(() => expect(updateEntry).toHaveBeenCalledTimes(1));
  });

  it("toasts an error when stopping fails", async () => {
    entries = [{ ...closed("run1", "u1", 0), endTime: null, duration: null }];
    updateEntry.mockRejectedValueOnce(new Error("nope"));
    render(<TaskTimeTracking taskId="t1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:timeTracking.stop" }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("tasks:timeTracking.stopError"),
    );
  });
});
