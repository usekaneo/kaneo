import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Separator } from "@/components/ui/separator";
import useSignOut from "@/hooks/mutations/use-sign-out";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";

export function UserAvatar() {
  const { user } = useAuth();
  const { mutateAsync: signOut, isPending } = useSignOut();
  const queryClient = useQueryClient();
  const { setProject } = useProjectStore();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      queryClient.clear();
      setProject(undefined);
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sign out",
      );
    }
  };

  const handleSettings = () => {
    navigate({ to: "/dashboard/settings/account/information" });
  };

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user.email?.substring(0, 2).toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full p-0 hover:bg-sidebar-accent/70"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.image ?? ""} alt={user.name || ""} />
            <AvatarFallback className="text-xs font-medium border border-border/30">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52 p-0" side="bottom" align="start">
        <div className="px-2.5 py-2">
          <div className="flex items-center gap-2 text-left text-sm">
            <Avatar className="h-7 w-7 rounded-full">
              <AvatarImage src={user.image ?? ""} alt={user.name || ""} />
              <AvatarFallback className="rounded-full border border-border/30">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {user.name || "User"}
              </span>
              {user.email && (
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="p-0.5">
          <DropdownMenuItem
            onClick={handleSettings}
            className="h-7 gap-2 px-2 text-sm font-normal"
          >
            <Settings className="size-3.5" />
            Settings
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator />

        <div className="p-0.5">
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={isPending}
            className="h-7 gap-2 px-2 text-sm font-normal"
          >
            <LogOut className="size-3.5" />
            {isPending ? "Signing out..." : "Log out"}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
