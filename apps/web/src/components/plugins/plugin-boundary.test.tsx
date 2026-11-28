import { cleanup, render, screen } from "@testing-library/react";
import type { PluginInfo } from "@kaneo/plugin-sdk/web";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@sentry/react", () => ({ captureReactException: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PluginBoundary } from "./plugin-boundary";

const scope: PluginInfo = {
  id: "progress",
  version: "1.2.0",
  workspaceId: "workspace-1",
  settings: {},
};

function Page({ fail }: { fail: boolean }) {
  if (fail) throw new Error("render failed");
  return <p>page content</p>;
}

describe("PluginBoundary", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("recovers when the reset key changes", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { rerender } = render(
      <PluginBoundary scope={scope} resetKey="workspace-1:report">
        <Page fail />
      </PluginBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(
      <PluginBoundary scope={scope} resetKey="workspace-1:report">
        <Page fail={false} />
      </PluginBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(
      <PluginBoundary scope={scope} resetKey="workspace-1:summary">
        <Page fail={false} />
      </PluginBoundary>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("page content")).toBeTruthy();
  });
});
