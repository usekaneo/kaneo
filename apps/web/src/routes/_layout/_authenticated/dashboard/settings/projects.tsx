import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { ChevronRight, Eye, Plug, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import icons from "@/constants/project-icons";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects",
)({
  component: RouteComponent,
});

const menuItems = [
  {
    title: "General",
    icon: Settings,
  },
  {
    title: "Visibility",
    icon: Eye,
  },
  {
    title: "Integrations",
    icon: Plug,
  },
];

function RouteComponent() {
  const { workspace, role } = useWorkspacePermission();
  const location = useLocation();
  const { data: projects } = useGetProjects({
    workspaceId: workspace?.id || "",
  });

  return (
    <div className="flex gap-6 h-full">
      <div className="w-64 flex-shrink-0">
        <div className="p-4 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={workspace?.logo ?? ""}
                alt={workspace?.name || ""}
              />
              <AvatarFallback className="text-md text-white bg-primary font-medium border border-border/30">
                {workspace?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p className="text-sm font-medium">{workspace?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          </div>

          <div className="space-y-4">
            <Collapsible defaultOpen={true} className="group/collapsible">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Projects
              </h3>
              <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2 duration-200">
                <nav className="space-y-0.5">
                  {projects?.map((project) => {
                    const IconComponent =
                      icons[project.icon as keyof typeof icons] || icons.Layout;

                    return (
                      <Collapsible
                        key={project.id}
                        defaultOpen={true}
                        className="group/project-collapsible"
                      >
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-md transition-all duration-200 cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group text-muted-foreground">
                            <IconComponent className="w-3.5 h-3.5" />
                            <span>{project.name}</span>
                            <ChevronRight className="w-4 h-4 ml-auto transition-transform duration-200 group-data-[state=open]/project-collapsible:rotate-90" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2 duration-200">
                          <div className="flex flex-col gap-1 ml-6 mt-1">
                            {menuItems.map((item) => {
                              const urlMap = {
                                General: `/dashboard/settings/projects/${project.id}/general`,
                                Visibility: `/dashboard/settings/projects/${project.id}/visibility`,
                                Integrations: `/dashboard/settings/projects/${project.id}/integrations`,
                              };

                              const toUrl =
                                urlMap[item.title as keyof typeof urlMap];

                              const isActive = location.pathname === toUrl;

                              return (
                                <Link
                                  key={item.title}
                                  to={toUrl}
                                  className={cn(
                                    "flex items-center gap-2.5 px-3 py-2 text-xs rounded-md transition-all duration-200",
                                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    isActive
                                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  <item.icon className="h-3.5 w-3.5" />
                                  <span>{item.title}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </nav>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
