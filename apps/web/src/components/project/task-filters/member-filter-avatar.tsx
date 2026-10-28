import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";

export function MemberFilterAvatar({
  name,
  image,
}: {
  name?: string | null;
  image?: string | null;
}) {
  return (
    <Avatar className="size-4">
      <AvatarImage src={image ?? ""} alt="" />
      <AvatarFallback className="border border-border/30 text-[8px] font-medium">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
