import { Pencil, Reply, SmilePlus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { ChatConversation, ChatMessage } from "@/fetchers/chat";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { linkify, linksIn } from "@/lib/linkify";
import { messageTime, PersonAvatar } from "./chat-shared";
import { LinkedText, LinkPreviewCard } from "./link-preview-card";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉"];
export const ALL_REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "😮",
  "😢",
  "🙏",
  "🔥",
  "👀",
  "✅",
  "💯",
  "🚀",
];

type Props = {
  workspaceId?: string;
  message: ChatMessage;
  grouped: boolean;
  meId: string | undefined;
  members: ChatConversation["members"];
  canInteract: boolean;
  editing: string | null;
  highlighted: boolean;
  onEditChange: (body: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onJumpTo: (messageId: string) => void;
};

export function MessageItem({
  workspaceId,
  message,
  grouped,
  meId,
  members,
  canInteract,
  editing,
  highlighted,
  onEditChange,
  onEditSave,
  onEditCancel,
  onStartEdit,
  onDelete,
  onReply,
  onReact,
  onJumpTo,
}: Props) {
  const { t } = useTranslation();
  const mine = message.userId === meId;
  const isEditing = editing !== null;
  const nameOf = (userId: string) =>
    userId === meId
      ? t("chat:you")
      : (members.find((m) => m.id === userId)?.name ?? t("chat:formerMember"));

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "group relative flex gap-3 rounded-lg px-3 transition-colors hover:bg-accent/40",
        grouped ? "py-0.5" : "mt-3 pt-1.5 pb-0.5",
        highlighted && "bg-primary/10 hover:bg-primary/10",
        isEditing && "bg-accent/40",
      )}
    >
      <div className="w-9 shrink-0">
        {grouped ? (
          <span
            className="invisible block whitespace-nowrap pt-0.5 text-right text-[10px] leading-5 text-muted-foreground group-hover:visible"
            title={formatDateTime(message.createdAt)}
          >
            {messageTime(message.createdAt)}
          </span>
        ) : (
          <PersonAvatar
            name={message.userName}
            image={message.userImage}
            className="size-9"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold">
              {message.userName ?? t("chat:formerMember")}
            </span>
            <span
              className="shrink-0 text-[11px] text-muted-foreground"
              title={formatDateTime(message.createdAt)}
            >
              {messageTime(message.createdAt)}
            </span>
          </div>
        )}

        {message.replyTo && (
          <button
            type="button"
            onClick={() => message.replyTo && onJumpTo(message.replyTo.id)}
            className="mt-1 mb-0.5 flex max-w-full items-baseline gap-1.5 rounded-md border-s-2 border-primary/60 bg-muted/50 px-2 py-1 text-left text-xs hover:bg-muted"
          >
            <Reply className="size-3 shrink-0 self-center text-muted-foreground" />
            <span className="shrink-0 font-semibold">
              {message.replyTo.userName ?? t("chat:formerMember")}
            </span>
            <span className="truncate text-muted-foreground">
              {message.replyTo.body}
            </span>
          </button>
        )}

        {isEditing ? (
          <div className="space-y-1.5 py-1">
            <Textarea
              autoFocus
              value={editing}
              aria-label={t("chat:editMessage")}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onEditSave();
                }
                if (e.key === "Escape") onEditCancel();
              }}
            />
            <div className="flex items-center gap-1.5">
              <Button size="xs" variant="outline" onClick={onEditCancel}>
                {t("common:actions.cancel")}
              </Button>
              <Button size="xs" onClick={onEditSave}>
                {t("chat:save")}
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {t("chat:editHint")}
              </span>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/95">
            <LinkedText parts={linkify(message.body)} />
            {message.editedAt && (
              <span
                className="ms-1.5 text-[10px] text-muted-foreground"
                title={formatDateTime(message.editedAt)}
              >
                {t("chat:edited")}
              </span>
            )}
          </p>
        )}

        {!isEditing &&
          linksIn(message.body).map((url) => (
            <LinkPreviewCard key={url} workspaceId={workspaceId} url={url} />
          ))}

        {message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {message.reactions.map((r) => {
              const reacted = meId ? r.userIds.includes(meId) : false;
              return (
                <button
                  key={r.emoji}
                  type="button"
                  disabled={!canInteract}
                  aria-pressed={reacted}
                  title={r.userIds.map(nameOf).join(", ")}
                  onClick={() => onReact(r.emoji)}
                  className={cn(
                    "flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors",
                    reacted
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/20",
                  )}
                >
                  <span className="text-sm leading-none">{r.emoji}</span>
                  <span className="font-medium tabular-nums">
                    {r.userIds.length}
                  </span>
                </button>
              );
            })}
            {canInteract && (
              <ReactionPicker onPick={onReact}>
                <span className="flex h-6 items-center rounded-full border border-dashed border-border px-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground">
                  <SmilePlus className="size-3.5" />
                </span>
              </ReactionPicker>
            )}
          </div>
        )}
      </div>

      {canInteract && !isEditing && (
        <div className="absolute -top-3.5 right-3 z-10 hidden items-center gap-px rounded-lg border border-border bg-popover p-0.5 shadow-md group-focus-within:flex group-hover:flex">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={t("chat:reactWith", { emoji })}
              onClick={() => onReact(emoji)}
              className="flex size-7 items-center justify-center rounded-md text-base hover:bg-accent"
            >
              {emoji}
            </button>
          ))}
          <ReactionPicker onPick={onReact}>
            <span className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
              <SmilePlus className="size-4" />
            </span>
          </ReactionPicker>
          <span className="mx-0.5 h-4 w-px bg-border" />
          <ToolbarButton label={t("chat:reply")} onClick={onReply}>
            <Reply className="size-4" />
          </ToolbarButton>
          {mine && (
            <>
              <ToolbarButton
                label={t("chat:editMessage")}
                onClick={onStartEdit}
              >
                <Pencil className="size-3.5" />
              </ToolbarButton>
              <ToolbarButton
                label={t("chat:deleteMessage")}
                onClick={onDelete}
                destructive
              >
                <Trash2 className="size-3.5" />
              </ToolbarButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
        destructive && "hover:text-destructive-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ReactionPicker({
  onPick,
  children,
}: {
  onPick: (emoji: string) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("chat:addReaction")}
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </PopoverTrigger>
      <PopoverPopup side="top" align="end" className="w-auto p-1.5">
        <div className="grid grid-cols-6 gap-0.5">
          {ALL_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={t("chat:reactWith", { emoji })}
              onClick={() => onPick(emoji)}
              className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-accent"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
