import type * as React from "react";
import { useTranslation } from "react-i18next";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { ThemeToggleDropdown } from "@/components/theme-toggle-dropdown";
import { TrialCard } from "@/components/trial-card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { VersionDisplay } from "@/components/version-display";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { getLocaleDirection, resolveLocale } from "@/lib/i18n";
import Search from "./search";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { toggleSidebar } = useSidebar();
  const { i18n } = useTranslation();

  const side: "left" | "right" =
    getLocaleDirection(resolveLocale(i18n.resolvedLanguage ?? null, null)) ===
    "rtl"
      ? "right"
      : "left";

  useRegisterShortcuts({
    modifierShortcuts: {
      [shortcuts.sidebar.prefix]: {
        [shortcuts.sidebar.toggle]: toggleSidebar,
      },
    },
  });

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="inset"
      {...props}
      side={side}
      className="border-none pt-1.5"
    >
      <SidebarHeader className="pt-1 pb-1.5">
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden gap-1 py-1">
        <Search />
        <NavMain />
        <NavProjects />
      </SidebarContent>
      <SidebarFooter>
        <TrialCard />
        <div className="flex items-center justify-between">
          <VersionDisplay />
          <ThemeToggleDropdown />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
