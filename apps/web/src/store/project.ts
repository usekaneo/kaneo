import type { Project } from "@/types";
import { create } from "zustand";

const useProjectStore = create<{
  project: Project | undefined;
  setProject: (updatedProject: Project | undefined) => void;
}>((set) => ({
  project: undefined,
  setProject: (updatedProject) => set(() => ({ project: updatedProject })),
}));

export default useProjectStore;
