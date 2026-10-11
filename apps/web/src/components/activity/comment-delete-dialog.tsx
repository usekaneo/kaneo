import type { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import useDeleteComment from "@/hooks/mutations/comment/use-delete-comment";
import { toast } from "@/lib/toast";

export default function CommentDeleteDialog({
  handle,
  commentId,
  taskId,
}: {
  handle: AlertDialogPrimitive.Handle<unknown>;
  commentId: string;
  taskId: string;
}) {
  const { t } = useTranslation();
  const { mutateAsync: deleteComment, isPending } = useDeleteComment(taskId);
  const handleDelete = async () => {
    try {
      await deleteComment({ activityId: commentId });
      toast.success(t("activity:comment.deleted"));
      handle.close();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("activity:comment.failedToDelete"),
      );
    }
  };

  return (
    <AlertDialog handle={handle}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("activity:comment.deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("activity:comment.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline" size="sm" disabled={isPending} />}
          >
            {t("common:actions.cancel")}
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => void handleDelete()}
          >
            {isPending
              ? t("common:actions.deleting")
              : t("common:actions.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
