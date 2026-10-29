import { UnassignedAvatar } from "@/components/common/unassigned-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/get-initials";

type AssigneeAvatarProps = {
  name: string | null | undefined;
  image: string | null | undefined;
  assigned: boolean;
  className?: string;
  fallbackClassName?: string;
};

export function AssigneeAvatar({
  name,
  image,
  assigned,
  className,
  fallbackClassName,
}: AssigneeAvatarProps) {
  if (!assigned) {
    return <UnassignedAvatar className={cn("size-4.5", className)} />;
  }

  return (
    <Avatar className={cn("size-4.5 shrink-0", className)}>
      <AvatarImage src={image ?? ""} alt="" />
      <AvatarFallback
        className={cn(
          "border border-avatar-border bg-avatar font-semibold text-[8px] text-avatar-foreground",
          fallbackClassName,
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
