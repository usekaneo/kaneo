import { create } from "zustand";

type ShortcutsPanelStore = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const useShortcutsPanelStore = create<ShortcutsPanelStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
