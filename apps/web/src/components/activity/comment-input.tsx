import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Paperclip, Reply, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useCreateComment from "@/hooks/mutations/comment/use-create-comment";
import { getModifierKeyText } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { useCommentReplyStore } from "@/store/comment-reply";

type CommentInputProps = {
  taskId: string;
};

export default function CommentInput({ taskId }: CommentInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [attachAction, setAttachAction] = useState<(() => void) | null>(null);
  const { mutateAsync: createComment, isPending } = useCreateComment();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const storedReply = useCommentReplyStore((s) => s.replyTo);
  const requested = useCommentReplyStore((s) => s.requested);
  const clearReply = useCommentReplyStore((s) => s.clear);
  // A reply started on another task's comment doesn't belong here.
  const replyTo = storedReply?.taskId === taskId ? storedReply : null;

  // Bring the box into view when someone clicks Reply on a comment below.
  useEffect(() => {
    if (requested === 0) return;
    const box = containerRef.current;
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
    box?.querySelector<HTMLElement>(".ProseMirror")?.focus();
  }, [requested]);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      toast.error(t("activity:comment.cannotBeEmpty"));
      return;
    }

    try {
      await createComment({
        taskId,
        comment: content,
        replyToId: replyTo?.id,
      });

      setContent("");
      if (replyTo) clearReply();
      await queryClient.invalidateQueries({ queryKey: ["activities", taskId] });

      toast.success(t("activity:comment.added"));
    } catch (error) {
      console.error("Failed to create comment:", error);
      toast.error(t("activity:comment.failedToAdd"));
    }
  }, [clearReply, content, createComment, queryClient, replyTo, t, taskId]);

  const handleAttachActionChange = useCallback(
    (nextAttachAction: (() => void) | null) => {
      setAttachAction(() => nextAttachAction);
    },
    [],
  );

  return (
    <div ref={containerRef} className="w-full">
      <div className="rounded-xl border border-border/80 bg-card/70 transition-colors focus-within:border-ring/60 focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--ring)_20%,transparent)]">
        {replyTo && (
          <div className="flex items-center gap-2 border-border/70 border-b px-3 py-2">
            <Reply className="size-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 border-primary/60 border-s-2 ps-2 text-xs">
              <p className="font-semibold">
                {t("activity:comment.replyingTo", {
                  name: replyTo.userName ?? t("common:people.someone"),
                })}
              </p>
              <p className="truncate text-muted-foreground">
                {replyTo.excerpt}
              </p>
            </div>
            <Button
              size="xs"
              variant="ghost"
              onClick={clearReply}
              aria-label={t("activity:comment.cancelReply")}
              className="text-muted-foreground"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}
        <CommentEditor
          value={content}
          onChange={setContent}
          placeholder={t("activity:comment.leavePlaceholder")}
          taskId={taskId}
          uploadSurface="comment"
          showQuickAttachButton={false}
          onAttachActionChange={handleAttachActionChange}
          className="[&_.kaneo-comment-editor-content_.ProseMirror]:min-h-[3rem] [&_.kaneo-comment-editor-content_.ProseMirror]:max-h-none [&_.kaneo-comment-editor-content_.ProseMirror]:overflow-visible [&_.kaneo-comment-editor-content_.ProseMirror]:px-3 [&_.kaneo-comment-editor-content_.ProseMirror]:pt-3 [&_.kaneo-comment-editor-content_.ProseMirror]:pb-2"
          onSubmitShortcut={handleSubmit}
        />
        <div className="flex items-center justify-end gap-2 border-border/70 border-t px-2 py-2">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => attachAction?.()}
            disabled={!attachAction}
            className="text-muted-foreground"
            aria-label={t("activity:comment.attachFile")}
          >
            <Paperclip className="size-3.5" />
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="xs"
                  variant="default"
                  onClick={handleSubmit}
                  disabled={isPending || !content.trim()}
                  className={cn(
                    isPending ||
                      (!content.trim() && "opacity-50 cursor-not-allowed"),
                    content.trim().length > 0 &&
                      "bg-primary text-primary-foreground",
                  )}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <KbdSequence
                  keys={[getModifierKeyText(), "Enter"]}
                  description={t("activity:comment.submitShortcut")}
                />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
