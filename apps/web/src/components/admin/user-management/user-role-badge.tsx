import { Badge } from "@/components/ui/badge";
import { useInstanceRoleLabel } from "./use-instance-role-label";

type UserRoleBadgeProps = {
  role: string;
};

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  const roleLabel = useInstanceRoleLabel();

  return role === "user" ? (
    <Badge variant="secondary" className="px-1.5 text-muted-foreground">
      {roleLabel(role)}
    </Badge>
  ) : (
    <Badge variant="outline" className="max-w-full truncate px-1.5">
      {roleLabel(role)}
    </Badge>
  );
}
