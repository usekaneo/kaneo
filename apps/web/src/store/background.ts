import { create } from "zustand";

type BackgroundStore = {
  background: string | null;
  setBackground: (background: string | null) => void;
};

export const useBackgroundStore = create<BackgroundStore>((set) => ({
  background: null,
  setBackground: (background) => set({ background }),
}));
