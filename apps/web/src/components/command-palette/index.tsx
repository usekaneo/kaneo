import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { useShortcutsPanelStore } from "@/components/shortcuts/shortcuts-panel-store";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, CornerDownLeftIcon } from "lucide-react";
import { Fragment, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import SearchCommandMenu from "@/components/search-command-menu";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import CreateWorkspaceModal from "@/components/shared/modals/create-workspace-modal";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import type { ShortcutId } from "@/lib/shortcuts/catalog";
import { authClient } from "@/lib/auth-client";
import { hasInstanceAdminRole } from "@/lib/instance-admin";
import { useUserPreferencesStore } from "@/store/user-preferences";
import CreateProjectModal from "../shared/modals/create-project-modal";

type PaletteActionItem = {
  value: string;
  label: string;
  shortcutId?: ShortcutId;
  onRun: () => void;
};

type PaletteGroup = {
  value: string;
  label: string;
  items: PaletteActionItem[];
};

function CommandPalette() {
  const { t } = useTranslation();
  const { setTheme } = useUserPreferencesStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: workspace } = useActiveWorkspace();
  const { data: session } = authClient.useSession();
  const { data: config } = useGetConfig();
  const isAdmin = hasInstanceAdminRole(session?.user?.role);
  const canCreateWorkspace =
    isAdmin || (config !== undefined && !config.disableWorkspaceCreation);
  const [open, setOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const projectIdFromRoute =
    location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? undefined;
  const isBacklogView = location.pathname.endsWith("/backlog");

  const openShortcutsPanel = useShortcutsPanelStore((state) => state.setOpen);

  useShortcut("openCommandMenu", () => setOpen((prev) => !prev));
  useShortcut("createTask", () => setIsCreateTaskOpen(true));
  useShortcut("createProject", () => setIsCreateProjectOpen(true));

  const runCommand = useCallback((command: () => void) => {
    command();
    setOpen(false);
  }, []);

  const groupedItems = useMemo<PaletteGroup[]>(
    () => [
      {
        value: "suggestions",
        label: t("navigation:commandPalette.suggestions"),
        items: [
          {
            value: "projects",
            label: t("navigation:commandPalette.projects"),
            shortcutId: "goToProjects",
            onRun: () => {
              if (!workspace?.id) return;
              navigate({
                to: "/dashboard/workspace/$workspaceId/projects",
                params: { workspaceId: workspace.id },
              });
            },
          },
          {
            value: "search",
            label: t("navigation:commandPalette.search"),
            shortcutId: "openSearch",
            onRun: () => setIsSearchOpen(true),
          },
          {
            value: "members",
            label: t("navigation:commandPalette.members", {
              defaultValue: "Members",
            }),
            onRun: () => {
              navigate({ to: "/dashboard/settings/workspace/members" });
            },
          },
          {
            value: "create-task",
            label: t("navigation:commandPalette.createTask"),
            shortcutId: "createTask",
            onRun: () => setIsCreateTaskOpen(true),
          },
          {
            value: "create-project",
            label: t("navigation:commandPalette.createProject"),
            shortcutId: "createProject",
            onRun: () => setIsCreateProjectOpen(true),
          },
        ],
      },
      {
        value: "commands",
        label: t("navigation:commandPalette.commands"),
        items: [
          ...(canCreateWorkspace
            ? [
                {
                  value: "create-workspace",
                  label: t("navigation:commandPalette.createWorkspace"),
                  onRun: () => setIsCreateWorkspaceOpen(true),
                },
              ]
            : []),
          {
            value: "theme-light",
            label: t("navigation:commandPalette.lightTheme"),
            onRun: () => setTheme("light"),
          },
          {
            value: "theme-dark",
            label: t("navigation:commandPalette.darkTheme"),
            onRun: () => setTheme("dark"),
          },
          {
            value: "theme-system",
            label: t("navigation:commandPalette.systemTheme"),
            onRun: () => setTheme("system"),
          },
          {
            value: "keyboard-shortcuts",
            label: t("navigation:commandPalette.keyboardShortcuts"),
            shortcutId: "openShortcuts",
            onRun: () => openShortcutsPanel(true),
          },
        ],
      },
    ],
    [
      navigate,
      setTheme,
      t,
      workspace?.id,
      canCreateWorkspace,
      openShortcutsPanel,
    ],
  );

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandDialogPopup instant finalFocus={false}>
          <Command items={groupedItems}>
            <CommandInput
              placeholder={t("navigation:commandPalette.inputPlaceholder")}
            />
            <CommandPanel>
              <CommandEmpty>
                {t("navigation:commandPalette.empty")}
              </CommandEmpty>
              <CommandList>
                {(group: PaletteGroup, groupIndex: number) => (
                  <Fragment key={group.value}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.label}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: PaletteActionItem) => {
                          return (
                            <CommandItem
                              key={item.value}
                              value={item.value}
                              onClick={() => runCommand(item.onRun)}
                              className="px-3"
                            >
                              <span className="flex-1">{item.label}</span>
                              {item.shortcutId && (
                                <CommandShortcut>
                                  <ShortcutKeys
                                    id={item.shortcutId}
                                    tone="muted"
                                  />
                                </CommandShortcut>
                              )}
                            </CommandItem>
                          );
                        }}
                      </CommandCollection>
                    </CommandGroup>
                    {groupIndex < groupedItems.length - 1 && (
                      <CommandSeparator />
                    )}
                  </Fragment>
                )}
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <KbdGroup>
                    <Kbd>
                      <ArrowUpIcon />
                    </Kbd>
                    <Kbd>
                      <ArrowDownIcon />
                    </Kbd>
                  </KbdGroup>
                  <span>{t("navigation:commandPalette.footer.navigate")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Kbd>
                    <CornerDownLeftIcon />
                  </Kbd>
                  <span>{t("navigation:commandPalette.footer.open")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Kbd>Esc</Kbd>
                <span>{t("navigation:commandPalette.footer.close")}</span>
              </div>
            </CommandFooter>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>

      <SearchCommandMenu open={isSearchOpen} setOpen={setIsSearchOpen} />
      <CreateTaskModal
        open={isCreateTaskOpen}
        projectId={projectIdFromRoute}
        status={isBacklogView ? "planned" : undefined}
        onClose={() => setIsCreateTaskOpen(false)}
        instant
      />
      <CreateWorkspaceModal
        open={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
      />
      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </>
  );
}

export default CommandPalette;
