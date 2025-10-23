import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import useSignOut from "@/hooks/mutations/use-sign-out";
import useProjectStore from "@/store/project";

export function UserAvatar() {
  const { user } = useAuth();
  const { mutateAsync: signOut, isPending } = useSignOut();
  const queryClient = useQueryClient();
  const { setProject } = useProjectStore();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      queryClient.clear();
      setProject(undefined);
      setOpen(false);
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sign out",
      );
    }
  };

  const handleSettings = () => {
    navigate({ to: "/dashboard/settings/account/information" });
    setOpen(false);
  };

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user.email?.substring(0, 2).toUpperCase() || "U";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 rounded-full p-0 hover:bg-secondary/50"
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={user.image ?? ""} alt={user.name || ""} />
            <AvatarFallback className="text-xs font-medium border border-border/30">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-0 rounded-lg"
        side="bottom"
        align="start"
        sideOffset={4}
      >
        <div className="p-3">
          <div className="flex items-center gap-2 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-full">
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

        <div className="p-1">
          <Button
            variant="ghost"
            onClick={handleSettings}
            className="w-full justify-start gap-2 px-2 py-1.5 text-sm font-normal text-muted-foreground hover:bg-secondary/80"
          >
            <Settings className="size-3" />
            Settings
          </Button>
        </div>

        <Separator />

        <div className="p-1">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            disabled={isPending}
            className="w-full justify-start gap-2 px-2 py-1.5 text-sm font-normal text-muted-foreground hover:bg-secondary/80"
          >
            <LogOut className="size-3" />
            {isPending ? "Signing out..." : "Log out"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
