import { create } from "zustand";

export type RelationPickerMode =
  | "related"
  | "blocks"
  | "blockedBy"
  | "parent"
  | "subtask";

type RelationPickerRequest = { taskId: string; mode: RelationPickerMode };

type RelationPickerStore = {
  request: RelationPickerRequest | null;
  open: (taskId: string, mode: RelationPickerMode) => void;
  clear: () => void;
};

export const useRelationPickerStore = create<RelationPickerStore>((set) => ({
  request: null,
  open: (taskId, mode) => set({ request: { taskId, mode } }),
  clear: () => set({ request: null }),
}));
