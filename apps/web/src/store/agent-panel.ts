import { create } from "zustand";

type AgentPanelStore = {
  open: boolean;
  // Conversation shown in the board panel, per project.
  conversationIds: Record<string, string | undefined>;
  // Short labels for pending proposals, shown on matching board cards.
  proposedByTaskId: Record<string, string>;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setConversation: (projectId: string, conversationId?: string) => void;
  setProposed: (proposedByTaskId: Record<string, string>) => void;
};

const emptyProposals: Record<string, string> = {};

export const useAgentPanelStore = create<AgentPanelStore>((set) => ({
  open: false,
  conversationIds: {},
  proposedByTaskId: emptyProposals,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
  setConversation: (projectId, conversationId) =>
    set((state) => ({
      conversationIds: {
        ...state.conversationIds,
        [projectId]: conversationId,
      },
    })),
  setProposed: (proposedByTaskId) =>
    set({
      proposedByTaskId:
        Object.keys(proposedByTaskId).length === 0
          ? emptyProposals
          : proposedByTaskId,
    }),
}));
