import { FolderKanban, Hash } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AgentMentionType } from "./agent-mention-token";

export function AgentMentionIcon({
  type,
  className,
}: {
  type: AgentMentionType;
  className?: string;
}) {
  const Icon = type === "project" ? FolderKanban : Hash;
  return <Icon aria-hidden="true" className={cn("shrink-0", className)} />;
}
