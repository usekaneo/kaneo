import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// The widget lives inside each page's layout, so its state has to outlive the
// page to stay open while someone moves around the app.
type ChatWidgetStore = {
  open: boolean;
  conversationId: string | null;
  setOpen: (open: boolean) => void;
  openConversation: (conversationId: string | null) => void;
};

export const useChatWidgetStore = create<ChatWidgetStore>()(
  persist(
    (set) => ({
      open: false,
      conversationId: null,
      setOpen: (open) => set({ open }),
      openConversation: (conversationId) => set({ conversationId }),
    }),
    {
      name: "kaneo-chat-widget",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
