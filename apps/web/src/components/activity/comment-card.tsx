import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Reply, SmilePlus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { LinkPreviewCard } from "@/components/chat/link-preview-card";
import {
  QUICK_REACTIONS,
  ReactionPicker,
} from "@/components/chat/message-item";
import { GithubIcon } from "@/components/icons/github-icon";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getApiUrl } from "@/fetchers/get-api-url";
import useDeleteComment from "@/hooks/mutations/comment/use-delete-comment";
import useReactToComment from "@/hooks/mutations/comment/use-react-to-comment";
import useUpdateComment from "@/hooks/mutations/comment/use-update-comment";
import { cn } from "@/lib/cn";
import { commentExcerpt } from "@/lib/comment-excerpt";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import { linksIn } from "@/lib/linkify";
import { toast } from "@/lib/toast";
import { useCommentReplyStore } from "@/store/comment-reply";

type CommentCardProps = {
  commentId: string;
  taskId: string;
  content: string;
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  createdAt: string;
  externalSource?: string | null;
  externalUrl?: string | null;
  workspaceId?: string;
  editedAt?: string | null;
  replyTo?: {
    id: string;
    userName: string | null;
    excerpt: string;
  } | null;
  reactions?: { emoji: string; userIds: string[] }[];
  /** Whoever can comment can also react and reply. */
  canInteract?: boolean;
  nameOf?: (userId: string) => string;
};

// Attachments are stored as links to the API; they aren't worth a preview.
function previewableLinks(markdown: string) {
  const apiHost = (() => {
    try {
      return new URL(getApiUrl("")).host;
    } catch {
      return null;
    }
  })();
  return linksIn(markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, " "), 2).filter(
    (href) => new URL(href).host !== apiHost,
  );
}

/** Scrolls to a comment in the feed and flashes it. */
function jumpToComment(id: string) {
  const el = document.querySelector<HTMLElement>(
    `[data-comment-id="${CSS.escape(id)}"]`,
  );
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-primary/50");
  setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 1600);
}

export default function CommentCard({
  commentId,
  taskId,
  content,
  user,
  createdAt,
  externalSource,
  externalUrl,
  workspaceId,
  editedAt,
  replyTo,
  reactions = [],
  canInteract = false,
  nameOf,
}: CommentCardProps) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const { mutateAsync: updateComment, isPending } = useUpdateComment();
  const { mutate: deleteComment, isPending: isDeleting } =
    useDeleteComment(taskId);
  const { mutate: react } = useReactToComment(taskId);
  const startReply = useCommentReplyStore((s) => s.reply);
  const queryClient = useQueryClient();
  const links = useMemo(() => previewableLinks(content), [content]);

  const toggleReaction = (emoji: string) =>
    react(
      { activityId: commentId, emoji },
      {
        onError: (error) =>
          toast.error(error.message || t("activity:comment.failedToReact")),
      },
    );
  const reply = () =>
    startReply({
      taskId,
      id: commentId,
      userName: user?.name ?? null,
      excerpt: commentExcerpt(content),
    });

  const canEdit = currentUser?.id === user?.id;
  const isFromGitHub = externalSource === "github";
  const githubProfileUrl =
    isFromGitHub && user?.name ? `https://github.com/${user.name}` : null;
  const commentUrl = externalUrl || null;
  const fullTimestamp = formatDateTime(createdAt);

  const handleEdit = useCallback(() => {
    setEditedContent(content);
    setIsEditing(true);
  }, [content]);

  const handleCancel = useCallback(() => {
    setEditedContent(content);
    setIsEditing(false);
  }, [content]);

  const handleSave = useCallback(async () => {
    if (!editedContent.trim()) {
      toast.error(t("activity:comment.cannotBeEmpty"));
      return;
    }

    if (!currentUser?.id) {
      toast.error(t("activity:comment.mustBeLoggedInToEdit"));
      return;
    }

    try {
      await updateComment({
        activityId: commentId,
        comment: editedContent,
      });

      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["activities", taskId] });
      toast.success(t("activity:comment.updated"));
    } catch (error) {
      console.error("Failed to update comment:", error);
      toast.error(t("activity:comment.failedToUpdate"));
    }
  }, [
    commentId,
    currentUser?.id,
    editedContent,
    queryClient,
    t,
    taskId,
    updateComment,
  ]);

  return (
    <TooltipProvider>
      <div
        data-comment-id={commentId}
        className="group relative w-full rounded-xl border border-border/80 bg-card/60 transition-shadow"
      >
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <HoverCard>
            <HoverCardTrigger>
              <div className="flex cursor-pointer items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
                  <AvatarFallback className="bg-muted text-xs font-medium">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground/92 hover:text-foreground transition-colors">
                  {user?.name}
                </span>
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-64 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
                  <AvatarFallback className="bg-muted text-xs font-medium">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground leading-none">
                    {user?.name}
                  </p>
                  {user?.email && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  )}
                  {isFromGitHub && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <GithubIcon className="size-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {t("activity:comment.github")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {githubProfileUrl && (
                <a
                  href={githubProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink className="size-3" />
                  {t("activity:comment.viewGithubProfile")}
                </a>
              )}
            </HoverCardContent>
          </HoverCard>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="cursor-default text-xs text-muted-foreground/62 outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={fullTimestamp}
                title={fullTimestamp}
              >
                <time dateTime={createdAt}>
                  {formatRelativeTime(createdAt)}
                </time>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{fullTimestamp}</p>
            </TooltipContent>
          </Tooltip>

          {editedAt && (
            <span
              className="text-[11px] text-muted-foreground/62"
              title={formatDateTime(editedAt)}
            >
              {t("activity:comment.edited")}
            </span>
          )}

          {commentUrl && (
            <>
              <span className="text-xs text-muted-foreground/40">·</span>
              <a
                href={commentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <GithubIcon className="size-3" />
                {t("activity:comment.commentedOnGithub")}
              </a>
            </>
          )}
        </div>

        {(canEdit || canInteract) && !isEditing && (
          <div className="absolute top-1.5 right-2 flex items-center gap-0.5 rounded-lg border border-transparent opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:border-border group-hover:bg-popover group-hover:opacity-100 group-hover:shadow-sm">
            {canInteract && (
              <>
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={t("activity:comment.reactWith", { emoji })}
                    onClick={() => toggleReaction(emoji)}
                    className="flex size-6 items-center justify-center rounded-md text-sm hover:bg-accent"
                  >
                    {emoji}
                  </button>
                ))}
                <ReactionPicker onPick={toggleReaction}>
                  <span className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                    <SmilePlus className="size-3.5" />
                  </span>
                </ReactionPicker>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={reply}
                      aria-label={t("activity:comment.reply")}
                      className="h-6 w-6 rounded-md p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Reply className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{t("activity:comment.reply")}</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
            {canEdit && canInteract && (
              <span className="mx-0.5 h-4 w-px bg-border" />
            )}
            {canEdit && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEdit}
                      className="h-6 w-6 rounded-md p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{t("activity:comment.edit")}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteComment({ activityId: commentId })}
                      disabled={isDeleting}
                      className="h-6 w-6 rounded-md p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{t("common:actions.delete")}</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}

        {replyTo && (
          <button
            type="button"
            onClick={() => jumpToComment(replyTo.id)}
            className="mx-3 mt-2 flex max-w-[calc(100%-1.5rem)] items-baseline gap-1.5 rounded-md border-primary/60 border-s-2 bg-muted/50 px-2 py-1 text-left text-xs hover:bg-muted"
          >
            <Reply className="size-3 shrink-0 self-center text-muted-foreground" />
            <span className="shrink-0 font-semibold">
              {replyTo.userName ?? t("common:people.someone")}
            </span>
            <span className="truncate text-muted-foreground">
              {replyTo.excerpt}
            </span>
          </button>
        )}

        <div className="pt-0.5">
          <CommentEditor
            value={isEditing ? editedContent : content}
            onChange={isEditing ? setEditedContent : undefined}
            placeholder={t("activity:comment.editPlaceholder")}
            taskId={taskId}
            uploadSurface="comment"
            className={
              isEditing
                ? "[&_.kaneo-comment-editor-content_.ProseMirror]:min-h-[3rem] [&_.kaneo-comment-editor-content_.ProseMirror]:max-h-none [&_.kaneo-comment-editor-content_.ProseMirror]:overflow-visible [&_.kaneo-comment-editor-content_.ProseMirror]:px-3 [&_.kaneo-comment-editor-content_.ProseMirror]:pt-2.5 [&_.kaneo-comment-editor-content_.ProseMirror]:pb-2"
                : "kaneo-comment-viewer [&_.kaneo-comment-editor-content_.ProseMirror]:px-3 [&_.kaneo-comment-editor-content_.ProseMirror]:pt-2 [&_.kaneo-comment-editor-content_.ProseMirror]:pb-3"
            }
            autoFocus={isEditing}
            readOnly={!isEditing}
            onSubmitShortcut={isEditing ? handleSave : undefined}
            onCancelShortcut={isEditing ? handleCancel : undefined}
          />
        </div>

        {!isEditing && links.length > 0 && (
          <div className="-mt-1 space-y-1.5 px-3 pb-3">
            {links.map((href) => (
              <LinkPreviewCard
                key={href}
                workspaceId={workspaceId}
                url={href}
              />
            ))}
          </div>
        )}

        {!isEditing && reactions.length > 0 && (
          <div className="-mt-1 flex flex-wrap items-center gap-1 px-3 pb-2.5">
            {reactions.map((r) => {
              const reacted = currentUser?.id
                ? r.userIds.includes(currentUser.id)
                : false;
              return (
                <button
                  key={r.emoji}
                  type="button"
                  disabled={!canInteract}
                  aria-pressed={reacted}
                  title={r.userIds
                    .map((id) =>
                      id === currentUser?.id
                        ? t("activity:comment.you")
                        : (nameOf?.(id) ?? ""),
                    )
                    .filter(Boolean)
                    .join(", ")}
                  onClick={() => toggleReaction(r.emoji)}
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
              <ReactionPicker onPick={toggleReaction}>
                <span className="flex h-6 items-center rounded-full border border-border border-dashed px-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100">
                  <SmilePlus className="size-3.5" />
                </span>
              </ReactionPicker>
            )}
          </div>
        )}

        {isEditing && (
          <div className="flex items-center justify-end gap-2 border-border/70 border-t bg-card/60 px-3 py-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
              className="h-7 px-2.5 text-xs"
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isPending || !editedContent.trim()}
              className="h-7 px-2.5 text-xs"
            >
              {t("activity:comment.save")}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
