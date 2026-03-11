import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { useCallback, useState } from "react";
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

type CommentInputProps = {
  taskId: string;
};

export default function CommentInput({ taskId }: CommentInputProps) {
  const [content, setContent] = useState("");
  const { mutateAsync: createComment, isPending } = useCreateComment();
  const queryClient = useQueryClient();

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    try {
      await createComment({
        taskId,
        comment: content,
      });

      setContent("");
      await queryClient.invalidateQueries({ queryKey: ["activities", taskId] });

      toast.success("Comment added");
    } catch (error) {
      console.error("Failed to create comment:", error);
      toast.error("Failed to add comment");
    }
  }, [content, createComment, taskId, queryClient]);

  return (
    <div className="w-full">
      <div className="rounded-xl border border-border/80 bg-card/70 transition-colors focus-within:border-ring/60 focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--ring)_20%,transparent)]">
        <CommentEditor
          value={content}
          onChange={setContent}
          placeholder="Leave a comment..."
          taskId={taskId}
          uploadSurface="comment"
          className="[&_.kaneo-comment-editor-content_.ProseMirror]:min-h-[3rem] [&_.kaneo-comment-editor-content_.ProseMirror]:max-h-none [&_.kaneo-comment-editor-content_.ProseMirror]:overflow-visible [&_.kaneo-comment-editor-content_.ProseMirror]:px-3 [&_.kaneo-comment-editor-content_.ProseMirror]:pt-3 [&_.kaneo-comment-editor-content_.ProseMirror]:pb-2"
          onSubmitShortcut={handleSubmit}
        />
        <div className="flex items-center justify-end border-border/70 border-t px-2 py-2">
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
                  description="Submit comment"
                />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
