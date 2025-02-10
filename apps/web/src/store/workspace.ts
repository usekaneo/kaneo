import type { Workspace } from '@/types/workspace';
import { create } from 'zustand';

const useWorkspaceStore = create<{
  workspace: Workspace | undefined;
  setWorkspace: (updatedWorkspace: Workspace | undefined) => void;
}>((set) => ({
  workspace: undefined,
  setWorkspace: (updatedWorkspace) => {
    set(() => ({ workspace: updatedWorkspace }));
  },
}));

export default useWorkspaceStore;
