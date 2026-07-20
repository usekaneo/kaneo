import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type HierarchyExpansionStore = {
  expandedTaskIds: Record<string, string[]>;
  isExpanded: (projectId: string, taskId: string) => boolean;
  toggleExpanded: (projectId: string, taskId: string) => void;
  expandAll: (projectId: string, taskIds: string[]) => void;
  collapseAll: (projectId: string) => void;
};

const useHierarchyExpansionStore = create<HierarchyExpansionStore>()(
  persist(
    (set, get) => ({
      expandedTaskIds: {},
      isExpanded: (projectId, taskId) => {
        const expanded = get().expandedTaskIds[projectId] ?? [];
        return expanded.includes(taskId);
      },
      toggleExpanded: (projectId, taskId) => {
        set((state) => {
          const current = new Set(state.expandedTaskIds[projectId] ?? []);
          if (current.has(taskId)) {
            current.delete(taskId);
          } else {
            current.add(taskId);
          }
          return {
            expandedTaskIds: {
              ...state.expandedTaskIds,
              [projectId]: Array.from(current),
            },
          };
        });
      },
      expandAll: (projectId, taskIds) => {
        set((state) => ({
          expandedTaskIds: {
            ...state.expandedTaskIds,
            [projectId]: taskIds,
          },
        }));
      },
      collapseAll: (projectId) => {
        set((state) => ({
          expandedTaskIds: {
            ...state.expandedTaskIds,
            [projectId]: [],
          },
        }));
      },
    }),
    {
      name: "hierarchy-expansion",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default useHierarchyExpansionStore;
