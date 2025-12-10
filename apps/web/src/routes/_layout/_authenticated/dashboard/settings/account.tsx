import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { Code, Settings, User } from "lucide-react";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account",
)({
  component: RouteComponent,
});

const menuItems = [
  {
    title: "Information",
    url: "/dashboard/settings/account/information",
    icon: User,
  },
  {
    title: "Preferences",
    url: "/dashboard/settings/account/preferences",
    icon: Settings,
  },
];

function RouteComponent() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="flex gap-6 h-full">
      <div className="w-64 flex-shrink-0">
        <div className="p-4 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
              <AvatarFallback className="text-xs font-medium border border-border/30">
                {user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Account
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

            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Developer
              </h3>
              <nav className="space-y-0.5">
                <Link
                  to="/dashboard/settings/account/developer"
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    location.pathname === "/dashboard/settings/account/developer"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  <Code className="h-3.5 w-3.5" />
                  <span>API Keys</span>
                </Link>
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
