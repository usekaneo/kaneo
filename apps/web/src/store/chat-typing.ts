import { create } from "zustand";

// A typing ping lasts this long unless another one refreshes it.
const TYPING_TTL_MS = 5000;

type Typist = { name: string; timer: ReturnType<typeof setTimeout> };

type ChatTypingStore = {
  /** conversationId → userId → who is typing */
  typing: Record<string, Record<string, Typist>>;
  started: (conversationId: string, userId: string, name: string) => void;
  stopped: (conversationId: string, userId: string) => void;
};

export const useChatTypingStore = create<ChatTypingStore>()((set, get) => ({
  typing: {},
  started: (conversationId, userId, name) => {
    const previous = get().typing[conversationId]?.[userId];
    if (previous) clearTimeout(previous.timer);
    const timer = setTimeout(
      () => get().stopped(conversationId, userId),
      TYPING_TTL_MS,
    );
    set((state) => ({
      typing: {
        ...state.typing,
        [conversationId]: {
          ...state.typing[conversationId],
          [userId]: { name, timer },
        },
      },
    }));
  },
  stopped: (conversationId, userId) => {
    const current = get().typing[conversationId];
    if (!current?.[userId]) return;
    clearTimeout(current[userId].timer);
    const { [userId]: _, ...rest } = current;
    set((state) => ({ typing: { ...state.typing, [conversationId]: rest } }));
  },
}));
