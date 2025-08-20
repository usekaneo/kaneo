import useDeleteWorkspaceUser from "@/hooks/mutations/workspace-user/use-delete-workspace-user";
import { Route } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/members";
import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { Button } from "../ui/button";

function DeleteTeamMemberModal({
  userId,
  open,
  onClose,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { workspaceId } = Route.useParams();
  const { mutateAsync: deleteWorkspaceUser } = useDeleteWorkspaceUser();
  const queryClient = useQueryClient();

  const onRemoveMember = async () => {
    await deleteWorkspaceUser({
      workspaceId,
      userId,
    });

    queryClient.invalidateQueries({
      queryKey: ["workspace-users"],
    });

    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Remove Team Member
              </Dialog.Title>
              <Dialog.Close className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300">
                <X size={20} />
              </Dialog.Close>
            </div>

            <div className="p-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                Are you sure you want to remove{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {userId}
                </span>{" "}
                from the team? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button
                    type="button"
                    className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  >
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button
                  onClick={onRemoveMember}
                  className="bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove Member
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default DeleteTeamMemberModal;
