import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";

type DirectoryAvatarProps = {
  name: string;
  image: string | null | undefined;
};

export function DirectoryAvatar({ name, image }: DirectoryAvatarProps) {
  return (
    <Avatar className="size-7 border bg-muted">
      {image ? <AvatarImage src={image} alt={name} /> : null}
      <AvatarFallback className="text-[10px] font-semibold">
        {getInitials(name, "?")}
      </AvatarFallback>
    </Avatar>
  );
}
