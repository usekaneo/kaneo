import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { SettingsNavProject as SettingsNavProjectModel } from "@/components/settings/nav/types";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";

type SettingsNavProjectProps = {
  project: SettingsNavProjectModel;
  pathname: string;
};

export function SettingsNavProject({
  project,
  pathname,
}: SettingsNavProjectProps) {
  const containsActivePage = project.links.some((link) => link.to === pathname);
  const [open, setOpen] = useState(containsActivePage);

  useEffect(() => {
    if (containsActivePage) setOpen(true);
  }, [containsActivePage]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-expanded={open}
        className="h-8 text-sm aria-expanded:font-medium aria-expanded:text-sidebar-accent-foreground"
        onClick={() => setOpen((current) => !current)}
      >
        <project.icon aria-hidden="true" />
        <span className="flex-1 truncate">{project.name}</span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "ml-auto size-3.5! text-sidebar-foreground/60 transition-transform duration-150 ease-out",
            open && "rotate-90",
          )}
        />
      </SidebarMenuButton>
      {open ? (
        <SidebarMenuSub className="mx-4 my-0.5 gap-0.5 px-2">
          {project.links.map((link) => (
            <SidebarMenuSubItem key={link.id}>
              <SidebarMenuSubButton
                isActive={pathname === link.to}
                className="h-7 data-[active=true]:font-medium"
                render={<Link to={link.to} />}
              >
                <span>{link.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}
