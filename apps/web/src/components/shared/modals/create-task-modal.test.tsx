import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
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
let workspaceId = "workspace-1";
let projects: { id: string; name: string; slug: string }[] | undefined;
let storedProject: { id: string; columns: unknown[] } | null = null;
let uploadAsset: ((file: File) => Promise<unknown>) | undefined;
const stageUpload = vi.fn();
vi.mock("@/lib/upload-draft-asset", () => ({
  uploadDraftAsset: (...args: unknown[]) => stageUpload(...args),
}));

beforeEach(() => {
  workspaceId = "workspace-1";
  projects = [
    { id: "project-1", name: "Alpha", slug: "alp" },
    { id: "project-2", name: "Beta", slug: "bet" },
  ];
  storedProject = null;
  useLocation.mockReturnValue({ pathname: "/dashboard/workspace/workspace-1" });
});
const createTask = vi.fn(async (input: Record<string, unknown>) => ({
  id: "task-1",
  title: input.title,
  status: input.status,
  projectId: input.projectId,
  createdAt: "2026-08-05T00:00:00.000Z",
}));

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
  default: () => ({ data: [] }),
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

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => true,
    canCreateLabels: () => true,
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
