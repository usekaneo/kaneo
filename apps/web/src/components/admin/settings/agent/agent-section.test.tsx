import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { AgentSection } from "./agent-section";

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("react-i18next", async (original) => ({
  ...(await original<object>()),
  useTranslation: () => ({
    t: (key: string, values?: { model?: string }) =>
      values?.model ? `${key} ${values.model}` : key,
  }),
}));
vi.mock("@/hooks/queries/admin/use-admin-agent-settings", () => ({
  useAdminAgentSettings: () => ({
    data: {
      enabled: true,
      managed: true,
      model: "anthropic:sonnet",
      models: [
        { id: "anthropic:sonnet", label: "Claude Sonnet" },
        { id: "anthropic:haiku", label: "Claude Haiku" },
      ],
      providers: [{ id: "anthropic", label: "Anthropic" }],
    },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/hooks/mutations/admin/use-update-admin-agent-settings", () => ({
  useUpdateAdminAgentSettings: () => ({
    mutate: mocks.mutate,
    isPending: false,
  }),
}));
vi.mock("@/hooks/queries/admin/use-admin-model-catalog", () => ({
  useAdminModelCatalog: () => ({
    data: { supported: true, models: [] },
    isLoading: false,
    isError: false,
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("saves the administrator's chosen default from the model row menu", async () => {
  render(<AgentSection />);
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:adminAgent.rowActions Claude Haiku",
    }),
  );
  fireEvent.click(
    await screen.findByRole("menuitem", {
      name: "settings:adminAgent.makeDefault",
    }),
  );
  expect(mocks.mutate).toHaveBeenCalledWith({
    model: "anthropic:haiku",
    models: ["anthropic:sonnet", "anthropic:haiku"],
  });
});

it("removes a model using the saved policy", async () => {
  render(<AgentSection />);
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:adminAgent.rowActions Claude Sonnet",
    }),
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "settings:adminAgent.remove" }),
  );
  expect(mocks.mutate).toHaveBeenCalledWith({
    model: "anthropic:haiku",
    models: ["anthropic:haiku"],
  });
});

it("restores environment defaults after confirmation", async () => {
  render(<AgentSection />);
  fireEvent.click(
    screen.getByRole("button", { name: "settings:adminAgent.restoreDefaults" }),
  );
  expect(mocks.mutate).not.toHaveBeenCalled();
  fireEvent.click(
    await screen.findByRole("button", { name: "settings:adminAgent.restore" }),
  );
  expect(mocks.mutate).toHaveBeenCalledWith(
    null,
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
});
