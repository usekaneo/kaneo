import { Editor } from "@/components/common/editor";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import useCreateComment from "@/hooks/mutations/comment/use-create-comment";
import useUpdateComment from "@/hooks/mutations/comment/use-update-comment";
import { Route } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId_";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

const commentSchema = z.object({
  comment: z.string().min(1),
});

function TaskComment({
  initialComment = "",
  commentId = null,
  onSubmit,
}: {
  initialComment?: string;
  commentId?: string | null;
  onSubmit?: () => void;
}) {
  const { taskId } = Route.useParams();
  const { user } = useAuth();
  const { mutateAsync: createComment } = useCreateComment();
  const { mutateAsync: updateComment } = useUpdateComment();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof commentSchema>>({
    resolver: standardSchemaResolver(commentSchema),
    defaultValues: {
      comment: "",
    },
    shouldUnregister: true,
  });

  async function handleSubmit(data: z.infer<typeof commentSchema>) {
    if (!user?.id) {
      toast.error("You must be logged in to add or update a comment.");
      return;
    }

    try {
      if (commentId) {
        await updateComment({
          id: commentId,
          userId: user.id,
          content: data.comment,
        });
        toast.success("Comment updated successfully.");
        onSubmit?.();
      } else {
        await createComment({
          taskId: taskId,
          content: data.comment,
          userId: user?.id,
        });
        toast.success("Comment added successfully.");
        onSubmit?.();
      }

      await queryClient.invalidateQueries({
        queryKey: ["activities", taskId],
      });

      form.reset();
    } catch (error) {
      // Log error for debugging
      console.error("TaskComment error:", error);
      let message = "Unable to submit your comment. Please try again or contact support.";
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === "string") {
        message = error;
      }
      toast.error(message);
    }
  }

  useEffect(() => {
    return () => {
      form.reset();
    };
  }, [form]);

  useEffect(() => {
    form.setValue("comment", initialComment);
  }, [initialComment, form]);

  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-col gap-4">
                    <FormControl>
                      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm overflow-hidden min-h-[100px]">
                        <Editor
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Add a comment..."
                        />
                      </div>
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />
            <div className="flex justify-end mt-2">
              <Button
                type="submit"
                className="bg-indigo-600/10 text-indigo-600 hover:bg-indigo-600/20 dark:bg-indigo-400/10 dark:text-indigo-400 dark:hover:bg-indigo-400/20"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {commentId ? "Update" : "Comment"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default TaskComment;
