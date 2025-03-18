import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import useCreateActivity from "@/hooks/mutations/activity/use-create-activity";
import { Route } from "@/routes/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const commentSchema = z.object({
  comment: z.string().min(1),
});

function TaskComment() {
  const { taskId } = Route.useParams();
  const { user } = useAuth();
  const { mutateAsync: createComment } = useCreateActivity();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      comment: "",
    },
    shouldUnregister: true,
  });

  async function onSubmit(data: z.infer<typeof commentSchema>) {
    if (!user?.email) {
      return;
    }

    try {
      await createComment({
        taskId: taskId,
        content: data.comment,
        userEmail: user?.email,
      });

      await queryClient.invalidateQueries({
        queryKey: ["activities", taskId],
      });

      toast.success("Comment added successfully");
      form.reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add comment",
      );
    }
  }

  useEffect(() => {
    return () => {
      form.reset();
    };
  }, [form]);

  return (
    <div className="flex items-start gap-3">
      <Avatar className="w-8 h-8">
        <AvatarFallback>{user?.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="Add a comment..."
                      {...field}
                      className="w-full rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 shadow-sm px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 min-h-[100px]"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end mt-2">
              <Button
                type="submit"
                className="bg-indigo-600/10 text-indigo-600 hover:bg-indigo-600/20 dark:bg-indigo-400/10 dark:text-indigo-400 dark:hover:bg-indigo-400/20"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Comment
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default TaskComment;
