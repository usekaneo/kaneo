import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { shortcutRegistry } from "@/lib/shortcuts/registry";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import type {
  PluginViewRef,
  ProjectPluginView,
} from "./use-project-plugin-views";
import { usePluginViewShortcuts } from "./use-plugin-view-shortcuts";

const view = (
  pluginId: string,
  viewId: string,
  shortcut?: string,
): ProjectPluginView => ({
  pluginId,
  viewId,
  title: viewId,
  icon: undefined,
  shortcut,
});

function Harness({
  views,
  goToView,
  enabled = true,
}: {
  views: ProjectPluginView[];
  goToView: (view: PluginViewRef) => void;
  enabled?: boolean;
}) {
  usePluginViewShortcuts(views, goToView, enabled);
  return null;
}

function press(...keys: string[]) {
  for (const key of keys) fireEvent.keyDown(document.body, { key });
}

afterEach(() => {
  cleanup();
  shortcutRegistry.reset();
});

describe("usePluginViewShortcuts", () => {
  it("opens a plugin view with the prefix and its letter", () => {
    const goToView = vi.fn();
    render(
      <ShortcutTestWrapper>
        <Harness
          views={[view("gantt", "timeline", "g"), view("notes", "list")]}
          goToView={goToView}
        />
      </ShortcutTestWrapper>,
    );

    press("v", "g");

    expect(goToView).toHaveBeenCalledWith({
      pluginId: "gantt",
      viewId: "timeline",
    });
  });

  it("registers nothing while disabled", () => {
    const goToView = vi.fn();
    render(
      <ShortcutTestWrapper>
        <Harness
          views={[view("gantt", "timeline", "g")]}
          goToView={goToView}
          enabled={false}
        />
      </ShortcutTestWrapper>,
    );

    press("v", "g");

    expect(goToView).not.toHaveBeenCalled();
  });
});
