import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createExternalLink from "@/fetchers/external-link/create-external-link";
import deleteExternalLink from "@/fetchers/external-link/delete-external-link";
import { toast } from "@/lib/toast";
import type { ExternalLink } from "@/types/external-link";
import { ExternalLinksAccordion } from "./external-links-accordion";

vi.mock("@/fetchers/external-link/delete-external-link", () => ({
  default: vi.fn(),
}));

const canUpdateTasks = vi.fn(() => true);
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks }),
}));
vi.mock("@/fetchers/external-link/create-external-link", () => ({
  default: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  canUpdateTasks.mockReturnValue(true);
});
afterEach(cleanup);

function renderResources(externalLinks: ExternalLink[] = []) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <ExternalLinksAccordion taskId="task-1" externalLinks={externalLinks} />
    </QueryClientProvider>,
  );
  return invalidate;
}

async function submitResource() {
  fireEvent.click(
    screen.getByRole("button", { name: "settings:externalLinks.addResource" }),
  );
  const input = await screen.findByLabelText("settings:externalLinks.url");
  fireEvent.change(input, {
    target: { value: "https://example.com/resource" },
  });
  fireEvent.submit(input.closest("form") as HTMLFormElement);
}

describe("manual task resources", () => {
  it("clears canceled values before reopening the form", async () => {
    renderResources();
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:externalLinks.addResource",
      }),
    );
    fireEvent.change(
      await screen.findByLabelText("settings:externalLinks.url"),
      { target: { value: "https://example.com/canceled" } },
    );
    fireEvent.change(
      screen.getByLabelText("settings:externalLinks.titleOptional"),
      { target: { value: "Canceled title" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "settings:externalLinks.cancel" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:externalLinks.addResource",
      }),
    );
    expect(
      await screen.findByLabelText("settings:externalLinks.url"),
    ).toHaveValue("");
    expect(
      screen.getByLabelText("settings:externalLinks.titleOptional"),
    ).toHaveValue("");
  });

  it("hides creation from users without task update permission", () => {
    canUpdateTasks.mockReturnValue(false);
    renderResources();
    expect(
      screen.queryByRole("button", {
        name: "settings:externalLinks.addResource",
      }),
    ).toBeNull();
  });

  it("keeps failed input available and shows an error", async () => {
    vi.mocked(createExternalLink).mockRejectedValue(
      new Error("request rejected"),
    );
    const invalidate = renderResources();
    await submitResource();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("common:error.messages.unknown"),
    );
    expect(screen.getByLabelText("settings:externalLinks.url")).toHaveValue(
      "https://example.com/resource",
    );
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("refreshes the resource list and closes the form after success", async () => {
    vi.mocked(createExternalLink).mockResolvedValue(
      {} as Awaited<ReturnType<typeof createExternalLink>>,
    );
    const invalidate = renderResources();
    await submitResource();
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["external-links", "task-1"],
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast.error).not.toHaveBeenCalled();
  });
});

const manualLink: ExternalLink = {
  id: "link-1",
  taskId: "task-1",
  integrationId: null,
  resourceType: "url",
  externalId: "https://example.com/design",
  url: "https://example.com/design",
  title: "Design",
  metadata: null,
};

describe("removing manual resources", () => {
  it("removes a manual link and refreshes its task's resource list", async () => {
    vi.mocked(deleteExternalLink).mockResolvedValue({ id: "link-1" });
    const invalidate = renderResources([manualLink]);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:externalLinks.remove" }),
    );
    await waitFor(() =>
      expect(deleteExternalLink).toHaveBeenCalledWith(
        { taskId: "task-1", id: "link-1" },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["external-links", "task-1"],
      }),
    );
  });

  it("does not offer removal for provider-managed links or viewers", () => {
    renderResources([
      { ...manualLink, integrationId: "github-1" },
      { ...manualLink, id: "issue-1", resourceType: "issue" },
    ]);
    expect(
      screen.queryByRole("button", { name: "settings:externalLinks.remove" }),
    ).toBeNull();
    cleanup();
    canUpdateTasks.mockReturnValue(false);
    renderResources([manualLink]);
    expect(
      screen.queryByRole("button", { name: "settings:externalLinks.remove" }),
    ).toBeNull();
  });

  it("keeps a failed removal visible and reports the error", async () => {
    vi.mocked(deleteExternalLink).mockRejectedValue(new Error("failed"));
    const invalidate = renderResources([manualLink]);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:externalLinks.remove" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "settings:externalLinks.removeError",
      ),
    );
    expect(screen.getByRole("link", { name: "Design" })).toHaveAttribute(
      "href",
      manualLink.url,
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});
