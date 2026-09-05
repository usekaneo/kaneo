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
import { toast } from "@/lib/toast";
import { ExternalLinksAccordion } from "./external-links-accordion";

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

function renderResources() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <ExternalLinksAccordion taskId="task-1" externalLinks={[]} />
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
