import { Link } from "@tanstack/react-router";
import type { SettingsNavGroup as SettingsNavGroupModel } from "@/components/settings/nav/types";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SettingsNavGroupProps = {
  group: SettingsNavGroupModel;
  pathname: string;
};

export function SettingsNavGroup({ group, pathname }: SettingsNavGroupProps) {
  return (
    <SidebarGroup className="gap-0.5 px-2 py-1.5">
      <SidebarGroupLabel className="h-7 truncate text-sidebar-foreground/70">
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {group.links.map((link) => (
            <SidebarMenuItem key={link.id}>
              <SidebarMenuButton
                isActive={pathname === link.to}
                className="h-8 text-sm"
                render={<Link to={link.to} />}
              >
                <link.icon aria-hidden="true" />
                <span>{link.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
