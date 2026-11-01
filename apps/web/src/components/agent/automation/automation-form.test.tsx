import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
import {
  type AutomationDraft,
  createAutomationDraft,
} from "./automation-draft";
import { AutomationForm } from "./automation-form";

const m = vi.hoisted(() => ({ onSubmit: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/components/common/workspace-layout", () => ({
  default: ({
    headerActions,
    children,
  }: {
    headerActions: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      <header>{headerActions}</header>
      {children}
    </div>
  ),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/hooks/queries/agent/use-agent-config", () => ({
  default: () => ({
    data: { enabled: true, model: "m1", models: [{ id: "m1", label: "M1" }] },
  }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "p1", name: "API Platform" },
      { id: "p2", name: "Kaneo Web" },
    ],
  }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: [{ name: "Bug" }, { name: "bug" }] }),
}));
vi.mock("@/fetchers/search/global-search", () => ({
  default: vi.fn(async () => ({ results: [] })),
}));
vi.mock("@/fetchers/column/get-columns", () => ({
  default: vi.fn(async () => [{ name: "In review" }]),
}));

const owner = { id: "u1", name: "Mira", image: null };

function renderForm(draft: Partial<AutomationDraft> = {}) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <AutomationForm
        workspaceId="w"
        pageTitle="New automation"
        parents={[]}
        cancelLink={<a href="/back" />}
        initialDraft={{ ...createAutomationDraft("Europe/Berlin"), ...draft }}
        owner={owner}
        submitLabel="Create"
        pending={false}
        onSubmit={m.onSubmit}
      />
    </QueryClientProvider>,
  );
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create" }));

beforeEach(() => m.onSubmit.mockReset());
afterEach(cleanup);

describe("AutomationForm", () => {
  it("blocks submitting without a name or prompt", () => {
    renderForm();
    submit();

    expect(
      screen.getByText("agent:automations.form.errors.nameRequired"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("agent:automations.form.errors.promptRequired"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "agent:automations.form.name" }),
    ).toHaveAttribute("aria-invalid", "true");
    expect(m.onSubmit).not.toHaveBeenCalled();
  });

  it("clears an error once the field is fixed and submits", () => {
    renderForm({ prompt: "List overdue work" });
    submit();
    expect(m.onSubmit).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByRole("textbox", { name: "agent:automations.form.name" }),
      { target: { value: "Monday digest" } },
    );
    expect(
      screen.queryByText("agent:automations.form.errors.nameRequired"),
    ).not.toBeInTheDocument();
    submit();

    expect(m.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Monday digest",
        prompt: "List overdue work",
        triggerType: "schedule",
        timezone: "Europe/Berlin",
        model: null,
      }),
    );
  });

  it("switches to an event trigger and picks the event", async () => {
    renderForm({ name: "Triage", prompt: "Sort bugs" });

    fireEvent.click(
      screen.getByRole("tab", { name: "agent:automations.form.eventTab" }),
    );
    fireEvent.click(
      await screen.findByRole("radio", {
        name: "agent:automations.events.comment_added",
      }),
    );
    submit();

    expect(m.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: "event",
        event: "comment_added",
      }),
    );
  });

  it("hides the project filter when the scope is one project", async () => {
    renderForm({ triggerType: "event", projectId: "p1" });

    fireEvent.click(
      screen.getByRole("button", { name: "agent:automations.filters.add" }),
    );

    await screen.findByRole("menuitem", {
      name: "agent:automations.filters.label",
    });
    expect(
      screen.getByRole("menuitem", {
        name: "agent:automations.filters.column",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", {
        name: "agent:automations.filters.project",
      }),
    ).not.toBeInTheDocument();
  });

  it("offers the project filter for workspace-wide automations", async () => {
    renderForm({ triggerType: "event" });
    fireEvent.click(
      screen.getByRole("button", { name: "agent:automations.filters.add" }),
    );
    expect(
      await screen.findByRole("menuitem", {
        name: "agent:automations.filters.project",
      }),
    ).toBeInTheDocument();
    await waitFor(() => expect(m.onSubmit).not.toHaveBeenCalled());
  });
});
