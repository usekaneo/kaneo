import { useTranslation } from "react-i18next";
import { SettingsNavProject } from "@/components/settings/nav/settings-nav-project";
import type { SettingsNavProject as SettingsNavProjectModel } from "@/components/settings/nav/types";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";

type SettingsNavProjectsProps = {
  projects: SettingsNavProjectModel[];
  pathname: string;
};

export function SettingsNavProjects({
  projects,
  pathname,
}: SettingsNavProjectsProps) {
  const { t } = useTranslation();

  if (projects.length === 0) return null;

  return (
    <SidebarGroup className="gap-0.5 px-2 py-1.5">
      <SidebarGroupLabel className="h-7 text-sidebar-foreground/70">
        {t("navigation:sidebar.projects")}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {projects.map((project) => (
            <SettingsNavProject
              key={project.id}
              project={project}
              pathname={pathname}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
