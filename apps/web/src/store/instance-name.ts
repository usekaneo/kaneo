import { brandText } from "@kaneo/branding";
import { create } from "zustand";

type InstanceNameStore = {
  instanceName: string;
  setInstanceName: (instanceName: string) => void;
};

/** The instance name from config, for page titles. */
export const useInstanceNameStore = create<InstanceNameStore>((set) => ({
  instanceName: brandText("Kaneo"),
  setInstanceName: (instanceName) => set({ instanceName }),
}));
