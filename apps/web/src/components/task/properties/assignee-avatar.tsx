import { UnassignedAvatar } from "@/components/common/unassigned-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";

type AssigneeAvatarProps = {
  name: string | null | undefined;
  image: string | null | undefined;
  assigned: boolean;
};

export function AssigneeAvatar({ name, image, assigned }: AssigneeAvatarProps) {
  if (!assigned) return <UnassignedAvatar className="size-4.5" />;

  return (
    <Avatar className="size-4.5 shrink-0">
      <AvatarImage src={image ?? ""} alt="" />
      <AvatarFallback className="font-semibold text-[8px]">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
