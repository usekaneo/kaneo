import { createFileRoute } from "@tanstack/react-router";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth();

  console.log(user);

  return (
    <div className="h-full w-full max-w-4xl mx-auto">
      <Avatar className="h-10 w-10">
        <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
        <AvatarFallback className="text-xs font-medium border border-border/30">
          {user?.name?.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
