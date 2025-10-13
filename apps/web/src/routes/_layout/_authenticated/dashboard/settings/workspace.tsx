import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace",
)({
  component: RouteComponent,
});

const menuItems = [
  {
    title: "General",
    url: "/dashboard/settings/workspace/general",
    icon: Settings,
  },
];

function RouteComponent() {
  const { workspace, role } = useWorkspacePermission();
  const location = useLocation();

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
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Workspace
              </h3>
              <nav className="space-y-0.5">
                {menuItems.map((item) => (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      location.pathname === item.url
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    <span>{item.title}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
