import { useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import useDeleteWorkspaceUser from "@/hooks/mutations/workspace-user/use-delete-workspace-user";
import { Route } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/members";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogPopup, DialogTitle } from "../ui/dialog";

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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogPopup className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <DialogTitle className="text-lg font-semibold text-foreground">
              Remove Team Member
            </DialogTitle>
            <DialogClose
              className="text-muted-foreground hover:text-foreground"
              render={<button type="button" />}
            >
              <X size={20} />
            </DialogClose>
          </div>

          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">{userId}</span> from
              the team? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <DialogClose
                render={
                  <Button
                    className="bg-muted text-foreground hover:bg-accent"
                    type="button"
                  />
                }
              >
                Cancel
              </DialogClose>
              <Button onClick={onRemoveMember} variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Member
              </Button>
            </div>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}

export default DeleteTeamMemberModal;
