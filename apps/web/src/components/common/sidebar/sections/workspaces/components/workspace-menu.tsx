import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import useDeleteWorkspace from '@/hooks/mutations/workspace/use-delete-workspace';
import { cn } from '@/lib/cn';
import useProjectStore from '@/store/project';
import useWorkspaceStore from '@/store/workspace';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import CreateProjectModal from '../../projects/create-project-modal';

type WorkspaceMenuProps = {
  readonly id: string;
};

const WorkspaceMenu = ({ id }: WorkspaceMenuProps) => {
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);
  const { setWorkspace } = useWorkspaceStore();
  const { setProject } = useProjectStore();
  const queryClient = useQueryClient();
  const { mutateAsync: deleteWorkspace } = useDeleteWorkspace({
    id,
  });

  async function handleDeleteWorkspace() {
    await deleteWorkspace();
    setWorkspace(undefined);
    setProject(undefined);
    queryClient.removeQueries({
      queryKey: ['workspaces'],
    });
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Edit workspace"
            className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700/50 transition-colors ml-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[180px] bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1"
            align="end"
            sideOffset={5}
          >
            <DropdownMenu.Item
              className={cn(
                'flex items-center px-2 py-1.5 mx-1 text-sm rounded-md cursor-pointer outline-hidden',
                'text-zinc-600 dark:text-zinc-300',
                'hover:bg-zinc-100 dark:hover:bg-zinc-700',
                'focus:bg-zinc-100 dark:focus:bg-zinc-700',
              )}
              onClick={() => setIsCreateProjectModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
            <DropdownMenu.Item
              className={cn(
                'flex items-center px-2 py-1.5 mx-1 text-sm rounded-md cursor-pointer outline-hidden',
                'text-zinc-600 dark:text-zinc-300',
                'hover:bg-zinc-100 dark:hover:bg-zinc-700',
                'focus:bg-zinc-100 dark:focus:bg-zinc-700',
              )}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit Workspace
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={cn(
                'flex items-center px-2 py-1.5 mx-1 text-sm rounded-md cursor-pointer outline-hidden',
                'text-red-600 dark:text-red-400',
                'hover:bg-red-50 dark:hover:bg-red-500/10',
                'focus:bg-red-50 dark:focus:bg-red-500/10',
              )}
              onClick={() => handleDeleteWorkspace()}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Workspace
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />
    </>
  );
};

export default WorkspaceMenu;
