import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Github, Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import CommentEditor from "@/components/activity/comment-editor";
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
import useUpdateComment from "@/hooks/mutations/comment/use-update-comment";
import { toast } from "@/lib/toast";

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
};

export default function CommentCard({
  commentId,
  taskId,
  content,
  user,
  createdAt,
  externalSource,
  externalUrl,
}: CommentCardProps) {
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const { mutateAsync: updateComment, isPending } = useUpdateComment();
  const queryClient = useQueryClient();

  const canEdit = currentUser?.id === user?.id;
  const isFromGitHub = externalSource === "github";
  const githubProfileUrl =
    isFromGitHub && user?.name ? `https://github.com/${user.name}` : null;
  const commentUrl = externalUrl || null;

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
      toast.error("Comment cannot be empty");
      return;
    }

    if (!currentUser?.id) {
      toast.error("You must be logged in to edit comments");
      return;
    }

    try {
      await updateComment({
        activityId: commentId,
        comment: editedContent,
      });

      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["activities", taskId] });
      toast.success("Comment updated");
    } catch (error) {
      console.error("Failed to update comment:", error);
      toast.error("Failed to update comment");
    }
  }, [
    commentId,
    currentUser?.id,
    editedContent,
    queryClient,
    taskId,
    updateComment,
  ]);

  return (
    <div className="group relative w-full rounded-xl border border-border/80 bg-card/60">
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <HoverCard>
          <HoverCardTrigger>
            <div className="flex cursor-pointer items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
                <AvatarFallback className="bg-muted text-xs font-medium">
                  {user?.name?.charAt(0).toUpperCase()}
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
                  {user?.name?.charAt(0).toUpperCase()}
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
                    <Github className="size-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      GitHub
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
                View GitHub Profile
              </a>
            )}
          </HoverCardContent>
        </HoverCard>

        <span className="text-xs text-muted-foreground/62">
          {formatDistanceToNow(createdAt, { addSuffix: true })}
        </span>

        {commentUrl && (
          <>
            <span className="text-xs text-muted-foreground/40">·</span>
            <a
              href={commentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Github className="size-3" />
              commented on GitHub
            </a>
          </>
        )}
      </div>

      {canEdit && !isEditing && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="absolute top-2 right-2 h-6 w-6 rounded-md p-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Edit comment</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <div className="pt-0.5">
        <CommentEditor
          value={isEditing ? editedContent : content}
          onChange={isEditing ? setEditedContent : undefined}
          placeholder="Edit comment..."
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

      {isEditing && (
        <div className="flex items-center justify-end gap-2 border-border/70 border-t bg-card/60 px-3 py-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={isPending}
            className="h-7 px-2.5 text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={isPending || !editedContent.trim()}
            className="h-7 px-2.5 text-xs"
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
