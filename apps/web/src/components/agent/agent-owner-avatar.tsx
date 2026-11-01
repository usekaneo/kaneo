import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";
import type { AgentConversationOwner } from "@/types/agent";

type AgentOwnerAvatarProps = {
  owner: AgentConversationOwner;
  // Omit when the owner's name is already shown next to the avatar.
  label?: string;
};

export function AgentOwnerAvatar({ owner, label }: AgentOwnerAvatarProps) {
  return (
    <Avatar
      className="size-5"
      {...(label
        ? { role: "img", "aria-label": label, title: label }
        : { "aria-hidden": true })}
    >
      {owner.image ? <AvatarImage src={owner.image} alt="" /> : null}
      <AvatarFallback className="border border-border/30 font-semibold text-[8px] text-muted-foreground">
        {getInitials(owner.name, "?")}
      </AvatarFallback>
    </Avatar>
  );
}
