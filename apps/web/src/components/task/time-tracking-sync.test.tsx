import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ActiveTimerPill from "@/components/common/active-timer-pill";
import useStartTimeEntry from "@/hooks/mutations/time-entry/use-start-time-entry";
import TaskTimeTracker from "./task-time-tracker";
import TimeEntryForm from "./time-entry-form";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "user-1" } }),
}));

const permissions = {
  canUpdate: true,
};
const initialTimezone = process.env.TZ;

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: () => permissions.canUpdate,
    isCheckingPermissions: false,
  }),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect: (date: Date) => void }) => (
    <button type="button" onClick={() => onSelect(new Date(2026, 2, 29))}>
      select DST date
    </button>
  ),
}));

type Entry = {
  id: string;
  taskId: string;
  userId: string | null;
  userName: string | null;
  description: string | null;
  billable: boolean;
  startTime: string;
  endTime: string | null;
  duration: number | null;
};

const server = {
  running: null as Entry | null,
  entries: [] as Entry[],
  failEntriesNext: false,
};

vi.mock("@/fetchers/time-entry/get-time-entries", () => ({
  default: vi.fn(async () => {
    if (server.failEntriesNext) {
      server.failEntriesNext = false;
      throw new Error("network down");
    }
    return [...server.entries];
  }),
}));

vi.mock("@/fetchers/time-entry/get-running-time-entry", () => ({
  default: vi.fn(async () => (server.running ? { ...server.running } : null)),
}));

vi.mock("@/fetchers/time-entry/stop-time-entry", () => ({
  default: vi.fn(async () => {
    if (!server.running) {
      throw new Error("No running timer found for this task");
    }
    const ended: Entry = {
      ...server.running,
      endTime: new Date().toISOString(),
      duration: 60,
    };
    server.running = null;
    server.entries = server.entries.map((entry) =>
      entry.id === ended.id ? ended : entry,
    );
    return ended;
  }),
}));

function seedRunning() {
  const entry: Entry = {
    id: "entry-1",
    taskId: "task-1",
    userId: "user-1",
    userName: "User",
    description: null,
    billable: true,
    startTime: new Date(Date.now() - 60_000).toISOString(),
    endTime: null,
    duration: null,
  };
  server.running = entry;
  server.entries = [entry];
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  server.running = null;
  server.entries = [];
  server.failEntriesNext = false;
  permissions.canUpdate = true;
  process.env.TZ = initialTimezone;
});

function renderBoth() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ActiveTimerPill />
      <TaskTimeTracker
        taskId="task-1"
        taskTitle="Task"
        workspaceId="workspace-1"
      />
    </QueryClientProvider>,
  );
  return queryClient;
}

vi.mock("@/fetchers/time-entry/start-time-entry", () => ({
  default: vi.fn(async ({ taskId }: { taskId: string }) => {
    const now = new Date().toISOString();
    const stopped =
      server.running && server.running.taskId === taskId
        ? { ...server.running, endTime: now, duration: 3600 }
        : null;
    if (stopped) {
      server.entries = server.entries.map((entry) =>
        entry.id === stopped.id ? stopped : entry,
      );
    }
    const entry: Entry = {
      id: `entry-${Date.now()}`,
      taskId,
      userId: "user-1",
      userName: "User",
      description: null,
      billable: true,
      startTime: now,
      endTime: null,
      duration: null,
    };
    server.running = entry;
    server.entries = [...server.entries, entry];
    return {
      entry,
      stoppedEntryId: stopped?.id ?? null,
      stoppedTaskId: stopped?.taskId ?? null,
      discardedEntryId: null,
      discardedTaskId: null,
    };
  }),
}));

function StartButton({ taskId }: { taskId: string }) {
  const { mutateAsync } = useStartTimeEntry();
  return (
    <button type="button" onClick={() => void mutateAsync({ taskId })}>
      begin
    </button>
  );
}

describe("same-task restart", () => {
  it("invalidates the activity feed alongside the entries", async () => {
    const old = new Date(Date.now() - 3600_000).toISOString();
    const entry: Entry = {
      id: "entry-old",
      taskId: "task-1",
      userId: "user-1",
      userName: "User",
      description: null,
      billable: true,
      startTime: old,
      endTime: null,
      duration: null,
    };
    server.running = entry;
    server.entries = [entry];

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <QueryClientProvider client={queryClient}>
        <StartButton taskId="task-1" />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "begin" }));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["activities", "task-1"],
      }),
    );
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["time-entries", "task-1"],
      }),
    );
  });
});

describe("stop from the top-bar pill", () => {
  it("stops the timer inside the task view without a reload", async () => {
    seedRunning();
    renderBoth();

    // Sanity: the task row shows the live entry.
    await waitFor(() =>
      expect(screen.queryByText("tasks:properties.timeTracked")).toBeNull(),
    );

    // The pill renders before the tracker, so its stop button is first.
    const [pillStop] = screen.getAllByRole("button", {
      name: "tasks:timeTracking.stop",
    });
    fireEvent.click(pillStop);

    // The pill disappears and the task row leaves its live state: no stop
    // buttons remain and the row settles on the ended total.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "tasks:timeTracking.stop" }),
      ).toBeNull(),
    );
    await waitFor(() =>
      expect(screen.getByTitle("0:01:00 · 1")).toBeInTheDocument(),
    );
  });
});

function renderTracker() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <TaskTimeTracker
        taskId="task-1"
        taskTitle="Task"
        workspaceId="workspace-1"
      />
    </QueryClientProvider>,
  );
}

function seedEnded() {
  const entry: Entry = {
    id: "entry-ended",
    taskId: "task-1",
    userId: "user-2",
    userName: "Other",
    description: "pairing",
    billable: true,
    startTime: new Date(Date.now() - 3600_000).toISOString(),
    endTime: new Date(Date.now() - 1800_000).toISOString(),
    duration: 1800,
  };
  server.entries = [entry];
}

describe("read-only viewers", () => {
  it("renders rows inert with no edit or delete controls", async () => {
    permissions.canUpdate = false;
    seedEnded();
    renderTracker();

    fireEvent.click(screen.getAllByRole("button")[0]);
    await waitFor(() => expect(screen.getByText("Other")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Other"));
    await waitFor(() =>
      expect(screen.getByText("pairing")).toBeInTheDocument(),
    );

    expect(
      screen.queryByRole("button", {
        name: "tasks:timeTracking.deleteEntry",
      }),
    ).toBeNull();

    fireEvent.click(screen.getByText("pairing"));
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(
          "tasks:timeTracking.descriptionPlaceholder",
        ),
      ).toBeNull(),
    );
  });
});

describe("billable start", () => {
  it("carries the visible toggle value into the new timer", async () => {
    const onToggle = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <TimeEntryForm
          initialStart={new Date(Date.now() - 3600_000)}
          initialEnd={new Date()}
          initialNotes="deep work"
          initialBillable
          isPending={false}
          onSave={vi.fn()}
          timer={{ running: false, pending: false, onToggle }}
        />
      </QueryClientProvider>,
    );

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:timeTracking.start" }),
    );

    await waitFor(() =>
      expect(onToggle).toHaveBeenCalledWith("deep work", false),
    );
  });
});

describe("date ranges", () => {
  it("keeps the end clock time when moving a range across DST", () => {
    process.env.TZ = "Europe/Rome";
    const onSave = vi.fn();
    render(
      <TimeEntryForm
        initialStart={new Date(2026, 2, 27, 9, 30)}
        initialEnd={new Date(2026, 2, 28, 11, 45)}
        initialNotes=""
        initialBillable={false}
        isPending={false}
        onSave={onSave}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:timeTracking.startTime" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "select DST date" }));
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:timeTracking.save" }),
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        start: new Date(2026, 2, 29, 9, 30),
        end: new Date(2026, 2, 30, 11, 45),
      }),
    );
  });
});

describe("entries fetch failure", () => {
  it("shows an error with retry instead of an empty list", async () => {
    server.failEntriesNext = true;
    renderTracker();

    fireEvent.click(screen.getAllByRole("button")[0]);
    await waitFor(() =>
      expect(
        screen.getByText("tasks:timeTracking.loadError"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("tasks:timeTracking.noEntries")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "common:error.tryAgain" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("tasks:timeTracking.noEntries"),
      ).toBeInTheDocument(),
    );
  });
});
