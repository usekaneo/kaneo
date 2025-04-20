import type { ProjectWithTasks } from "@/types/project";
import { create } from "zustand";

const useProjectStore = create<{
  project: ProjectWithTasks | undefined;
  setProject: (updatedProject: ProjectWithTasks | undefined) => void;
}>((set) => ({
  project: undefined,
  setProject: (updatedProject) => set(() => ({ project: updatedProject })),
}));

export default useProjectStore;
