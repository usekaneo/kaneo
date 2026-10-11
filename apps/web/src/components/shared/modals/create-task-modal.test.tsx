import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import CreateTaskModal from "./create-task-modal";
import { toast } from "@/lib/toast";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const useLocation = vi.fn();
const deleteTask = vi.fn(async () => {});
const updateTask = vi.fn(async (input: Record<string, unknown>) => input);
const setProject = vi.fn();
let canUpdateTasks = true;
let workspaceId = "workspace-1";
let projects: { id: string; name: string; slug: string }[] | undefined;
let columnsError = false;
let columnsFetching = false;
let workspaceLabels: {
  id: string;
  name: string;
  color: string;
  taskId: null;
}[] = [];
const refetchColumns = vi.fn();
let projectColumns:
  | { id: string; slug: string; name: string; isFinal: boolean }[]
  | undefined;
let storedProject: { id: string; columns: unknown[] } | null = null;
let uploadAsset: ((file: File) => Promise<unknown>) | undefined;
const stageUpload = vi.fn();
vi.mock("@/lib/upload-draft-asset", () => ({
  uploadDraftAsset: (...args: unknown[]) => stageUpload(...args),
}));

beforeEach(() => {
  canUpdateTasks = true;
  workspaceId = "workspace-1";
  projects = [
    { id: "project-1", name: "Alpha", slug: "alp" },
    { id: "project-2", name: "Beta", slug: "bet" },
  ];
  storedProject = null;
  columnsError = false;
  columnsFetching = false;
  workspaceLabels = [];
  refetchColumns.mockImplementation(async () => ({
    data: projectColumns,
    isError: columnsError,
  }));
  projectColumns = [
    { id: "todo", slug: "to-do", name: "To Do", isFinal: false },
  ];
  useLocation.mockReturnValue({ pathname: "/dashboard/workspace/workspace-1" });
});
const createTask = vi.fn(async (input: Record<string, unknown>) => ({
  id: "task-1",
  title: input.title,
  status: input.status,
  projectId: input.projectId,
  createdAt: "2026-08-05T00:00:00.000Z",
}));

it("submits the parent with task creation and keeps the draft on failure", async () => {
  const onClose = vi.fn();
  render(
    <CreateTaskModal
      open
      projectId="project-1"
      parentTaskId="parent"
      onClose={onClose}
    />,
    { wrapper: createWrapper() },
  );
  const input = screen.getByPlaceholderText(
    "common:modals.createTask.taskTitlePlaceholder",
  );
  fireEvent.change(input, { target: { value: "New subtask" } });
  createTask.mockRejectedValueOnce(new Error("Parent unavailable"));
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
  await vi.waitFor(() =>
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        parentTaskId: "parent",
        projectId: "project-1",
      }),
    ),
  );
  await vi.waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("Parent unavailable"),
  );
  expect(onClose).not.toHaveBeenCalled();
  expect(input).toHaveValue("New subtask");
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
  await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

it("does not create a subtask without update permission", () => {
  canUpdateTasks = false;
  render(
    <CreateTaskModal
      open
      projectId="project-1"
      parentTaskId="parent"
      onClose={vi.fn()}
    />,
    { wrapper: createWrapper() },
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(createTask).not.toHaveBeenCalled();
});

it("treats staged resources as unsaved input and allows removing them", async () => {
  const onClose = vi.fn();
  render(<CreateTaskModal open projectId="project-1" onClose={onClose} />, {
    wrapper: createWrapper(),
  });
  fireEvent.click(
    screen.getByRole("button", { name: "settings:externalLinks.addResource" }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: "settings:externalLinks.addResource",
  });
  const url = within(dialog).getByLabelText("settings:externalLinks.url");
  fireEvent.change(url, { target: { value: "ftp://example.com" } });
  fireEvent.submit(url.closest("form")!);
  expect(dialog).toBeVisible();
  expect(createTask).not.toHaveBeenCalled();
  fireEvent.change(url, { target: { value: "https://example.com" } });
  fireEvent.submit(url.closest("form")!);
  await vi.waitFor(() =>
    expect(
      screen.queryByRole("dialog", {
        name: "settings:externalLinks.addResource",
      }),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "common:actions.cancel" }),
  );
  await screen.findByText("common:modals.createTask.discardTitle");
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "common:actions.cancel",
    }),
  );
  await vi.waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  const resources = screen.getByRole("region", {
    name: "settings:externalLinks.resources",
  });
  fireEvent.click(
    within(resources).getByRole("button", {
      name: "settings:externalLinks.remove",
    }),
  );
  expect(
    within(resources).queryByText("https://example.com"),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "common:actions.cancel" }),
  );
  expect(onClose).toHaveBeenCalledOnce();
  expect(createTask).not.toHaveBeenCalled();
});

it("stages resources without creating a task, keeps them on failure, and clears them for Create more", async () => {
  const onClose = vi.fn();
  render(<CreateTaskModal open projectId="project-1" onClose={onClose} />, {
    wrapper: createWrapper(),
  });
  fireEvent.change(
    screen.getByPlaceholderText(
      "common:modals.createTask.taskTitlePlaceholder",
    ),
    { target: { value: "With resource" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "settings:externalLinks.addResource" }),
  );
  const resourceDialog = await screen.findByRole("dialog", {
    name: "settings:externalLinks.addResource",
  });
  const url = within(resourceDialog).getByLabelText(
    "settings:externalLinks.url",
  );
  fireEvent.change(url, { target: { value: "https://example.com/design" } });
  fireEvent.change(
    within(resourceDialog).getByLabelText(
      "settings:externalLinks.titleOptional",
    ),
    { target: { value: "Design" } },
  );
  fireEvent.keyDown(url, { key: "Enter", ctrlKey: true });
  await vi.waitFor(() =>
    expect(
      screen.queryByRole("dialog", {
        name: "settings:externalLinks.addResource",
      }),
    ).not.toBeInTheDocument(),
  );
  expect(createTask).not.toHaveBeenCalled();
  expect(screen.getByText("Design")).toBeVisible();
  createTask.mockRejectedValueOnce(new Error("Create failed"));
  fireEvent.submit(document.querySelector("form")!);
  await vi.waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("Create failed"),
  );
  expect(screen.getByText("Design")).toBeVisible();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch"));
  fireEvent.submit(document.querySelector("form")!);
  await vi.waitFor(() =>
    expect(createTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        externalLinks: [{ url: "https://example.com/design", title: "Design" }],
      }),
    ),
  );
  await vi.waitFor(() =>
    expect(screen.queryByText("Design")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  expect(onClose).not.toHaveBeenCalled();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => useLocation(),
  useParams: ({
    select,
  }: {
    select: (params: { workspaceId?: string }) => unknown;
  }) =>
    select({
      workspaceId: useLocation().pathname.match(/\/workspace\/([^/]+)/)?.[1],
    }),
}));

vi.mock("@/components/task/task-description-editor", () => ({
  default: (props: {
    taskId?: string;
    uploadAsset: (file: File) => Promise<unknown>;
    onChange: (value: string) => void;
  }) => {
    uploadAsset = props.uploadAsset;
    return (
      <textarea
        data-testid="description-editor"
        data-task-id={props.taskId}
        onChange={(event) => props.onChange(event.target.value)}
      />
    );
  },
}));

vi.mock("@/hooks/mutations/label/use-create-label", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-create-task", () => ({
  default: () => ({ mutateAsync: createTask }),
}));

vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: deleteTask }),
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: updateTask }),
}));

vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: workspaceLabels }),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: workspaceId, name: "WS" } }),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);

vi.mock("@/hooks/queries/workspace-users/use-get-project-members", () => ({
  default: () => ({ data: undefined }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => true,
    canUpdateTasks: () => canUpdateTasks,
    canCreateLabels: () => true,
  }),
}));

vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: projectColumns,
    isError: columnsError,
    isFetching: columnsFetching,
    refetch: refetchColumns,
  }),
}));

vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: projects }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({ project: storedProject, setProject }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

describe("CreateTaskModal", () => {
  it("keeps labels open for multiple selections and spaces the selected badges evenly", async () => {
    workspaceLabels = [
      { id: "label-1", name: "Frontend", color: "blue", taskId: null },
      { id: "label-2", name: "Urgent", color: "red", taskId: null },
    ];
    render(<CreateTaskModal open projectId="project-1" onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    const trigger = screen
      .getByText("common:modals.createTask.labels")
      .closest("button");
    if (!trigger) throw new Error("Labels trigger is missing");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "Frontend" }));
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Urgent" }));
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const badges = Array.from(document.querySelectorAll('[data-slot="badge"]'));
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent("Frontend");
    expect(badges[1]).toHaveTextContent("Urgent");

    fireEvent.click(screen.getByRole("button", { name: "Frontend" }));
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelectorAll('[data-slot="badge"]')).toHaveLength(1);
  });

  it("keeps unsaved input while discard confirmation is open", async () => {
    useLocation.mockReturnValue({
      pathname: "/dashboard/workspace/workspace-1/project/project-1/board",
    });
    const onClose = vi.fn();

    render(<CreateTaskModal open onClose={onClose} />, {
      wrapper: createWrapper(),
    });

    const titleInput = screen.getByPlaceholderText(
      "common:modals.createTask.taskTitlePlaceholder",
    );
    fireEvent.change(titleInput, { target: { value: "Unsaved task" } });

    const backdrop = document.querySelector('[data-slot="dialog-backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.pointerDown(backdrop as Element);
    fireEvent.pointerUp(backdrop as Element);
    fireEvent.click(backdrop as Element);

    expect(onClose).not.toHaveBeenCalled();
    expect(
      await screen.findByText("common:modals.createTask.discardTitle"),
    ).toBeTruthy();
    expect(titleInput).toHaveValue("Unsaved task");

    fireEvent.keyDown(document, { key: "Enter", ctrlKey: true });

    expect(createTask).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes after the user confirms discarding unsaved input", async () => {
    useLocation.mockReturnValue({
      pathname: "/dashboard/workspace/workspace-1/project/project-1/board",
    });
    const onClose = vi.fn();

    render(<CreateTaskModal open onClose={onClose} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(
      screen.getByPlaceholderText(
        "common:modals.createTask.taskTitlePlaceholder",
      ),
      {
        target: { value: "Unsaved task" },
      },
    );
    const backdrop = document.querySelector('[data-slot="dialog-backdrop"]');
    fireEvent.pointerDown(backdrop as Element);
    fireEvent.pointerUp(backdrop as Element);
    fireEvent.click(backdrop as Element);

    await screen.findByText("common:modals.createTask.discardTitle");

    fireEvent.click(screen.getByText("common:modals.createTask.discardButton"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("treats a selected project as unsaved input", async () => {
    useLocation.mockReturnValue({
      pathname: "/dashboard/workspace/workspace-1",
    });

    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByText("common:modals.createTask.selectProject"));
    fireEvent.click(await screen.findByText("Beta"));
    const backdrop = document.querySelector('[data-slot="dialog-backdrop"]');
    fireEvent.pointerDown(backdrop as Element);
    fireEvent.pointerUp(backdrop as Element);
    fireEvent.click(backdrop as Element);

    expect(
      await screen.findByText("common:modals.createTask.discardTitle"),
    ).toBeTruthy();
  });

  it("shows a project picker and creates the task in the chosen project", async () => {
    useLocation.mockReturnValue({
      pathname: "/dashboard/workspace/workspace-1",
    });

    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const pickerTrigger = screen.getByText(
      "common:modals.createTask.selectProject",
    );
    fireEvent.click(pickerTrigger);
    fireEvent.click(await screen.findByText("Beta"));
    expect(pickerTrigger.closest("button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    fireEvent.change(
      screen.getByPlaceholderText(
        "common:modals.createTask.taskTitlePlaceholder",
      ),
      {
        target: { value: "Picked project task" },
      },
    );
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await vi.waitFor(() => {
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Picked project task",
          projectId: "project-2",
        }),
      );
    });
  });

  it("closes priority and assignee pickers after selecting one option", async () => {
    render(<CreateTaskModal open projectId="project-1" onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const priorityTrigger = screen
      .getByText("tasks:priority.no-priority")
      .closest('[data-slot="popover-trigger"]');
    expect(priorityTrigger).not.toBeNull();
    fireEvent.click(priorityTrigger as HTMLElement);
    fireEvent.click(await screen.findByText("tasks:priority.low"));
    expect(priorityTrigger).toHaveAttribute("aria-expanded", "false");

    const assigneeTrigger = screen.getByText("common:modals.createTask.assign");
    fireEvent.click(assigneeTrigger);
    fireEvent.click(
      await screen.findByText("common:modals.createTask.assignUnassigned"),
    );
    expect(assigneeTrigger.closest("button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it.each([undefined, "to-do", "planned"])(
    "creates with the chosen workflow status instead of the initial status (%s)",
    async (initialStatus) => {
      projectColumns = [
        { id: "todo", slug: "to-do", name: "Ready", isFinal: false },
        { id: "done", slug: "done", name: "Finished", isFinal: true },
      ];
      const onClose = vi.fn();
      render(
        <CreateTaskModal
          open
          projectId="project-1"
          status={initialStatus}
          onClose={onClose}
        />,
        { wrapper: createWrapper() },
      );
      const trigger = screen.getByRole("button", {
        name: "common:modals.createTask.status",
      });
      fireEvent.click(trigger);
      fireEvent.click(await screen.findByText("Finished"));
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveTextContent("Finished");
      expect(onClose).not.toHaveBeenCalled();
      enterTitle();
      submit();
      await vi.waitFor(() =>
        expect(createTask).toHaveBeenCalledWith(
          expect.objectContaining({ status: "done", projectId: "project-1" }),
        ),
      );
    },
  );

  it("reports an error rather than replacing a selected status removed before submission", async () => {
    projectColumns = [
      { id: "todo", slug: "to-do", name: "Ready", isFinal: false },
      { id: "review", slug: "review", name: "Review", isFinal: false },
    ];
    refetchColumns.mockResolvedValue({
      data: [projectColumns[0]],
      isError: false,
    });
    const onClose = vi.fn();
    render(<CreateTaskModal open projectId="project-1" onClose={onClose} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "common:modals.createTask.status" }),
    );
    fireEvent.click(await screen.findByText("Review"));
    enterTitle();
    submit();
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "common:modals.createTask.statusUnavailable",
      ),
    );
    expect(createTask).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByPlaceholderText(
        "common:modals.createTask.taskTitlePlaceholder",
      ),
    ).toHaveValue("Private task");
  });

  it("treats a status-only change as unsaved input", async () => {
    projectColumns = [
      { id: "todo", slug: "to-do", name: "Ready", isFinal: false },
      { id: "review", slug: "review", name: "Review", isFinal: false },
    ];
    const onClose = vi.fn();
    render(<CreateTaskModal open projectId="project-1" onClose={onClose} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "common:modals.createTask.status" }),
    );
    fireEvent.click(await screen.findByText("Review"));
    fireEvent.click(screen.getByText("common:actions.cancel"));
    expect(
      await screen.findByText("common:modals.createTask.discardTitle"),
    ).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("resets a chosen status when switching projects", async () => {
    projectColumns = [
      { id: "todo", slug: "to-do", name: "Ready", isFinal: false },
      { id: "review", slug: "review", name: "Review", isFinal: false },
    ];
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    fireEvent.click(
      screen.getByRole("button", { name: "common:modals.createTask.status" }),
    );
    fireEvent.click(await screen.findByText("Review"));
    fireEvent.click(screen.getByText("Beta"));
    fireEvent.click(await screen.findByText("Alpha"));
    expect(
      screen.getByRole("button", { name: "common:modals.createTask.status" }),
    ).toHaveTextContent("Ready");
    enterTitle();
    submit();
    await vi.waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ status: "to-do", projectId: "project-1" }),
      ),
    );
  });

  it("lets the Create more switch be turned on and off without submitting", async () => {
    const onClose = vi.fn();
    render(<CreateTaskModal open projectId="project-1" onClose={onClose} />, {
      wrapper: createWrapper(),
    });
    const toggle = screen.getByRole("switch", {
      name: "common:modals.createTask.createMore",
    });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    fireEvent.click(screen.getByText("common:modals.createTask.createMore"));
    expect(toggle).not.toBeChecked();
    expect(createTask).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    enterTitle();
    submit();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("resets the status to the supplied default when creating another task", async () => {
    projectColumns = [
      { id: "todo", slug: "to-do", name: "Ready", isFinal: false },
      { id: "review", slug: "review", name: "Review", isFinal: false },
    ];
    render(
      <CreateTaskModal
        open
        projectId="project-1"
        status="to-do"
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common:modals.createTask.status" }),
    );
    fireEvent.click(await screen.findByText("Review"));
    fireEvent.click(
      screen.getByRole("switch", {
        name: "common:modals.createTask.createMore",
      }),
    );
    enterTitle();
    submit();
    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "common:modals.createTask.status",
        }),
      ).toHaveTextContent("Ready"),
    );
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: "review" }),
    );
  });

  it.each([undefined, "parent"])(
    "keeps Create more enabled across two submissions with parent %s",
    async (parentTaskId) => {
      const onClose = vi.fn();
      render(
        <CreateTaskModal
          open
          projectId="project-1"
          parentTaskId={parentTaskId}
          onClose={onClose}
        />,
        { wrapper: createWrapper() },
      );
      const toggle = screen.getByRole("switch", {
        name: "common:modals.createTask.createMore",
      });
      fireEvent.click(toggle);
      for (const title of ["First task", "Second task"]) {
        enterTitle(title);
        submit();
        await vi.waitFor(() =>
          expect(
            screen.getByPlaceholderText(
              "common:modals.createTask.taskTitlePlaceholder",
            ),
          ).toHaveValue(""),
        );
        expect(toggle).toBeChecked();
        expect(createTask).toHaveBeenLastCalledWith(
          expect.objectContaining({
            title,
            projectId: "project-1",
            ...(parentTaskId ? { parentTaskId } : {}),
          }),
        );
        expect(onClose).not.toHaveBeenCalled();
      }
    },
  );

  it.each(["startDate", "dueDate"])(
    "submits the selected %s even after its calendar closes",
    async (dateKey) => {
      render(<CreateTaskModal open projectId="project-1" onClose={vi.fn()} />, {
        wrapper: createWrapper(),
      });
      fireEvent.click(screen.getByText(`common:modals.createTask.${dateKey}`));
      const grid = await screen.findByRole("grid");
      const day = within(grid)
        .getAllByRole("button")
        .find((button) => button.textContent === "15");
      if (!day) throw new Error("Calendar day is missing");
      fireEvent.click(day);
      const today = new Date();
      const selectedDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        15,
      ).toISOString();
      enterTitle();
      submit();
      await vi.waitFor(() =>
        expect(createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            [dateKey]: selectedDate,
          }),
        ),
      );
    },
  );

  it.each([
    ["startDate", "clearStartDate"],
    ["dueDate", "clearDueDate"],
  ])(
    "closes the %s calendar after selection and clearing",
    async (dateKey, clearKey) => {
      const onClose = vi.fn();
      render(<CreateTaskModal open projectId="project-1" onClose={onClose} />, {
        wrapper: createWrapper(),
      });
      const trigger = screen
        .getByText(`common:modals.createTask.${dateKey}`)
        .closest("button");
      if (!trigger) throw new Error("Date picker trigger is missing");
      fireEvent.click(trigger);
      const grid = await screen.findByRole("grid");
      const day = within(grid)
        .getAllByRole("button")
        .find((button) => button.textContent === "15");
      if (!day) throw new Error("Calendar day is missing");
      fireEvent.click(day);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).not.toHaveTextContent(
        `common:modals.createTask.${dateKey}`,
      );
      fireEvent.click(trigger);
      fireEvent.click(
        await screen.findByText(`common:modals.createTask.${clearKey}`),
      );
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveTextContent(`common:modals.createTask.${dateKey}`);
      expect(onClose).not.toHaveBeenCalled();
    },
  );

  it("creates Home tasks in the first open custom column and shows its name", async () => {
    projectColumns = [
      { id: "done", slug: "done", name: "Finished", isFinal: true },
      {
        id: "ready",
        slug: "ready-for-work",
        name: "Ready for work",
        isFinal: false,
      },
    ];
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    expect(screen.getByText("Ready for work")).toBeInTheDocument();
    enterTitle();
    submit();
    await vi.waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ready-for-work" }),
      ),
    );
  });

  it("waits for the chosen project's columns before submitting", async () => {
    projectColumns = undefined;
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    expect(
      screen.getByText("common:modals.createTask.createButton"),
    ).toBeDisabled();
    submit();
    expect(createTask).not.toHaveBeenCalled();
  });

  it("uses fresh workflow columns when a cached open column became final", async () => {
    refetchColumns.mockResolvedValue({
      data: [
        { id: "todo", slug: "to-do", name: "Completed", isFinal: true },
        { id: "ready", slug: "ready", name: "Ready", isFinal: false },
      ],
      isError: false,
    });
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    submit();
    await vi.waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ready" }),
      ),
    );
  });

  it("does not create from cached columns when the submission refresh fails", async () => {
    refetchColumns.mockResolvedValue({ data: projectColumns, isError: true });
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    submit();
    await vi.waitFor(() => expect(refetchColumns).toHaveBeenCalledOnce());
    expect(createTask).not.toHaveBeenCalled();
  });

  it("waits for refreshing cached workflow columns", async () => {
    columnsFetching = true;
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    expect(
      screen.getByText("common:modals.createTask.createButton"),
    ).toBeDisabled();
    submit();
    expect(createTask).not.toHaveBeenCalled();
  });

  it("does not publish after closing during workflow verification", async () => {
    let finish!: (value: unknown) => void;
    refetchColumns.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    submit();
    view.rerender(<CreateTaskModal open={false} onClose={vi.fn()} />);
    await act(async () => {
      finish({ data: projectColumns, isError: false });
    });
    expect(createTask).not.toHaveBeenCalled();
  });

  it("offers a retry when project statuses could not be loaded", async () => {
    projectColumns = undefined;
    columnsError = true;
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "common:modals.createTask.statusLoadError",
    );
    fireEvent.click(screen.getByText("common:error.tryAgain"));
    expect(refetchColumns).toHaveBeenCalledOnce();
    submit();
    expect(createTask).not.toHaveBeenCalled();
  });

  it("uses planned instead of an ambiguous open/final status slug", async () => {
    projectColumns = [
      { id: "done", slug: "shared", name: "Finished", isFinal: true },
      { id: "open", slug: "shared", name: "Open", isFinal: false },
    ];
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    submit();
    await vi.waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ status: "planned" }),
      ),
    );
  });

  it("uses planned when every column is final", async () => {
    projectColumns = [
      { id: "done", slug: "done", name: "Finished", isFinal: true },
    ];
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    submit();
    await vi.waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ status: "planned" }),
      ),
    );
  });

  it("keeps an explicit planned status even when the project has custom columns", async () => {
    projectColumns = [
      { id: "ready", slug: "ready", name: "Ready", isFinal: false },
    ];
    render(<CreateTaskModal open status="planned" onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    submit();
    await vi.waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ status: "planned" }),
      ),
    );
  });

  it("hides the picker when a project is in scope from the route", () => {
    useLocation.mockReturnValue({
      pathname: "/dashboard/workspace/workspace-1/project/project-1/board",
    });

    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.queryByText("common:modals.createTask.selectProject"),
    ).toBeNull();
  });
});

function enterTitle(title = "Private task") {
  fireEvent.change(
    screen.getByPlaceholderText(
      "common:modals.createTask.taskTitlePlaceholder",
    ),
    {
      target: { value: title },
    },
  );
}

async function chooseBeta() {
  fireEvent.click(screen.getByText("common:modals.createTask.selectProject"));
  fireEvent.click(await screen.findByText("Beta"));
}

function submit() {
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
}

describe("CreateTaskModal context isolation", () => {
  it("never falls back to the last globally visited project", () => {
    storedProject = { id: "foreign-project", columns: [] };
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    enterTitle();
    expect(
      screen.getByText("common:modals.createTask.createButton"),
    ).toBeDisabled();
    submit();
    expect(createTask).not.toHaveBeenCalled();
  });

  it("clears selected project and private fields after close and reopen", async () => {
    const props = { open: true, onClose: vi.fn() };
    const view = render(<CreateTaskModal {...props} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    view.rerender(<CreateTaskModal {...props} open={false} />);
    view.rerender(<CreateTaskModal {...props} />);
    expect(
      screen.getByPlaceholderText(
        "common:modals.createTask.taskTitlePlaceholder",
      ),
    ).toHaveValue("");
    enterTitle("New task");
    submit();
    expect(createTask).not.toHaveBeenCalled();
  });

  it("clears workspace A's selection when workspace B becomes active", async () => {
    const view = render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    workspaceId = "workspace-2";
    projects = [{ id: "project-3", name: "Gamma", slug: "gam" }];
    useLocation.mockReturnValue({
      pathname: "/dashboard/workspace/workspace-2",
    });
    view.rerender(<CreateTaskModal open onClose={vi.fn()} />);
    enterTitle("Workspace B secret");
    submit();
    expect(createTask).not.toHaveBeenCalled();
    expect(
      screen.getByText("common:modals.createTask.selectProject"),
    ).toBeInTheDocument();
  });

  it("does not expose the previous workspace while the route's workspace is loading", async () => {
    const view = render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    useLocation.mockReturnValue({
      pathname: "/dashboard/workspace/workspace-2",
    });
    view.rerender(<CreateTaskModal open onClose={vi.fn()} />);
    expect(screen.queryByTestId("description-editor")).toBeNull();
    expect(createTask).not.toHaveBeenCalled();
  });

  it.each([undefined, []])(
    "rejects explicit project IDs until current workspace query proves membership (%s)",
    async (data) => {
      projects = data;
      render(<CreateTaskModal open projectId="project-2" onClose={vi.fn()} />, {
        wrapper: createWrapper(),
      });
      enterTitle();
      submit();
      await expect(uploadAsset?.(new File(["x"], "x.png"))).rejects.toThrow();
      expect(createTask).not.toHaveBeenCalled();
    },
  );

  it("stages attachments without creating a task and claims them only on submit", async () => {
    stageUpload.mockResolvedValue({
      id: "staged-1",
      url: "/asset/staged-1",
      kind: "image",
    });
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    await act(async () => {
      await uploadAsset?.(new File(["x"], "x.png"));
    });
    expect(createTask).not.toHaveBeenCalled();
    expect(updateTask).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("description-editor"), {
      target: { value: "![image](/asset/staged-1)" },
    });
    submit();
    await vi.waitFor(() => expect(createTask).toHaveBeenCalledOnce());
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        draftAssetIds: ["staged-1"],
        projectId: "project-2",
      }),
    );
  });

  it("does not submit while attachments are uploading", async () => {
    let finish!: (value: unknown) => void;
    stageUpload.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    enterTitle();
    let pending!: Promise<unknown>;
    act(() => {
      pending = uploadAsset!(new File(["x"], "x.png"));
    });
    expect(
      screen.getByText("activity:comment.editor.uploadingFile"),
    ).toBeDisabled();
    submit();
    expect(createTask).not.toHaveBeenCalled();
    await act(async () => {
      finish({ id: "staged-2" });
      await pending;
    });
    submit();
    await vi.waitFor(() => expect(createTask).toHaveBeenCalledOnce());
  });

  it("closing after an upload creates no published task or deletion side effect", async () => {
    stageUpload.mockResolvedValue({ id: "staged-1" });
    const view = render(<CreateTaskModal open onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });
    await chooseBeta();
    await act(async () => {
      await uploadAsset?.(new File(["x"], "x.png"));
    });
    view.rerender(<CreateTaskModal open={false} onClose={vi.fn()} />);
    expect(createTask).not.toHaveBeenCalled();
    expect(deleteTask).not.toHaveBeenCalled();
    expect(setProject).not.toHaveBeenCalled();
  });
});
