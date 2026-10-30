import { create } from "zustand";

export type BulkPicker =
  | "status"
  | "priority"
  | "assignee"
  | "labels"
  | "dueDate";
export type BulkRequest = BulkPicker | "delete";

type BulkRequestStore = {
  request: BulkRequest | null;
  temporaryTaskId: string | null;
  send: (request: BulkRequest, temporaryTaskId: string | null) => void;
  consume: () => void;
  release: () => void;
};

export const useBulkRequestStore = create<BulkRequestStore>((set) => ({
  request: null,
  temporaryTaskId: null,
  send: (request, temporaryTaskId) => set({ request, temporaryTaskId }),
  consume: () => set({ request: null }),
  release: () => set({ temporaryTaskId: null }),
}));
