import { defaultParseSearch } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  search: {} as { githubAccountLink?: boolean; error?: string },
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ projectId: "project" }),
    useSearch: () => mocks.search,
  }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/project/github-integration-settings", () => ({
  GitHubIntegrationSettings: ({
    accountLinkError,
  }: {
    accountLinkError?: string;
  }) => (accountLinkError ? <div role="alert">{accountLinkError}</div> : null),
}));
vi.mock("@/components/project/discord-integration-settings", () => ({
  DiscordIntegrationSettings: () => null,
}));
vi.mock("@/components/project/generic-webhook-integration-settings", () => ({
  GenericWebhookIntegrationSettings: () => null,
}));
vi.mock("@/components/project/gitea-integration-settings", () => ({
  GiteaIntegrationSettings: () => null,
}));
vi.mock("@/components/project/gitlab-integration-settings", () => ({
  GitlabIntegrationSettings: () => null,
}));
vi.mock("@/components/project/mattermost-integration-settings", () => ({
  MattermostIntegrationSettings: () => null,
}));
vi.mock("@/components/project/slack-integration-settings", () => ({
  SlackIntegrationSettings: () => null,
}));
vi.mock("@/components/project/telegram-integration-settings", () => ({
  TelegramIntegrationSettings: () => null,
}));

import { Route } from "./integrations";

afterEach(cleanup);
beforeEach(() => {
  mocks.search = {};
});

it("opens GitHub settings and shows the callback error on arrival", () => {
  const search = Route.options.validateSearch.parse(
    defaultParseSearch("?githubAccountLink=true&error=unable_to_link_account"),
  );
  mocks.search = search;
  const Component = Route.options.component;
  render(<Component />);
  expect(screen.getByRole("alert")).toHaveTextContent("unable_to_link_account");
  expect(
    screen.getByRole("button", {
      name: /settings:projectIntegrations.githubSectionTitle/,
    }),
  ).toHaveAttribute("aria-expanded", "true");
});

it.each([undefined, false, "unexpected"])(
  "ignores an OAuth error without the GitHub callback marker %s",
  (githubAccountLink) => {
    mocks.search = Route.options.validateSearch.parse({
      githubAccountLink,
      error: "unable_to_link_account",
    });
    const Component = Route.options.component;
    render(<Component />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /settings:projectIntegrations.githubSectionTitle/,
      }),
    ).toHaveAttribute("aria-expanded", "false");
  },
);
