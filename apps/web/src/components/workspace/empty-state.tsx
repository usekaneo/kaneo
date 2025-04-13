import CreateWorkspaceModal from "../shared/modals/create-workspace-modal";

import { LayoutGrid, Plus } from "lucide-react";
import { useState } from "react";

function EmptyWorkspaceState() {
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);

  return (
    <div className="flex w-full items-center justify-center h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-md w-full px-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mb-4 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto">
            <LayoutGrid className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Create your first workspace
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md mb-6">
            Get started by creating a workspace to organize your projects and
            collaborate with your team.
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                <Plus className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  New Workspace
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Create a workspace for your team
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateWorkspaceOpen(true)}
              className="w-full px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors font-medium inline-flex items-center justify-center gap-2 text-sm"
            >
              Create Workspace
            </button>
          </div>
        </div>
      </div>
      <CreateWorkspaceModal
        open={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
      />
    </div>
  );
}

export default EmptyWorkspaceState;
