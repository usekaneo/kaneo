import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import type { ChatConversation } from "@/fetchers/chat";
import { cn } from "@/lib/cn";
import {
  ConversationIcon,
  conversationTitle,
  listTime,
  UnreadBadge,
} from "./chat-shared";

type Props = {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChannel: () => void;
  onNewMessage: () => void;
};

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNewChannel,
  onNewMessage,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  const titleOf = (c: ChatConversation) =>
    conversationTitle(c, user?.id, t("chat:you"));
  const visible = conversations.filter(
    (c) => !query || titleOf(c).toLowerCase().includes(query),
  );

  // Joined channels first; open channels you could join trail below them.
  const channels = visible
    .filter((c) => c.type === "channel")
    .sort((a, b) => Number(b.joined) - Number(a.joined));
  const dms = visible.filter((c) => c.type === "dm");

  const row = (c: ChatConversation) => {
    const unread = c.unreadCount > 0;
    const active = c.id === activeId;
    const last = c.lastMessage;
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => onSelect(c.id)}
          aria-current={active ? "true" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/60",
            active && "bg-accent hover:bg-accent",
          )}
        >
          <ConversationIcon conversation={c} meId={user?.id} size="md" />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  unread || active
                    ? "font-semibold text-foreground"
                    : "text-foreground/85",
                )}
              >
                {titleOf(c)}
              </span>
              {last && (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {listTime(last.createdAt)}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-xs",
                  unread ? "text-foreground/80" : "text-muted-foreground",
                )}
              >
                {!c.joined
                  ? t("chat:openToJoin")
                  : last
                    ? `${c.type === "channel" && last.userName ? `${last.userName}: ` : ""}${last.body}`
                    : t("chat:noMessagesYet")}
              </span>
              <UnreadBadge count={c.unreadCount} />
            </span>
          </span>
        </button>
      </li>
    );
  };

  const section = (
    label: string,
    items: ChatConversation[],
    addLabel: string,
    onAdd: () => void,
    empty: string,
  ) => (
    <section>
      <div className="flex h-7 items-center justify-between ps-2 pe-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
          {items.length > 0 && (
            <span className="ms-1.5 font-normal text-muted-foreground/60">
              {items.length}
            </span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={addLabel}
          title={addLabel}
          onClick={onAdd}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      {items.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="mx-2 my-1 w-[calc(100%-1rem)] rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
        >
          {empty}
        </button>
      ) : (
        <ul className="space-y-px">{items.map(row)}</ul>
      )}
    </section>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-2.5">
        <label className="flex h-8 items-center gap-2 rounded-lg border border-input bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring/30">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            placeholder={t("chat:findConversation")}
            aria-label={t("chat:findConversation")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1.5 pb-3">
        {section(
          t("chat:channels"),
          channels,
          t("chat:newChannel"),
          onNewChannel,
          t("chat:noChannels"),
        )}
        {section(
          t("chat:directMessages"),
          dms,
          t("chat:newMessage"),
          onNewMessage,
          t("chat:noDms"),
        )}
      </div>
    </div>
  );
}
