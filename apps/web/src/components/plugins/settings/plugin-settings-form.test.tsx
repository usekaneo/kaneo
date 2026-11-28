import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { InstalledPlugin } from "@/types/plugin";
import { PluginSettingsForm } from "./plugin-settings-form";

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/plugin/use-update-plugin-workspace", () => ({
  useUpdatePluginWorkspace: () => ({ mutateAsync, isPending: false }),
}));

afterEach(cleanup);

it("removes a saved replacement secret from the form even when its public state is unchanged", async () => {
  const workspace = {
    enabled: true,
    settings: {},
    configuredSecrets: ["token"],
  };
  const plugin: InstalledPlugin = {
    id: "test-plugin",
    packageName: "test-plugin",
    name: "Test plugin",
    version: "1.0.0",
    description: null,
    official: false,
    settings: { token: { type: "secret", label: "Token" } },
    web: null,
    workspace,
  };
  mutateAsync.mockResolvedValue(workspace);

  render(
    <PluginSettingsForm
      plugin={plugin}
      workspaceId="test-workspace"
      canEdit
      externalErrors={{}}
      onSaved={() => {}}
    />,
  );
  const key = "settings:workspacePlugins.form";
  fireEvent.click(screen.getByRole("button", { name: `${key}.secretReplace` }));
  fireEvent.change(screen.getByPlaceholderText(`${key}.secretPlaceholder`), {
    target: { value: "test-replacement" },
  });
  const save = screen.getByRole("button", { name: `${key}.save` });
  fireEvent.click(save);

  await waitFor(() => expect(save).toBeDisabled());
  expect(screen.queryByPlaceholderText(`${key}.secretPlaceholder`)).toBeNull();
  expect(mutateAsync).toHaveBeenCalledWith({
    pluginId: plugin.id,
    workspaceId: "test-workspace",
    settings: { token: "test-replacement" },
  });
});
