import { Hash, Lock, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatConversation } from "@/fetchers/chat";
import { cn } from "@/lib/cn";
import { formatDate, formatDateShort } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";

/** Channels show their name; DMs show the other people in them. */
export function conversationTitle(
  conversation: ChatConversation,
  meId: string | undefined,
  selfLabel: string,
) {
  if (conversation.type === "channel") return conversation.name ?? "";
  const others = conversation.members.filter((m) => m.id !== meId);
  if (others.length === 0) return selfLabel;
  return others.map((m) => m.name).join(", ");
}

export function messageTime(value: string | Date) {
  return formatDate(value, { hour: "numeric", minute: "2-digit" });
}

/** Time today, weekday this week, short date before that. */
export function listTime(value: string | Date) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return messageTime(date);
  if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
    return formatDate(date, { weekday: "short" });
  }
  return formatDateShort(date);
}

export function PersonAvatar({
  name,
  image,
  className,
}: {
  name: string | null;
  image: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-6 rounded-lg", className)}>
      <AvatarImage src={image ?? ""} alt={name ?? ""} />
      <AvatarFallback className="rounded-lg bg-primary/10 text-[10px] font-semibold text-primary">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function ConversationIcon({
  conversation,
  meId,
  size = "sm",
  className,
}: {
  conversation: ChatConversation;
  meId: string | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = { sm: "size-6", md: "size-8", lg: "size-12" }[size];
  const glyph = { sm: "size-3.5", md: "size-4", lg: "size-6" }[size];

  if (conversation.type === "channel") {
    const Icon = conversation.isPrivate ? Lock : Hash;
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
          box,
          className,
        )}
      >
        <Icon className={glyph} />
      </span>
    );
  }
  const others = conversation.members.filter((m) => m.id !== meId);
  if (others.length > 1) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
          box,
          className,
        )}
      >
        <Users className={glyph} />
      </span>
    );
  }
  const person = others[0] ?? conversation.members[0];
  return (
    <PersonAvatar
      name={person?.name ?? null}
      image={person?.image ?? null}
      className={cn(box, size === "lg" && "text-sm", className)}
    />
  );
}

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}
