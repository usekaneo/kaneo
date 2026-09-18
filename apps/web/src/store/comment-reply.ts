import { create } from "zustand";

export type CommentReplyTarget = {
  taskId: string;
  id: string;
  userName: string | null;
  excerpt: string;
};

// A comment card's "Reply" and the task's comment box are far apart in the
// tree, so the reply being written lives here.
type CommentReplyStore = {
  replyTo: CommentReplyTarget | null;
  /** Bumped on every Reply click so the comment box can scroll into view. */
  requested: number;
  reply: (target: CommentReplyTarget) => void;
  clear: () => void;
};

export const useCommentReplyStore = create<CommentReplyStore>()((set) => ({
  replyTo: null,
  requested: 0,
  reply: (replyTo) => set((s) => ({ replyTo, requested: s.requested + 1 })),
  clear: () => set({ replyTo: null }),
}));
