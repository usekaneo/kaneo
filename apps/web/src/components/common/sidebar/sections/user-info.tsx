import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import useSignOut from "@/hooks/mutations/use-sign-out";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import useWorkspaceStore from "@/store/workspace";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import { toast } from "sonner";

function UserInfo() {
  const { user, setUser } = useAuth();
  const { isSidebarOpened } = useUserPreferencesStore();
  const navigate = useNavigate();
  const { mutateAsync: signOut, isPending } = useSignOut();
  const queryClient = useQueryClient();
  const { setProject } = useProjectStore();
  const { setWorkspace } = useWorkspaceStore();

  const handleSignOut = async () => {
    try {
      await signOut();
      queryClient.clear();
      setUser(null);
      setProject(undefined);
      setWorkspace(undefined);
      toast.success("Signed out successfully");
      navigate({ to: "/auth/sign-in" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sign out",
      );
    }
  };

  const handleClickSettings = () => {
    navigate({ to: "/dashboard/settings/appearance" });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center w-full",
            isSidebarOpened ? "gap-3 justify-start" : "justify-center",
            "rounded-lg p-2 transition-all",
            "border border-transparent",
            "hover:bg-white dark:hover:bg-zinc-800/50",
            "hover:border-zinc-200 dark:hover:border-zinc-700/50",
            "hover:shadow-sm dark:hover:shadow-none",
          )}
        >
          <Avatar className="text-zinc-900 dark:text-zinc-100">
            <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className={cn(!isSidebarOpened && "hidden")}>
            <p className="text-sm text-left font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {user?.name}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {user?.email}
            </p>
          </div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-50"
          align="start"
          sideOffset={5}
        >
          <DropdownMenu.Item
            className="flex items-center px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer outline-none"
            onClick={handleClickSettings}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

          <DropdownMenu.Item
            className="flex items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer outline-none"
            onClick={handleSignOut}
            disabled={isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {isPending ? "Signing out..." : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default UserInfo;
