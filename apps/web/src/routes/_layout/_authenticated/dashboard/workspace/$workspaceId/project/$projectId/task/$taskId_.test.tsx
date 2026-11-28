import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { Route } from "./$taskId_";

const m = vi.hoisted(() => {
  const task = (overrides: Record<string, unknown>) => ({
    projectId: "project",
    description: "",
    position: 0,
    createdAt: "",
    startDate: null,
    dueDate: null,
    userId: null,
    assigneeId: null,
    assigneeName: null,
    ...overrides,
  });
  return {
    taskId: "parent",
    tasks: {
      parent: task({
        id: "parent",
        number: 1,
        title: "Parent task",
        status: "in-progress",
        priority: "urgent",
        userId: "ana",
        assigneeId: "ana",
        assigneeName: "Ana",
        startDate: "2026-11-02T12:00:00.000Z",
        dueDate: "2026-11-20T12:00:00.000Z",
      }),
      subtask: task({
        id: "subtask",
        number: 2,
        title: "Subtask",
        status: "to-do",
        priority: "low",
      }),
      sibling: task({
        id: "sibling",
        number: 3,
        title: "Sibling",
        status: "to-do",
        priority: "high",
      }),
    } as Record<string, Record<string, unknown>>,
    labels: {
      parent: [{ id: "l1", name: "parent-label", color: "#ff0000" }],
      subtask: [{ id: "l2", name: "subtask-label", color: "#00ff00" }],
      sibling: [],
    } as Record<string, { id: string; name: string; color: string }[]>,
    customFieldValues: {
      parent: [{ fieldId: "billable", value: "false" }],
      subtask: [{ fieldId: "billable", value: "false" }],
      sibling: [{ fieldId: "billable", value: "false" }],
    } as Record<string, { fieldId: string; value: string }[]>,
    updateTitle: vi.fn(),
    setCustomFieldValue: vi.fn(),
  };
});

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    ...(options as object),
    useParams: () => ({
      workspaceId: "workspace",
      projectId: "project",
      taskId: m.taskId,
    }),
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));
vi.mock("@/lib/shiki-highlighter", () => ({
  getSharedShikiHighlighter: () => Promise.resolve(),
}));

vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: (taskId: string) => ({
    data: m.tasks[taskId],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: () => ({
    data: { id: "project", name: "Alpha", slug: "ALP", icon: "Layout" },
    isLoading: false,
  }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: [{ id: "project" }] }),
}));
vi.mock("@/hooks/queries/activity/use-get-activities-by-task-id", () => ({
  default: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: [
      { id: "c1", slug: "to-do", name: "To Do", isFinal: false },
      { id: "c2", slug: "in-progress", name: "In Progress", isFinal: false },
    ],
  }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-task", () => ({
  default: (taskId: string) => ({ data: m.labels[taskId] }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: { members: [{ userId: "ana", user: { name: "Ana" } }] },
    }),
  }),
);
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-fields-by-project",
  () => ({
    default: () => ({
      data: [
        {
          id: "billable",
          projectId: "project",
          name: "Billable",
          type: "boolean",
          required: false,
          defaultValue: null,
          options: null,
          position: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
    }),
  }),
);
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-field-values-by-task",
  () => ({
    default: (taskId: string) => ({ data: m.customFieldValues[taskId] }),
  }),
);
vi.mock("@/hooks/queries/external-link/use-external-links", () => ({
  default: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/hooks/queries/task-relation/use-get-task-relations", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-title", () => ({
  useUpdateTaskTitle: () => ({ mutateAsync: m.updateTitle }),
}));
vi.mock("@/hooks/mutations/custom-field/use-set-custom-field-value", () => ({
  default: () => ({ mutateAsync: m.setCustomFieldValue }),
}));
vi.mock("@/hooks/mutations/comment/use-create-comment", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: () => true,
    canUpdateProjects: () => false,
    canUpdateLabels: () => true,
  }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "ana" } }),
}));

const { passThrough } = vi.hoisted(() => ({
  passThrough: () => ({
    default: ({ children }: { children: unknown }) => children,
  }),
}));
vi.mock("@/components/task/task-status-popover", passThrough);
vi.mock("@/components/task/task-priority-popover", passThrough);
vi.mock("@/components/task/task-assignee-popover", passThrough);
vi.mock("@/components/task/task-labels-popover", passThrough);
vi.mock("@/components/task/task-start-date-popover", passThrough);
vi.mock("@/components/task/task-due-date-popover", passThrough);
vi.mock("@/components/task/task-move-popover", passThrough);
vi.mock("@/components/task/task-recurrence-badge", () => ({
  TaskRecurrenceBadge: () => null,
}));
vi.mock("@/components/activity/comment-editor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Comment"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/components/common/task-layout", () => ({
  default: ({ children, rail }: { children: ReactNode; rail: ReactNode }) => (
    <>
      <main>{children}</main>
      {rail}
    </>
  ),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/task/task-shortcuts", () => ({
  TaskShortcuts: () => null,
}));
vi.mock("@/components/task/task-delete-dialog", () => ({
  default: () => null,
}));
vi.mock("@/components/task/header/task-header-actions", () => ({
  TaskHeaderActions: () => null,
}));
vi.mock("@/components/task/properties/property-chips", () => ({
  PropertyChips: () => null,
}));
vi.mock("@/components/task/task-description", () => ({
  default: () => null,
}));
vi.mock("@/components/task/task-subtasks", () => ({ default: () => null }));
vi.mock("@/components/task/task-relations", () => ({ default: () => null }));
vi.mock("@/components/external-links/external-links-accordion", () => ({
  ExternalLinksAccordion: () => null,
}));

const TaskPage = (Route as unknown as { component: ComponentType }).component;

async function openTask(taskId: string) {
  m.taskId = taskId;
  const queryClient = new QueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <TaskPage />
    </QueryClientProvider>,
  );
  await screen.findByRole("complementary");
  return {
    navigateTo: (nextTaskId: string) => {
      m.taskId = nextTaskId;
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <TaskPage />
        </QueryClientProvider>,
      );
    },
  };
}

const rail = () => screen.getByRole("complementary");
const billable = () =>
  within(rail()).getByRole("checkbox", { name: "Billable" });

const switches = [
  ["a subtask", "its parent", "subtask", "parent"],
  ["a parent", "its subtask", "parent", "subtask"],
  ["a subtask", "its sibling", "subtask", "sibling"],
] as const;

beforeEach(() => {
  m.updateTitle.mockResolvedValue(undefined);
  m.setCustomFieldValue.mockReturnValue(new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("task page switching tasks in place (#2149)", () => {
  it("shows the parent's properties after coming back from a subtask", async () => {
    const page = await openTask("subtask");
    expect(within(rail()).getByText("subtask-label")).toBeInTheDocument();

    page.navigateTo("parent");

    const text = rail().textContent ?? "";
    expect(text).toContain("In Progress");
    expect(text).toContain("Ana");
    expect(text).toContain("parent-label");
    expect(text).not.toContain("subtask-label");
    expect(text).toContain("Alpha");
    expect(screen.getByDisplayValue("Parent task")).toBeInTheDocument();
  });

  it.each(switches)(
    "does not show an unsaved custom field value from %s on %s",
    async (_from, _to, fromId, toId) => {
      const page = await openTask(fromId);
      fireEvent.click(billable());
      expect(billable()).toHaveAttribute("aria-checked", "true");

      page.navigateTo(toId);

      expect(billable()).toHaveAttribute("aria-checked", "false");
    },
  );

  it.each(switches)(
    "saves a title typed in %s to that task after moving to %s",
    async (_from, _to, fromId, toId) => {
      const page = await openTask(fromId);
      vi.useFakeTimers();
      fireEvent.change(
        screen.getByDisplayValue(String(m.tasks[fromId].title)),
        {
          target: { value: "Edited title" },
        },
      );

      page.navigateTo(toId);
      await act(async () => {
        vi.advanceTimersByTime(800);
      });

      expect(m.updateTitle).toHaveBeenCalledTimes(1);
      expect(m.updateTitle).toHaveBeenCalledWith(
        expect.objectContaining({ id: fromId, title: "Edited title" }),
      );
      expect(
        screen.getByDisplayValue(String(m.tasks[toId].title)),
      ).toBeInTheDocument();
    },
  );

  it.each(switches)(
    "does not carry a comment draft from %s to %s",
    async (_from, _to, fromId, toId) => {
      const page = await openTask(fromId);
      fireEvent.change(screen.getByRole("textbox", { name: "Comment" }), {
        target: { value: "Draft comment" },
      });

      page.navigateTo(toId);

      expect(screen.getByRole("textbox", { name: "Comment" })).toHaveValue("");
    },
  );
});
