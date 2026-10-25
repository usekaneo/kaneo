import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { SharedTask } from "@/fetchers/shared-task";
import { Route } from "./shared-task.$token";

const state = vi.hoisted(() => ({
  task: undefined as SharedTask | undefined,
  taskError: false,
  description: undefined as string | undefined,
  descriptionLoading: false,
  descriptionError: false,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ token: "shared-token" }),
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/i18n", () => ({
  i18n: {
    language: "en-US",
    resolvedLanguage: "en-US",
    t: (key: string) => key,
  },
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/public-project/kaneo-branding", () => ({
  KaneoBranding: () => <span>branding</span>,
}));
vi.mock("@/components/public-project/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="description">{content}</div>
  ),
}));
vi.mock("@/hooks/queries/task/use-get-shared-task", () => ({
  useGetSharedTask: () => ({
    data: state.task,
    isLoading: false,
    isError: state.taskError,
  }),
  useGetSharedTaskDescription: () => ({
    data: state.description,
    isLoading: state.descriptionLoading,
    isError: state.descriptionError,
  }),
}));

const Component = Route.options.component as ComponentType;

describe("shared task page", () => {
  beforeEach(() => {
    state.taskError = false;
    state.description = undefined;
    state.descriptionLoading = false;
    state.descriptionError = false;
    state.task = {
      ticketKey: "GARAGE-42",
      title: "Replace brake pads",
      status: {
        slug: "in-progress",
        name: "Waiting for parts",
        icon: null,
        isFinal: false,
      },
      description: "Customer-safe update",
      descriptionDeferred: false,
      priority: "high",
      assigneeName: "Jamie Mechanic",
      startDate: "2026-10-18T12:00:00.000Z",
      dueDate: "2026-10-20T12:00:00.000Z",
      createdAt: "2026-10-17T12:00:00.000Z",
      updatedAt: "2026-10-18T12:00:00.000Z",
    };
  });
  afterEach(cleanup);

  it("renders the safe live summary without mutation controls", () => {
    render(<Component />);
    expect(screen.getByText("GARAGE-42")).toBeInTheDocument();
    expect(screen.getByText("Replace brake pads")).toBeInTheDocument();
    expect(screen.getByText("Waiting for parts")).toBeInTheDocument();
    expect(screen.getByText("Jamie Mechanic")).toBeInTheDocument();
    expect(screen.getByTestId("description")).toHaveTextContent(
      "Customer-safe update",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("loads and renders a deferred description", () => {
    state.task = {
      ...state.task!,
      description: null,
      descriptionDeferred: true,
    };
    state.description = "Deferred customer-safe update";
    render(<Component />);
    expect(screen.getByTestId("description")).toHaveTextContent(
      "Deferred customer-safe update",
    );
  });

  it("uses one generic unavailable state", () => {
    state.task = undefined;
    state.taskError = true;
    render(<Component />);
    expect(screen.getByText("sharedTask:error.title")).toBeInTheDocument();
    expect(
      screen.getByText("sharedTask:error.description"),
    ).toBeInTheDocument();
    expect(screen.queryByText("GARAGE-42")).not.toBeInTheDocument();
  });
});
