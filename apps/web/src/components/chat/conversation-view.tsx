import {
  ArrowDown,
  Check,
  CheckCheck,
  EllipsisIcon,
  LogOut,
  Reply,
  SendHorizontal,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import {
  type ChatConversation,
  type ChatMessage,
  chatApi,
} from "@/fetchers/chat";
import { useChatActions, useChatMessages } from "@/hooks/chat";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatDate, formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useChatTypingStore } from "@/store/chat-typing";
import {
  ConversationIcon,
  conversationTitle,
  PersonAvatar,
} from "./chat-shared";
import { MessageItem } from "./message-item";

type Props = {
  workspaceId: string;
  conversation: ChatConversation;
  onAddPeople: () => void;
  onClosed: () => void;
  /** Extra controls at the start of the header, e.g. a back arrow. */
  leading?: ReactNode;
  trailing?: ReactNode;
  compact?: boolean;
};

// Messages from the same person this close together share one header.
const GROUP_WINDOW_MS = 5 * 60 * 1000;
// How often a "typing" ping is sent while someone keeps typing.
const TYPING_PING_MS = 3000;
const NO_TYPISTS = {};

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export function ConversationView({
  workspaceId,
  conversation,
  onAddPeople,
  onClosed,
  leading,
  trailing,
  compact,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const meId = user?.id;
  const { canManageWorkspace } = useWorkspacePermission();
  const actions = useChatActions(workspaceId);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useChatMessages(workspaceId, conversation.id);
  const typists = useChatTypingStore(
    (s) => s.typing[conversation.id] ?? NO_TYPISTS,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const restoreFrom = useRef<number | null>(null);
  const lastTypingPing = useRef(0);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(
    null,
  );
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [awayFromBottom, setAwayFromBottom] = useState(false);

  const messages = useMemo(
    () => [...(data?.pages ?? [])].reverse().flatMap((p) => p.messages),
    [data],
  );
  const lastId = messages.at(-1)?.id;
  const title = conversationTitle(conversation, meId, t("chat:you"));
  const isChannel = conversation.type === "channel";
  const others = conversation.members.filter((m) => m.id !== meId);
  const canDelete =
    isChannel &&
    (conversation.createdBy === meId || Boolean(canManageWorkspace()));
  const typingNames = Object.entries(typists)
    .filter(([id]) => id !== meId)
    .map(([, typist]) => typist.name);

  // "Seen" sits under your latest message once the others have read past it.
  const lastMine = [...messages].reverse().find((m) => m.userId === meId);
  const seenBy = lastMine
    ? others.filter(
        (m) => new Date(m.lastReadAt) >= new Date(lastMine.createdAt),
      )
    : [];

  const subtitle = isChannel
    ? `${conversation.isPrivate ? t("chat:privateChannel") : t("chat:publicChannel")} · ${t("chat:memberCount", { count: conversation.members.length })}`
    : others.length > 1
      ? t("chat:groupMessage", { count: conversation.members.length })
      : t("chat:directMessage");

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset per conversation
  useEffect(() => {
    stickToBottom.current = true;
    setDraft("");
    setEditing(null);
    setReplyTo(null);
  }, [conversation.id]);

  // Keep the view pinned to the newest message, or hold the reading position
  // steady when older messages are prepended above it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the list changes
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreFrom.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, typingNames.length]);

  // Link previews and images grow messages after they render; stay pinned
  // to the bottom through that instead of leaving the newest out of view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-observe when the list changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current && restoreFrom.current === null) {
        el.scrollTop = el.scrollHeight;
      }
    });
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [messages.length]);

  const markRead = actions.markRead.mutate;
  useEffect(() => {
    if (conversation.joined && lastId) markRead(conversation.id);
  }, [conversation.id, conversation.joined, lastId, markRead]);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const jumpTo = (messageId: string) => {
    const el = scrollRef.current?.querySelector(
      `[data-message-id="${CSS.escape(messageId)}"]`,
    );
    if (!el) {
      toast.info(t("chat:olderMessage"));
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(messageId);
    setTimeout(() => setHighlighted(null), 1600);
  };

  const loadOlder = () => {
    const el = scrollRef.current;
    if (el) restoreFrom.current = el.scrollHeight - el.scrollTop;
    void fetchNextPage();
  };

  const startReply = (message: ChatMessage) => {
    setReplyTo(message);
    inputRef.current?.focus();
  };

  const pingTyping = () => {
    const now = Date.now();
    if (now - lastTypingPing.current < TYPING_PING_MS) return;
    lastTypingPing.current = now;
    void chatApi.typing(workspaceId, conversation.id).catch(() => {});
  };

  const send = () => {
    const body = draft.trim();
    if (!body || actions.send.isPending) return;
    stickToBottom.current = true;
    lastTypingPing.current = 0;
    actions.send.mutate(
      { id: conversation.id, body, replyToId: replyTo?.id },
      {
        onSuccess: () => {
          setDraft("");
          setReplyTo(null);
        },
        onError: (error) => toast.error(error.message || t("chat:error")),
      },
    );
  };

  const saveEdit = () => {
    if (!editing) return;
    const body = editing.body.trim();
    if (!body) return;
    actions.edit.mutate(
      { messageId: editing.id, body },
      {
        onSuccess: () => {
          setEditing(null);
          inputRef.current?.focus();
        },
        onError: (error) => toast.error(error.message || t("chat:error")),
      },
    );
  };

  const run = (fn: () => Promise<unknown>, after?: () => void) =>
    fn()
      .then(after)
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : t("chat:error")),
      );

  const header = (
    <header
      className={cn(
        "flex shrink-0 items-center gap-2.5 border-b border-border bg-background/80 backdrop-blur",
        compact ? "h-12 px-2" : "h-14 px-4",
      )}
    >
      {leading}
      <ConversationIcon
        conversation={conversation}
        meId={meId}
        size={compact ? "sm" : "md"}
      />
      <div className="min-w-0 flex-1 leading-tight">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {isChannel && !compact && (
        <div className="flex -space-x-1.5">
          {conversation.members.slice(0, 4).map((m) => (
            <PersonAvatar
              key={m.id}
              name={m.name}
              image={m.image}
              className="size-6 ring-2 ring-background"
            />
          ))}
        </div>
      )}
      {isChannel && conversation.joined && (
        <Menu>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("chat:options")}
              />
            }
          >
            <EllipsisIcon className="size-4" />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={onAddPeople}>
              <UserPlus className="size-4" />
              {t("chat:addPeople")}
            </MenuItem>
            <MenuItem
              onClick={() =>
                run(() => actions.leave.mutateAsync(conversation.id), onClosed)
              }
            >
              <LogOut className="size-4" />
              {t("chat:leave")}
            </MenuItem>
            {canDelete && (
              <MenuItem
                variant="destructive"
                onClick={() => {
                  if (!window.confirm(t("chat:deleteConfirm", { name: title })))
                    return;
                  run(
                    () => actions.deleteChannel.mutateAsync(conversation.id),
                    onClosed,
                  );
                }}
              >
                <Trash2 className="size-4" />
                {t("chat:deleteChannel")}
              </MenuItem>
            )}
          </MenuPopup>
        </Menu>
      )}
      {trailing}
    </header>
  );

  const dayLabel = (date: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (sameDay(date, today)) return t("chat:today");
    if (sameDay(date, yesterday)) return t("chat:yesterday");
    return date.getFullYear() === today.getFullYear()
      ? formatDate(date, { weekday: "long", month: "long", day: "numeric" })
      : formatDateMedium(date);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className={cn("h-full overflow-y-auto", compact ? "py-2" : "py-4")}
          onScroll={(e) => {
            const el = e.currentTarget;
            const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
            stickToBottom.current = distance < 80;
            setAwayFromBottom(distance > 300);
          }}
        >
          {hasNextPage && (
            <div className="flex justify-center pb-2">
              <Button
                variant="outline"
                size="xs"
                disabled={isFetchingNextPage}
                onClick={loadOlder}
              >
                {t("chat:loadEarlier")}
              </Button>
            </div>
          )}

          {!isLoading && !hasNextPage && (
            <div
              className={cn(
                "flex flex-col gap-2",
                compact ? "px-3 pb-2" : "px-5 pb-4",
                messages.length === 0 && "h-full justify-end",
              )}
            >
              <ConversationIcon
                conversation={conversation}
                meId={meId}
                size="lg"
              />
              <div>
                <p className="text-base font-semibold">
                  {isChannel
                    ? t("chat:channelStart", { name: title })
                    : t("chat:dmStart", { name: title })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isChannel ? t("chat:channelIntro") : t("chat:dmIntro")}
                </p>
              </div>
            </div>
          )}

          <div className={compact ? "px-1" : "px-2"}>
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const created = new Date(message.createdAt);
              const newDay =
                !previous || !sameDay(new Date(previous.createdAt), created);
              const grouped =
                !newDay &&
                !message.replyTo &&
                previous?.userId === message.userId &&
                created.getTime() - new Date(previous.createdAt).getTime() <
                  GROUP_WINDOW_MS;
              return (
                <div key={message.id}>
                  {newDay && (
                    <div className="relative my-4 flex items-center justify-center">
                      <span className="absolute inset-x-3 h-px bg-border" />
                      <span className="relative rounded-full border border-border bg-background px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {dayLabel(created)}
                      </span>
                    </div>
                  )}
                  <MessageItem
                    workspaceId={workspaceId}
                    message={message}
                    grouped={grouped}
                    meId={meId}
                    members={conversation.members}
                    canInteract={conversation.joined}
                    highlighted={highlighted === message.id}
                    editing={editing?.id === message.id ? editing.body : null}
                    onEditChange={(body) =>
                      setEditing({ id: message.id, body })
                    }
                    onEditSave={saveEdit}
                    onEditCancel={() => setEditing(null)}
                    onStartEdit={() =>
                      setEditing({ id: message.id, body: message.body })
                    }
                    onDelete={() => {
                      if (window.confirm(t("chat:deleteMessageConfirm"))) {
                        run(() => actions.remove.mutateAsync(message));
                      }
                    }}
                    onReply={() => startReply(message)}
                    onReact={(emoji) =>
                      run(() =>
                        actions.react.mutateAsync({
                          messageId: message.id,
                          emoji,
                        }),
                      )
                    }
                    onJumpTo={jumpTo}
                  />
                  {message.id === lastMine?.id && (
                    <div className="flex items-center justify-end gap-1 px-3 pt-0.5 text-[11px] text-muted-foreground">
                      {seenBy.length > 0 ? (
                        <>
                          <CheckCheck className="size-3.5 text-primary" />
                          {others.length > 1 ? (
                            <span
                              title={seenBy.map((m) => m.name).join(", ")}
                              className="flex items-center gap-1"
                            >
                              {t("chat:seenBy", { count: seenBy.length })}
                              <span className="flex -space-x-1">
                                {seenBy.slice(0, 3).map((m) => (
                                  <PersonAvatar
                                    key={m.id}
                                    name={m.name}
                                    image={m.image}
                                    className="size-4 ring-1 ring-background"
                                  />
                                ))}
                              </span>
                            </span>
                          ) : (
                            t("chat:seen")
                          )}
                        </>
                      ) : (
                        <>
                          <Check className="size-3.5" />
                          {t("chat:sent")}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {awayFromBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-popover px-3 py-1.5 text-xs font-medium shadow-lg hover:bg-accent"
          >
            <ArrowDown className="size-3.5" />
            {t("chat:jumpToLatest")}
          </button>
        )}
      </div>

      <div className={cn("shrink-0", compact ? "px-2 pb-2" : "px-4 pb-4")}>
        <div
          aria-live="polite"
          className="flex h-5 items-center gap-1.5 px-1 text-[11px] text-muted-foreground"
        >
          {typingNames.length > 0 && (
            <>
              <span className="flex gap-0.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1 animate-bounce rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
              {typingNames.length === 1
                ? t("chat:typingOne", { name: typingNames[0] })
                : t("chat:typingMany", { count: typingNames.length })}
            </>
          )}
        </div>
        {conversation.joined ? (
          <div className="rounded-xl border border-input bg-card shadow-xs transition-shadow focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/20">
            {replyTo && (
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Reply className="size-3.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 border-s-2 border-primary/60 ps-2 text-xs">
                  <p className="font-semibold">
                    {t("chat:replyingTo", {
                      name: replyTo.userName ?? t("chat:formerMember"),
                    })}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {replyTo.body}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("chat:cancelReply")}
                  onClick={() => setReplyTo(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2 p-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={4000}
                aria-label={t("chat:messagePlaceholder", { name: title })}
                placeholder={t("chat:messagePlaceholder", { name: title })}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (e.target.value.trim()) pingTyping();
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  } else if (e.key === "Escape" && replyTo) {
                    setReplyTo(null);
                  } else if (e.key === "ArrowUp" && !draft && lastMine) {
                    // Slack-style: edit your last message.
                    e.preventDefault();
                    setEditing({ id: lastMine.id, body: lastMine.body });
                  }
                }}
                className="field-sizing-content max-h-48 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button
                size="icon"
                className="rounded-lg"
                aria-label={t("chat:send")}
                disabled={!draft.trim() || actions.send.isPending}
                onClick={send}
              >
                <SendHorizontal className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {t("chat:notJoined", { name: title })}
            </p>
            <Button
              size="sm"
              disabled={actions.join.isPending}
              onClick={() =>
                run(() => actions.join.mutateAsync(conversation.id))
              }
            >
              {t("chat:join")}
            </Button>
          </div>
        )}
        {!compact && conversation.joined && (
          <p className="px-1 pt-1.5 text-[10px] text-muted-foreground">
            {t("chat:composerHint")}
          </p>
        )}
      </div>
    </div>
  );
}
