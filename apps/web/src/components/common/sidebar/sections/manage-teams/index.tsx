import { cn } from "@/lib/cn";
import { Route } from "@/routes/dashboard/workspace/$workspaceId";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Users } from "lucide-react";

function ManageTeams() {
  const { isSidebarOpened } = useUserPreferencesStore();
  const navigate = useNavigate();
  const { workspaceId } = Route.useParams();
  const { setProject } = useProjectStore();
  const location = useRouterState({ select: (s) => s.location });
  const isOnTeamsRoute = location.pathname.includes("/team");

  const onManageTeams = () => {
    setProject(undefined);
    navigate({
      to: "/dashboard/workspace/$workspaceId/team",
      params: {
        workspaceId,
      },
    });
  };

  return (
    <div>
      <h2
        className={cn(
          "text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2",
          isSidebarOpened && "px-3",
        )}
      >
        {isSidebarOpened && "Team"}
      </h2>
      <button
        type="button"
        className={cn(
          "w-full text-left py-2 rounded-md flex items-center text-sm transition-all group",
          isSidebarOpened && "px-3",
          !isSidebarOpened && "justify-center px-2",
          "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
          isOnTeamsRoute &&
            "bg-indigo-51 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
        )}
        title={!isSidebarOpened ? "Manage Team" : undefined}
        onClick={() => onManageTeams()}
      >
        <Users
          className={cn(
            "shrink-0",
            !isSidebarOpened ? "w-6 h-6" : "w-4 h-4 mr-2",
          )}
        />
        {isSidebarOpened && "Manage Team"}
      </button>
    </div>
  );
}

export default ManageTeams;
