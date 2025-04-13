import { Plus } from "lucide-react";
import { useState } from "react";
import CreateWorkspaceModal from "../../../../../shared/modals/create-workspace-modal";

function AddWorkspace() {
  const [isAddWorkspaceModalOpen, setIsAddWorkspaceModalOpen] =
    useState<boolean>(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsAddWorkspaceModalOpen(true)}
        className="w-full text-left px-2 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 rounded-md flex items-center transition-all group"
      >
        <div className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 mr-2">
          <Plus className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
        </div>
        <span className="text-sm font-medium group-hover:text-zinc-900 dark:group-hover:text-zinc-300">
          Add Workspace
        </span>
      </button>
      <CreateWorkspaceModal
        open={isAddWorkspaceModalOpen}
        onClose={() => setIsAddWorkspaceModalOpen(false)}
      />
    </>
  );
}

export default AddWorkspace;
