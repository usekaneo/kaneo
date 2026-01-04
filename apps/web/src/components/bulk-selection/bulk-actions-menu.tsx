import {
  Archive,
  EllipsisVertical,
  Flag,
  Menu,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useBulkOperations } from "@/hooks/mutations/task/use-bulk-operations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getColumnIcon } from "@/lib/column";
import useBulkSelectionStore from "@/store/bulk-selection";
import { Button } from "../ui/button";

function BulkActionsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedTaskIds, clearSelection } = useBulkSelectionStore();
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );
  const { bulkDelete, bulkArchive, bulkChangeStatus, bulkAssign } =
    useBulkOperations();

  const selectedCount = selectedTaskIds.size;

  const handleBulkDelete = async () => {
    if (
      !confirm(`Delete ${selectedCount} tasks? This action cannot be undone.`)
    ) {
      return;
    }

    try {
      await bulkDelete(Array.from(selectedTaskIds));
      toast.success(`${selectedCount} tasks deleted`);
      clearSelection();
      setIsOpen(false);
    } catch (_error) {
      toast.error("Failed to delete tasks");
    }
  };

  const handleBulkArchive = async () => {
    try {
      await bulkArchive(Array.from(selectedTaskIds));
      toast.success(`${selectedCount} tasks archived`);
      clearSelection();
      setIsOpen(false);
    } catch (_error) {
      toast.error("Failed to archive tasks");
    }
  };

  const handleBulkChangeStatus = async (status: string) => {
    try {
      await bulkChangeStatus({ taskIds: Array.from(selectedTaskIds), status });
      toast.success(`${selectedCount} tasks updated`);
      clearSelection();
      setIsOpen(false);
    } catch (_error) {
      toast.error("Failed to update tasks");
    }
  };

  const handleBulkAssign = async (userId: string) => {
    try {
      await bulkAssign({ taskIds: Array.from(selectedTaskIds), userId });
      toast.success(`${selectedCount} tasks assigned`);
      clearSelection();
      setIsOpen(false);
    } catch (_error) {
      toast.error("Failed to assign tasks");
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setIsOpen(true)}>
        <Menu className="size-3" />
        Actions
      </Button>

      <CommandDialog
        title="Bulk Actions"
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <CommandInput placeholder="Search actions..." />
        <CommandList>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={handleBulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete tasks
            </CommandItem>
            <CommandItem onSelect={handleBulkArchive}>
              <Archive className="w-4 h-4 mr-2" />
              Archive tasks
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Change Status">
            <CommandItem onSelect={() => handleBulkChangeStatus("to-do")}>
              {getColumnIcon("to-do")}
              To Do
            </CommandItem>
            <CommandItem onSelect={() => handleBulkChangeStatus("in-progress")}>
              {getColumnIcon("in-progress")}
              In Progress
            </CommandItem>
            <CommandItem onSelect={() => handleBulkChangeStatus("in-review")}>
              {getColumnIcon("in-review")}
              In Review
            </CommandItem>
            <CommandItem onSelect={() => handleBulkChangeStatus("done")}>
              {getColumnIcon("done")}
              Done
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Assign to">
            {workspaceUsers?.members?.map((member) => (
              <CommandItem
                key={member.userId}
                onSelect={() => handleBulkAssign(member.userId)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage
                    src={member.user?.image ?? ""}
                    alt={member.user?.name || ""}
                  />
                  <AvatarFallback className="text-xs font-medium border border-border/30">
                    {member.user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {member.user?.name || "Unknown User"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export default BulkActionsMenu;
