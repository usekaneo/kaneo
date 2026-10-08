import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { normalizeSettingsPath } from "@/components/settings/nav/get-settings-breadcrumb";
import { SettingsNavGroup } from "@/components/settings/nav/settings-nav-group";
import { SettingsNavProjects } from "@/components/settings/nav/settings-nav-projects";
import { SettingsSidebarHeader } from "@/components/settings/nav/settings-sidebar-header";
import type { SettingsNav } from "@/components/settings/nav/types";
import { Sidebar, SidebarContent, useSidebar } from "@/components/ui/sidebar";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";

type SettingsSidebarProps = {
  nav: SettingsNav;
  onLeave: (() => void) | undefined;
};

export function SettingsSidebar({ nav, onLeave }: SettingsSidebarProps) {
  const pathname = useLocation({
    select: (location) => normalizeSettingsPath(location.pathname),
  });
  const { setOpenMobile, toggleSidebar } = useSidebar();

  useRegisterShortcuts({
    modifierShortcuts: {
      [shortcuts.sidebar.prefix]: {
        [shortcuts.sidebar.toggle]: toggleSidebar,
      },
    },
  });

  useEffect(() => {
    if (pathname) setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="offcanvas" variant="inset" className="border-none">
      <SettingsSidebarHeader onLeave={onLeave} />
      <SidebarContent className="gap-0 pb-2">
        <SettingsNavGroup group={nav.account} pathname={pathname} />
        <SettingsNavGroup group={nav.workspace} pathname={pathname} />
        <SettingsNavProjects projects={nav.projects} pathname={pathname} />
        {nav.admin ? (
          <SettingsNavGroup group={nav.admin} pathname={pathname} />
        ) : null}
      </SidebarContent>
    </Sidebar>
  );
}
