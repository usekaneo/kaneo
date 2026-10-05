import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { IntegrationDefinition } from "@/components/project/integrations/integration-definitions";
import { IntegrationRow } from "@/components/project/integrations/integration-row";

vi.mock("@/components/project/sync-rules/sync-rules-section", () => ({
  SyncRulesSection: () => <p>Sync rules</p>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const integration: IntegrationDefinition = {
  id: "github",
  name: "GitHub",
  category: "code",
  descriptionKey: "settings:projectIntegrations.githubSectionSubtitle",
  icon: () => <svg />,
  iconClassName: "",
  Settings: () => <p>Integration settings</p>,
};
afterEach(cleanup);

describe("IntegrationRow", () => {
  it.each([undefined, { state: "loading" as const }])(
    "does not offer Connect before status is known",
    (status) => {
      render(
        <IntegrationRow
          integration={integration}
          projectId="p1"
          status={status}
          onRetry={vi.fn()}
        />,
      );
      const trigger = screen.getByRole("button", {
        name: "common:empty.loading",
      });
      expect(trigger).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(trigger);
      expect(
        screen.queryByRole("button", {
          name: "settings:projectIntegrations.connect",
        }),
      ).toBeNull();
      expect(screen.queryByText("Integration settings")).toBeNull();
    },
  );
  it("offers a retry after a failed read instead of a connection form", () => {
    const onRetry = vi.fn();
    render(
      <IntegrationRow
        integration={integration}
        projectId="p1"
        status={{ state: "unavailable" }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("common:error.title");
    fireEvent.click(
      screen.getByRole("button", { name: "common:error.tryAgain" }),
    );
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByText("Integration settings")).toBeNull();
  });
  it("keeps an open panel mounted after a background status failure", () => {
    const props = { integration, projectId: "p1", onRetry: vi.fn() };
    const { rerender } = render(
      <IntegrationRow {...props} status={{ state: "connected" }} />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:projectIntegrations.configure",
      }),
    );
    const panel = screen.getByText("Integration settings");
    rerender(<IntegrationRow {...props} status={{ state: "unavailable" }} />);
    expect(screen.getByText("Integration settings")).toBe(panel);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:projectIntegrations.done" }),
    );
    expect(
      screen.getByRole("button", { name: "common:error.tryAgain" }),
    ).toBeEnabled();
  });

  it("offers Connect after a successful unconfigured status read", () => {
    render(
      <IntegrationRow
        integration={integration}
        projectId="p1"
        status={{ state: "disconnected" }}
        onRetry={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:projectIntegrations.connect",
      }),
    );
    expect(screen.getByText("Integration settings")).toBeVisible();
  });
  it.each(["connected", "paused"] as const)(
    "shows configuration for a %s integration",
    (state) => {
      render(
        <IntegrationRow
          integration={integration}
          projectId="p1"
          status={{ state, detail: "acme/web" }}
          onRetry={vi.fn()}
        />,
      );
      expect(screen.getByText("acme/web")).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", {
          name: "settings:projectIntegrations.configure",
        }),
      );
      expect(screen.getByText("Integration settings")).toBeVisible();
      expect(
        screen.getByRole("button", {
          name: "settings:projectIntegrations.done",
        }),
      ).toBeEnabled();
    },
  );
});
