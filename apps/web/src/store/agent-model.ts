import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AgentModelStore = {
  // Last chosen model per workspace; validated against the config on use.
  modelByWorkspace: Record<string, string>;
  setModel: (workspaceId: string, model: string) => void;
};

export const useAgentModelStore = create<AgentModelStore>()(
  persist(
    (set) => ({
      modelByWorkspace: {},
      setModel: (workspaceId, model) =>
        set((state) => ({
          modelByWorkspace: { ...state.modelByWorkspace, [workspaceId]: model },
        })),
    }),
    {
      name: "agent-model",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
